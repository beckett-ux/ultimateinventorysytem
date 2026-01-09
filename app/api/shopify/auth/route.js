import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const isValidShopDomain = (shop) => /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);

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

  const apiKey = process.env.SHOPIFY_API_KEY;
  const scopes = process.env.SHOPIFY_SCOPES;
  const appUrl = process.env.SHOPIFY_APP_URL;

  if (!apiKey || !scopes || !appUrl) {
    return NextResponse.json(
      { error: "Shopify OAuth is not configured" },
      { status: 500 }
    );
  }

  const state = crypto.randomBytes(16).toString("base64url");
  const redirectUri = new URL("/api/shopify/callback", appUrl).toString();

  const authorizeUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authorizeUrl.search = new URLSearchParams({
    client_id: apiKey,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  }).toString();

  const response = NextResponse.redirect(authorizeUrl.toString(), 302);
  response.cookies.set({
    name: "shopify_oauth_state",
    value: state,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 5,
  });

  return response;
}

