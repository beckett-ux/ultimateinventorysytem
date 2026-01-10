import { NextResponse } from "next/server";
import { getShopify, getShopifyAppUrlOrigin } from "@/lib/shopify";

export const runtime = "nodejs";

const CALLBACK_PATH = "/api/shopify/callback";
const SHOPIFY_OAUTH_BEGIN_EVENT = "shopify_oauth_begin";

const isValidShopDomain = (shop) =>
  /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const shop = (searchParams.get("shop") || "").trim().toLowerCase();
  const hasHost = Boolean((searchParams.get("host") || "").trim());

  if (!shop) {
    return NextResponse.json(
      { error: "Missing `shop` query parameter" },
      { status: 400 }
    );
  }

  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: "Invalid `shop` domain" }, { status: 400 });
  }

  try {
    const shopifyAppUrl = process.env.SHOPIFY_APP_URL || null;
    const shopifyAppUrlOrigin = getShopifyAppUrlOrigin();
    const shopify = getShopify();
    const canonicalRedirectUri = new URL(
      CALLBACK_PATH,
      shopifyAppUrlOrigin
    ).toString();

    console.info(
      JSON.stringify({
        event: SHOPIFY_OAUTH_BEGIN_EVENT,
        shop,
        hasHost,
        shopifyAppUrl,
        shopifyAppUrlOrigin,
        redirectUri: canonicalRedirectUri,
      })
    );

    const response = await shopify.auth.begin({
      shop,
      callbackPath: CALLBACK_PATH,
      isOnline: false,
      rawRequest: request,
    });

    const location = response?.headers?.get?.("location");
    if (location) {
      try {
        const authUrl = new URL(location);
        authUrl.searchParams.set("redirect_uri", canonicalRedirectUri);
        response.headers.set("location", authUrl.toString());
      } catch {
        /* ignore invalid Location */
      }
    }

    return response;
  } catch (error) {
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
        error: error?.message || "Shopify OAuth is not configured",
        shop,
        hasHost,
        shopifyAppUrl,
        shopifyAppUrlOrigin,
        redirectUri,
      },
      { status: 500 }
    );
  }
}

