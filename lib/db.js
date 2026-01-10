import postgres from "postgres";

const globalForPostgres = globalThis;

const canonicalizeDatabaseUrl = (connectionString) => {
  if (typeof connectionString !== "string") {
    return connectionString;
  }

  try {
    const url = new URL(connectionString);
    if (!url.searchParams.has("schema")) {
      return connectionString;
    }

    url.searchParams.delete("schema");
    return url.toString();
  } catch {
    const [beforeHash, hash] = connectionString.split("#");
    const [base, query] = beforeHash.split("?");
    if (!query) {
      return connectionString;
    }

    const filtered = query
      .split("&")
      .filter((part) => part && part.split("=")[0].toLowerCase() !== "schema")
      .join("&");

    return `${base}${filtered ? `?${filtered}` : ""}${hash ? `#${hash}` : ""}`;
  }
};

const createSql = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    const error = new Error(
      "DATABASE_URL is not set. Set it in your environment to connect to Postgres."
    );
    error.code = "MISSING_DATABASE_URL";
    throw error;
  }

  return postgres(canonicalizeDatabaseUrl(connectionString), {
    max: process.env.VERCEL ? 1 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: process.env.NODE_ENV === "production" ? "require" : false,
  });
};

const getSql = () => {
  if (!globalForPostgres.__postgresSql) {
    globalForPostgres.__postgresSql = createSql();
  }

  return globalForPostgres.__postgresSql;
};

export const sql = new Proxy(function sqlProxy() {}, {
  apply(_target, _thisArg, args) {
    return getSql()(...args);
  },
  get(_target, prop) {
    return getSql()[prop];
  },
});

export const normalizeShopDomain = (shopDomain) =>
  (shopDomain || "").trim().toLowerCase();

export async function upsertShop({ shopDomain, accessToken }) {
  const [shop] = await sql`
    INSERT INTO shops (shop_domain, access_token)
    VALUES (${shopDomain}, ${accessToken})
    ON CONFLICT (shop_domain)
    DO UPDATE SET access_token = EXCLUDED.access_token, updated_at = now()
    RETURNING id, shop_domain
  `;

  return shop;
}

export async function getShopAccessToken(shopDomain) {
  const normalized = normalizeShopDomain(shopDomain);
  if (!normalized) {
    return null;
  }

  const [shop] = await sql`
    SELECT access_token
    FROM shops
    WHERE shop_domain = ${normalized}
    LIMIT 1
  `;

  return shop?.access_token || null;
}

export async function getShopDefaultLocationId(shopDomain) {
  const normalized = normalizeShopDomain(shopDomain);
  if (!normalized) {
    return null;
  }

  const [row] = await sql`
    SELECT ss.default_location_id AS default_location_id
    FROM shops s
    LEFT JOIN shop_settings ss ON ss.shop_id = s.id
    WHERE s.shop_domain = ${normalized}
    LIMIT 1
  `;

  return row?.default_location_id ?? null;
}

export async function upsertShopDefaultLocationId({ shopDomain, locationId }) {
  const normalized = normalizeShopDomain(shopDomain);
  if (!normalized) {
    return null;
  }

  const [shop] = await sql`
    SELECT id
    FROM shops
    WHERE shop_domain = ${normalized}
    LIMIT 1
  `;

  if (!shop?.id) {
    return null;
  }

  const [settings] = await sql`
    INSERT INTO shop_settings (shop_id, default_location_id)
    VALUES (${shop.id}, ${locationId}::bigint)
    ON CONFLICT (shop_id)
    DO UPDATE SET default_location_id = EXCLUDED.default_location_id, updated_at = now()
    RETURNING default_location_id
  `;

  return settings?.default_location_id ?? null;
}

export default sql;
