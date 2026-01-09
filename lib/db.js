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

export default sql;
