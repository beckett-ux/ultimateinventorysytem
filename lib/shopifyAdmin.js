import { getShopAccessToken, normalizeShopDomain } from "./db";

const DEFAULT_API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-10";

const isValidShopDomain = (shop) =>
  /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);

const normalizeUserError = (error) => ({
  message: typeof error?.message === "string" ? error.message : "Unknown error",
  field: Array.isArray(error?.field) ? error.field : null,
  code: typeof error?.code === "string" ? error.code : null,
});

const collectUserErrors = (node, collected = []) => {
  if (!node) return collected;

  if (Array.isArray(node)) {
    for (const item of node) {
      collectUserErrors(item, collected);
    }
    return collected;
  }

  if (typeof node !== "object") return collected;

  if (Array.isArray(node.userErrors)) {
    for (const error of node.userErrors) {
      collected.push(normalizeUserError(error));
    }
  }

  for (const value of Object.values(node)) {
    collectUserErrors(value, collected);
  }

  return collected;
};

export async function shopifyAdminGraphql({
  shopDomain,
  query,
  variables,
  apiVersion = DEFAULT_API_VERSION,
} = {}) {
  const shop = normalizeShopDomain(shopDomain);

  if (!shop) {
    return {
      ok: false,
      status: 400,
      json: null,
      errors: [{ message: "Missing `shopDomain`" }],
      userErrors: [],
    };
  }

  if (!isValidShopDomain(shop)) {
    return {
      ok: false,
      status: 400,
      json: null,
      errors: [{ message: "Invalid `shopDomain`" }],
      userErrors: [],
    };
  }

  if (!query || typeof query !== "string") {
    return {
      ok: false,
      status: 400,
      json: null,
      errors: [{ message: "Missing GraphQL `query`" }],
      userErrors: [],
    };
  }

  const accessToken = await getShopAccessToken(shop);
  if (!accessToken) {
    return {
      ok: false,
      status: 401,
      json: null,
      errors: [{ message: "No stored Shopify access token for shop" }],
      userErrors: [],
    };
  }

  const endpoint = `https://${shop}/admin/api/${apiVersion}/graphql.json`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({
      query,
      variables: variables && typeof variables === "object" ? variables : {},
    }),
  });

  const rawBody = await response.text();

  let json = null;
  try {
    json = JSON.parse(rawBody);
  } catch {
    json = null;
  }

  if (!json) {
    return {
      ok: false,
      status: response.status,
      json: null,
      errors: [{ message: "Shopify Admin GraphQL returned a non-JSON response" }],
      userErrors: [],
    };
  }

  const errors = Array.isArray(json?.errors) ? json.errors : [];
  const userErrors = collectUserErrors(json?.data);

  return {
    ok: response.ok && errors.length === 0 && userErrors.length === 0,
    status: response.status,
    json,
    errors,
    userErrors,
  };
}

export async function fetchShopifyLocations({
  shopDomain,
  apiVersion = DEFAULT_API_VERSION,
} = {}) {
  const query = `
    query Locations {
      locations(first: 250) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `;

  const result = await shopifyAdminGraphql({
    shopDomain,
    apiVersion,
    query,
  });

  const edges = result?.json?.data?.locations?.edges;
  const locations = Array.isArray(edges)
    ? edges
        .map((edge) => edge?.node)
        .filter(Boolean)
        .map((node) => ({
          id: node?.id ?? null,
          name: node?.name ?? null,
        }))
        .filter((location) => location.id && location.name)
    : [];

  return {
    ...result,
    locations,
  };
}

export default shopifyAdminGraphql;
