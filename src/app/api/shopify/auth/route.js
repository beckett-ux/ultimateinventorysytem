import { NextResponse } from "next/server";
import { getShopify } from "@/lib/shopify";

export const runtime = "nodejs";

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
    return await shopify.auth.begin({
      shop,
      callbackPath: "/api/shopify/callback",
      isOnline: false,
      rawRequest: request,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Shopify OAuth is not configured" },
      { status: 500 }
    );
  }
}

