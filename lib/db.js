import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Set it in your environment to connect to Postgres."
  );
}

const globalForPostgres = globalThis;

const sql =
  globalForPostgres.__postgresSql ??
  postgres(connectionString, {
    ssl: process.env.NODE_ENV === "production" ? "require" : false,
  });

if (process.env.NODE_ENV !== "production") globalForPostgres.__postgresSql = sql;

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

export default sql;
