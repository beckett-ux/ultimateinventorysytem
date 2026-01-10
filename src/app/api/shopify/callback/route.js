import { NextResponse } from "next/server";
import { getShopify, getShopifyAppUrlOrigin } from "@/lib/shopify";

export const runtime = "nodejs";

const CALLBACK_PATH = "/api/shopify/callback";
const SHOPIFY_OAUTH_CALLBACK_EVENT = "shopify_oauth_callback";

const toBase64 = (value) => String(value || "").replace(/-/g, "+").replace(/_/g, "/");

const decodeHostParam = (host) => {
  if (!host) return null;
  const normalized = toBase64(host);
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");

  try {
    const decoded = Buffer.from(padded, "base64").toString("utf8").trim();
    if (!decoded) return null;
    return decoded.replace(/^https?:\/\//i, "").replace(/^\/+/, "").replace(/\/+$/, "");
  } catch {
    return null;
  }
};

const buildEmbeddedAdminAppUrl = ({ shop, host, apiKey, path = "/dashboard" }) => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const decodedHost = decodeHostParam(host);
  const adminBase = decodedHost ? `https://${decodedHost}` : `https://${shop}/admin`;
  const url = new URL(`${adminBase}/apps/${apiKey}${cleanPath}`);

  if (shop) url.searchParams.set("shop", shop);
  if (host) url.searchParams.set("host", host);
  url.searchParams.set("embedded", "1");

  return url.toString();
};

const determineErrorStatus = (error) => {
  const name = error?.name || "";
  if (
    name === "InvalidOAuthError" ||
    name === "InvalidHmacError" ||
    name === "InvalidShopError" ||
    name === "CookieNotFound"
  ) {
    return 400;
  }

  if (error?.code === "MISSING_ENV") {
    return 500;
  }

  return 500;
};

export async function GET(request) {
  try {
    const requestUrl = new URL(request.url);
    const hasHost = Boolean((requestUrl.searchParams.get("host") || "").trim());
    const shopFromQuery = (requestUrl.searchParams.get("shop") || "").trim().toLowerCase();
    const shopifyAppUrl = process.env.SHOPIFY_APP_URL || null;

    let shopifyAppUrlOrigin = null;
    let redirectUri = null;
    try {
      shopifyAppUrlOrigin = getShopifyAppUrlOrigin();
      redirectUri = new URL(CALLBACK_PATH, shopifyAppUrlOrigin).toString();
    } catch {
      /* ignore diagnostics computation errors */
    }

    console.info(
      JSON.stringify({
        event: SHOPIFY_OAUTH_CALLBACK_EVENT,
        shop: shopFromQuery || null,
        hasHost,
        shopifyAppUrl,
        shopifyAppUrlOrigin,
        redirectUri,
        query: {
          hasCode: requestUrl.searchParams.has("code"),
          hasHmac: requestUrl.searchParams.has("hmac"),
          hasState: requestUrl.searchParams.has("state"),
          hasError: requestUrl.searchParams.has("error"),
          hasErrorDescription: requestUrl.searchParams.has("error_description"),
        },
      })
    );

    const shopify = getShopify();
    const { session, headers } = await shopify.auth.callback({
      rawRequest: request,
    });

    await shopify.sessionStorage.storeSession(session);

    if (session?.shop && session?.accessToken) {
      const { upsertShop } = await import("@/lib/db");
      await upsertShop({ shopDomain: session.shop, accessToken: session.accessToken });
    }

    const host = requestUrl.searchParams.get("host") || "";
    const shop = session?.shop || requestUrl.searchParams.get("shop") || "";
    const apiKey = process.env.SHOPIFY_API_KEY || process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

    const redirectUrl =
      apiKey && shop
        ? buildEmbeddedAdminAppUrl({ shop, host, apiKey, path: "/dashboard" })
        : (() => {
            const fallback = new URL("/dashboard", request.url);
            if (shop) fallback.searchParams.set("shop", shop);
            if (host) fallback.searchParams.set("host", host);
            fallback.searchParams.set("embedded", "1");
            return fallback.toString();
          })();

    const response = NextResponse.redirect(redirectUrl.toString(), 302);
    for (const [key, value] of headers.entries()) {
      response.headers.append(key, value);
    }

    return response;
  } catch (error) {
    const requestUrl = new URL(request.url);
    const hasHost = Boolean((requestUrl.searchParams.get("host") || "").trim());
    const shopFromQuery = (requestUrl.searchParams.get("shop") || "").trim().toLowerCase();
    const shopifyAppUrl = process.env.SHOPIFY_APP_URL || null;

    let shopifyAppUrlOrigin = null;
    let redirectUri = null;
    try {
      shopifyAppUrlOrigin = getShopifyAppUrlOrigin();
      redirectUri = new URL(CALLBACK_PATH, shopifyAppUrlOrigin).toString();
    } catch {
      /* ignore diagnostics computation errors */
    }

    return NextResponse.json(
      {
        error: error?.message || "Unexpected error",
        shop: shopFromQuery || null,
        hasHost,
        shopifyAppUrl,
        shopifyAppUrlOrigin,
        redirectUri,
      },
      { status: determineErrorStatus(error) }
    );
  }
}

