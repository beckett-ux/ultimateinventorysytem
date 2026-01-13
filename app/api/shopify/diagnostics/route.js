import { NextResponse } from "next/server";
import {
  SHOPIFY_OAUTH_CALLBACK_PATH,
  getShopifyOAuthCallbackUrl,
  tryGetShopifyAppUrlOrigin,
} from "@/lib/shopify";

export const runtime = "nodejs";

export function GET() {
  const callbackPath = SHOPIFY_OAUTH_CALLBACK_PATH;
  const appUrlOrigin = tryGetShopifyAppUrlOrigin();

  if (!appUrlOrigin) {
    const rawAppUrl = process.env.SHOPIFY_APP_URL;
    const error = rawAppUrl
      ? `Invalid SHOPIFY_APP_URL (must be an http(s) URL): ${rawAppUrl}`
      : "Missing required env var: SHOPIFY_APP_URL";

    return NextResponse.json(
      {
        error,
        appUrlOrigin: null,
        callbackPath,
        callbackUrl: null,
        recommendedAllowedRedirectUrls: [],
      },
      { status: 500 }
    );
  }

  let callbackUrl = null;
  try {
    callbackUrl = getShopifyOAuthCallbackUrl();
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || "Unable to compute Shopify OAuth callback URL",
        appUrlOrigin,
        callbackPath,
        callbackUrl: null,
        recommendedAllowedRedirectUrls: [],
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    appUrlOrigin,
    callbackPath,
    callbackUrl,
    recommendedAllowedRedirectUrls: callbackUrl ? [callbackUrl] : [],
  });
}

