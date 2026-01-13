import { NextResponse } from "next/server";
import {
  SHOPIFY_OAUTH_CALLBACK_PATH,
  getShopify,
  getShopifyOAuthCallbackUrl,
  tryGetShopifyAppUrlOrigin,
} from "@/lib/shopify";

export const runtime = "nodejs";

const SHOPIFY_OAUTH_REDIRECT_URI_EVENT = "shopify_oauth_redirect_uri";

const isValidShopDomain = (shop) =>
  /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const shop = (searchParams.get("shop") || "").trim().toLowerCase();
  const hasHost = Boolean((searchParams.get("host") || "").trim());
  const isDebug = (searchParams.get("debug") || "").trim() === "1";

  if (!shop) {
    return NextResponse.json(
      { error: "Missing `shop` query parameter" },
      { status: 400 }
    );
  }

  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: "Invalid `shop` domain" }, { status: 400 });
  }

  const canonicalOrigin = tryGetShopifyAppUrlOrigin();
  let callbackUrl = null;

  try {
    callbackUrl = getShopifyOAuthCallbackUrl({ request });
  } catch (error) {
    return NextResponse.json(
      {
        error: error?.message || "Unable to compute Shopify OAuth callback URL",
        shop,
        hasHost,
        shopifyAppUrl: process.env.SHOPIFY_APP_URL || null,
        callbackPath: SHOPIFY_OAUTH_CALLBACK_PATH,
        callbackUrl: null,
      },
      { status: 500 }
    );
  }

  if (isDebug) {
    return NextResponse.json({
      vercelEnv: process.env.VERCEL_ENV || null,
      callbackPath: SHOPIFY_OAUTH_CALLBACK_PATH,
      canonicalOrigin,
      callbackUrl,
    });
  }

  try {
    const shopify = getShopify();

    console.info(
      JSON.stringify({
        event: SHOPIFY_OAUTH_REDIRECT_URI_EVENT,
        shop,
        callbackUrl,
      })
    );

    const response = await shopify.auth.begin({
      shop,
      callbackPath: SHOPIFY_OAUTH_CALLBACK_PATH,
      isOnline: false,
      rawRequest: request,
    });

    const location = response?.headers?.get?.("location");
    if (!location) return response;

    let authUrl = null;
    try {
      authUrl = new URL(location);
    } catch {
      try {
        authUrl = new URL(location, request.url);
      } catch {
        authUrl = null;
      }
    }

    if (!authUrl) return response;

    authUrl.searchParams.set("redirect_uri", callbackUrl);

    const redirectResponse = NextResponse.redirect(authUrl.toString(), 302);
    const setCookies =
      typeof response?.headers?.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : response?.headers?.get?.("set-cookie")
          ? [response.headers.get("set-cookie")]
          : [];

    for (const cookie of setCookies) {
      if (cookie) {
        redirectResponse.headers.append("set-cookie", cookie);
      }
    }

    return redirectResponse;
  } catch (error) {
    const shopifyAppUrl = process.env.SHOPIFY_APP_URL || null;

    return NextResponse.json(
      {
        error: error?.message || "Shopify OAuth is not configured",
        shop,
        hasHost,
        shopifyAppUrl,
        callbackPath: SHOPIFY_OAUTH_CALLBACK_PATH,
        canonicalOrigin,
        callbackUrl,
      },
      { status: 500 }
    );
  }
}

