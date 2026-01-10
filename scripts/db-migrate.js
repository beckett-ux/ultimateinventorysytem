const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client } = require("pg");

const loadDotEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    if (!key || process.env[key] != null) continue;

    let value = line.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
};

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    const error = new Error(
      `Missing required env var: ${name} (needed to run database migrations)`
    );
    error.code = "MISSING_ENV";
    error.env = name;
    throw error;
  }
  return value;
};

const shouldUseSsl = (databaseUrl) => {
  try {
    const url = new URL(databaseUrl);
    const sslmode = (url.searchParams.get("sslmode") || "").toLowerCase();
    if (sslmode === "disable") return false;
    if (sslmode === "require") return true;

    const host = (url.hostname || "").toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return false;
    return true;
  } catch {
    return true;
  }
};

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

async function main() {
  loadDotEnvFile(path.join(process.cwd(), ".env.local"));
  loadDotEnvFile(path.join(process.cwd(), ".env"));

  const databaseUrl = getRequiredEnv("DATABASE_URL");
  const migrationsDir = path.join(process.cwd(), "db", "migrations");

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations folder not found: ${migrationsDir}`);
  }

  const entries = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (entries.length === 0) {
    console.log("No migrations to apply");
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : false,
  });

  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const filename of entries) {
      const fullPath = path.join(migrationsDir, filename);
      const sqlText = fs.readFileSync(fullPath, "utf8");
      const checksum = sha256(sqlText);

      const existing = await client.query(
        "SELECT checksum FROM schema_migrations WHERE filename = $1",
        [filename]
      );

      if (existing.rows[0]?.checksum) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(
            `Migration checksum mismatch for ${filename} (file changed after being applied)`
          );
        }
        continue;
      }

      await client.query("BEGIN");
      try {
        await client.query(sqlText);
        await client.query(
          "INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)",
          [filename, checksum]
        );
        await client.query("COMMIT");
        console.log(`Applied ${filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  const message = error?.message ? String(error.message) : "Migration failed";
  console.error(message);
  process.exit(1);
});
