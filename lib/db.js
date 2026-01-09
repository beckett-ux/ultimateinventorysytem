import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

const globalForPostgres = globalThis;

const sql =
  globalForPostgres.__postgresSql ??
  (connectionString
    ? postgres(connectionString, {
        ssl: process.env.NODE_ENV === "production" ? "require" : false,
      })
    : null);

if (process.env.NODE_ENV !== "production" && sql) {
  globalForPostgres.__postgresSql = sql;
}

const requireSql = () => {
  if (!sql) {
    throw new Error(
      "DATABASE_URL is not set. Set it in your environment to connect to Postgres."
    );
  }
  return sql;
};

export async function upsertShop({ shopDomain, accessToken }) {
  const sql = requireSql();
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
  const normalized = (shopDomain || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const sql = requireSql();
  const [shop] = await sql`
    SELECT access_token
    FROM shops
    WHERE shop_domain = ${normalized}
    LIMIT 1
  `;

  return shop?.access_token || null;
}

export default sql;
