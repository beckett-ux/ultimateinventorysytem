import { NextResponse } from "next/server";
import { getShopify, getShopifyAppUrlOrigin } from "@/lib/shopify";

export const runtime = "nodejs";

const CALLBACK_PATH = "/api/shopify/callback";

const isValidShopDomain = (shop) =>
  /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const shop = (searchParams.get("shop") || "").trim().toLowerCase();

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
    const shopify = getShopify();
    const canonicalRedirectUri = new URL(
      CALLBACK_PATH,
      getShopifyAppUrlOrigin()
    ).toString();

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
    return NextResponse.json(
      { error: error?.message || "Shopify OAuth is not configured" },
      { status: 500 }
    );
  }
}

