import { NextResponse } from "next/server";
import sql, { getShopAccessToken, normalizeShopDomain } from "@/lib/db";
import { getShopFromRequest, loadOfflineSession } from "@/lib/shopify";

export const runtime = "nodejs";

const sanitizeShopDomain = (value) =>
  normalizeShopDomain((value || "").replace(/^https?:\/\//i, "").replace(/\/+$/, ""));

const API_VERSION = process.env.SHOPIFY_API_VERSION || "2024-10";

const isValidShopDomain = (shop) =>
  /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop || "");

const unauthorizedResponse = (shop) =>
  NextResponse.json(
    {
      ok: false,
      error: shop
        ? `No Shopify session found for ${shop}. Install the app for this shop and try again.`
        : "No Shopify shop detected. Add ?shop=<shop>.myshopify.com and install the app to continue.",
      code: "shopify_auth_required",
      action: "install_app",
    },
    { status: 401 }
  );

const shopifyConfigErrorResponse = (error) =>
  NextResponse.json(
    {
      ok: false,
      error: error?.message || "Shopify OAuth is not configured.",
      code: "shopify_config_error",
    },
    { status: 500 }
  );

const normalizeInventoryItemId = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatPriceFromCents = (value) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return (parsed / 100).toFixed(2);
};

const buildProductPayload = (item) => {
  const bodyParts = [];
  if (item.notes) {
    bodyParts.push(item.notes);
  }
  if (item.condition) {
    bodyParts.push(`Condition: ${item.condition}`);
  }

  const variant = {
    price: formatPriceFromCents(item.price_cents) ?? "0.00",
    sku: item.sku || undefined,
  };

  const tags = [];
  if (item.brand) tags.push(item.brand);
  if (item.category) tags.push(item.category);
  if (item.condition) tags.push(`condition:${item.condition}`);

  return {
    product: {
      title: item.title || "Untitled product",
      body_html: bodyParts.join("<br><br>") || undefined,
      vendor: item.brand || undefined,
      product_type: item.category || undefined,
      tags: tags.length ? tags : undefined,
      status: "draft",
      variants: [variant],
    },
  };
};

export async function POST(request) {
  const requestShop = sanitizeShopDomain(getShopFromRequest(request));
  if (!requestShop) {
    return unauthorizedResponse(null);
  }

  if (!isValidShopDomain(requestShop)) {
    return NextResponse.json(
      { ok: false, error: "Invalid `shop` domain", code: "invalid_shop" },
      { status: 400 }
    );
  }

  let accessToken = null;
  try {
    const { session } = await loadOfflineSession({ request, shop: requestShop });
    accessToken = session?.accessToken || null;
  } catch (error) {
    return shopifyConfigErrorResponse(error);
  }

  if (!accessToken) {
    try {
      accessToken = await getShopAccessToken(requestShop);
    } catch (error) {
      if (error?.code === "MISSING_DATABASE_URL") {
        return NextResponse.json(
          {
            ok: false,
            error:
              "DATABASE_URL is not configured. Set DATABASE_URL in your environment (for local dev, .env.local).",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { ok: false, error: error?.message || "Unexpected database error." },
        { status: 500 }
      );
    }
  }

  if (!accessToken) {
    return unauthorizedResponse(requestShop);
  }

  let body = {};
  try {
    body = (await request.json()) || {};
  } catch {
    body = {};
  }

  const inventoryItemId = normalizeInventoryItemId(
    body.inventoryItemId ?? body.id ?? body.itemId
  );

  if (!inventoryItemId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing `inventoryItemId` in request body.",
        code: "missing_inventory_item_id",
      },
      { status: 400 }
    );
  }

  let inventoryItem = null;
  try {
    const rows = await sql`
      SELECT
        id,
        title,
        sku,
        brand,
        category,
        condition,
        price_cents,
        notes
      FROM inventory_items
      WHERE id = ${inventoryItemId}
      LIMIT 1
    `;
    inventoryItem = rows?.[0] || null;
  } catch (error) {
    if (error?.code === "MISSING_DATABASE_URL") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "DATABASE_URL is not configured. Set DATABASE_URL in your environment (for local dev, .env.local).",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: false, error: error?.message || "Unexpected database error." },
      { status: 500 }
    );
  }

  if (!inventoryItem) {
    return NextResponse.json(
      { ok: false, error: "Inventory item not found." },
      { status: 404 }
    );
  }

  const endpoint = `https://${requestShop}/admin/api/${API_VERSION}/products.json`;
  const productPayload = buildProductPayload(inventoryItem);

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify(productPayload),
    });
  } catch (networkError) {
    return NextResponse.json(
      {
        ok: false,
        error: networkError?.message || "Unable to reach Shopify Admin API.",
      },
      { status: 502 }
    );
  }

  const rawBody = await response.text();
  let json = null;
  try {
    json = JSON.parse(rawBody);
  } catch {
    json = null;
  }

  if (!json?.product) {
    const errorMessage =
      (json?.errors && JSON.stringify(json.errors)) ||
      json?.error ||
      "Shopify Admin API did not return a product.";

    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: response.status || 502 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      productId: json.product.id ?? null,
      handle: json.product.handle ?? null,
      product: json.product,
    },
    { status: 200 }
  );
}
