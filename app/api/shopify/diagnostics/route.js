import { NextResponse } from "next/server";
import {
  SHOPIFY_OAUTH_CALLBACK_PATH,
  getRequestOrigin,
  getShopifyApiKey,
  tryGetShopifyAppUrlOrigin,
  tryGetShopifyOAuthCallbackUrl,
} from "@/lib/shopify";

export const runtime = "nodejs";

export function GET(request) {
  const vercelEnv = process.env.VERCEL_ENV || null;
  const callbackPath = SHOPIFY_OAUTH_CALLBACK_PATH;

  let requestOrigin = null;
  try {
    requestOrigin = getRequestOrigin(request);
  } catch {
    requestOrigin = null;
  }

  let apiKey = null;
  let apiKeyError = null;
  try {
    apiKey = getShopifyApiKey();
  } catch (error) {
    apiKey = "ERROR";
    apiKeyError = error?.message || "Unable to resolve Shopify API key";
  }

  const rawScopes = process.env.SHOPIFY_SCOPES || "";
  const scopes = rawScopes
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

  const appUrlOrigin = tryGetShopifyAppUrlOrigin();

  const callbackUrl = tryGetShopifyOAuthCallbackUrl({
    request,
    origin: appUrlOrigin || undefined,
  });

  const recommendedAllowedRedirectUrls = callbackUrl ? [callbackUrl] : [];
  const recommendedPartnersAppUrlBase = appUrlOrigin || requestOrigin;
  const recommendedPartnersAppUrl = recommendedPartnersAppUrlBase
    ? new URL("/app", recommendedPartnersAppUrlBase).toString().replace(/\/$/, "")
    : null;

  const warnings = [];
  if (appUrlOrigin && requestOrigin && appUrlOrigin !== requestOrigin) {
    warnings.push("ORIGIN_MISMATCH");
  }
  if (apiKeyError) {
    warnings.push("API_KEY_ERROR");
  }
  if (!callbackUrl) {
    warnings.push("NO_CALLBACK_URL");
  }

  const rawAppUrl = process.env.SHOPIFY_APP_URL;
  const error =
    appUrlOrigin || !rawAppUrl
      ? null
      : `Invalid SHOPIFY_APP_URL (must be an http(s) URL): ${rawAppUrl}`;

  const response = {
    vercelEnv,
    apiKey,
    scopes,
    requestOrigin,
    appUrlOrigin,
    callbackPath,
    callbackUrl,
    recommendedAllowedRedirectUrls,
    recommendedPartnersAppUrl,
    warnings,
  };

  if (!appUrlOrigin) {
    return NextResponse.json(
      {
        ...response,
        error: error || "Missing required env var: SHOPIFY_APP_URL",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(response);
}

