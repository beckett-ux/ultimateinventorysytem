import "@shopify/shopify-api/adapters/web-api";
import { LATEST_API_VERSION, shopifyApi } from "@shopify/shopify-api";
import { PostgreSQLSessionStorage } from "@shopify/shopify-app-session-storage-postgresql";
import { normalizeShopDomain } from "./db";

const globalForShopify = globalThis;

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

const normalizePgConnectionUrl = (connectionString) => {
  const canonical = canonicalizeDatabaseUrl(connectionString);
  if (typeof canonical !== "string") return canonical;

  try {
    const url = new URL(canonical);
    const sslmode = url.searchParams.get("sslmode");
    if (sslmode && !process.env.PGSSLMODE) {
      process.env.PGSSLMODE = sslmode;
    }
    if (!url.port) {
      url.port = "5432";
    }
    return url.toString();
  } catch {
    return canonical;
  }
};

const getRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`Missing required env var: ${name}`);
    error.code = "MISSING_ENV";
    error.env = name;
    throw error;
  }
  return value;
};

const getAppUrl = () => {
  if (process.env.SHOPIFY_APP_URL) return process.env.SHOPIFY_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return null;
};

export function getShopify() {
  if (globalForShopify.__shopifyApp) {
    return globalForShopify.__shopifyApp;
  }

  const appUrl = getAppUrl();
  if (!appUrl) {
    const error = new Error(
      "Missing required env var: SHOPIFY_APP_URL (or VERCEL_URL for Vercel previews)"
    );
    error.code = "MISSING_ENV";
    error.env = "SHOPIFY_APP_URL";
    throw error;
  }

  const appUrlParsed = new URL(appUrl);
  const apiKey = getRequiredEnv("SHOPIFY_API_KEY");
  const apiSecretKey = getRequiredEnv("SHOPIFY_API_SECRET");
  const scopesRaw = getRequiredEnv("SHOPIFY_SCOPES");
  const databaseUrl = normalizePgConnectionUrl(getRequiredEnv("DATABASE_URL"));

  const scopes = scopesRaw
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

  const shopify = shopifyApi({
    apiKey,
    apiSecretKey,
    scopes,
    hostName: appUrlParsed.host,
    hostScheme: appUrlParsed.protocol.replace(":", "") || "https",
    apiVersion: process.env.SHOPIFY_API_VERSION || LATEST_API_VERSION,
    isEmbeddedApp: true,
    sessionStorage: new PostgreSQLSessionStorage(databaseUrl),
  });

  globalForShopify.__shopifyApp = shopify;
  return shopify;
}

const sanitizeShopDomain = (value) =>
  normalizeShopDomain((value || "").replace(/^https?:\/\//i, "").replace(/\/+$/, ""));

const SHOP_HEADER_KEYS = ["x-shopify-shop-domain", "x-shopify-shop", "x-shop-domain"];

export const getShopFromRequest = (request) => {
  if (!request?.url) return null;

  const url = new URL(request.url);
  const searchShop = sanitizeShopDomain(url.searchParams.get("shop"));
  if (searchShop) return searchShop;

  const headers = request.headers || request?.headers?.get ? request.headers : null;
  if (headers?.get) {
    for (const key of SHOP_HEADER_KEYS) {
      const fromHeader = sanitizeShopDomain(headers.get(key));
      if (fromHeader) return fromHeader;
    }
  }

  const referer = headers?.get ? headers.get("referer") || headers.get("referrer") : null;
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererShop = sanitizeShopDomain(refererUrl.searchParams.get("shop"));
      if (refererShop) return refererShop;
    } catch {
      /* ignore invalid referer */
    }
  }

  return null;
};

export async function loadOfflineSession({ request, shop } = {}) {
  const shopify = getShopify();
  let resolvedShop = sanitizeShopDomain(shop || getShopFromRequest(request));
  let session = null;

  if (!session && request && typeof shopify.session?.getCurrentId === "function") {
    const sessionId = await shopify.session.getCurrentId({
      isOnline: false,
      rawRequest: request,
    });

    if (sessionId && typeof shopify.sessionStorage?.loadSession === "function") {
      session = await shopify.sessionStorage.loadSession(sessionId);
      resolvedShop = resolvedShop || sanitizeShopDomain(session?.shop);
    }
  }

  if (!resolvedShop) {
    return { shop: null, session: null };
  }

  const offlineId =
    typeof shopify.session?.getOfflineId === "function"
      ? shopify.session.getOfflineId(resolvedShop)
      : null;

  if (!session && offlineId && typeof shopify.sessionStorage?.loadSession === "function") {
    session = await shopify.sessionStorage.loadSession(offlineId);
  }

  if (!session && typeof shopify.sessionStorage?.findSessionsByShop === "function") {
    const sessions = await shopify.sessionStorage.findSessionsByShop(resolvedShop);
    session = Array.isArray(sessions) ? sessions.find(Boolean) : null;
  }

  return { shop: resolvedShop, session: session || null };
}
