import { NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const isValidShopDomain = (shop) =>
  /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);

const buildHmacMessage = (searchParams) => {
  const entries = Array.from(searchParams.entries()).filter(
    ([key]) => key !== "hmac" && key !== "signature"
  );

  entries.sort(([aKey, aValue], [bKey, bValue]) => {
    const keyCompare = aKey.localeCompare(bKey);
    if (keyCompare !== 0) return keyCompare;
    return aValue.localeCompare(bValue);
  });

  return entries
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
};

const timingSafeEqualHex = (a, b) => {
  if (!a || !b) return false;
  const aBuffer = Buffer.from(a, "utf8");
  const bBuffer = Buffer.from(b, "utf8");
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
};

const isValidShopifyHmac = ({ searchParams, secret, providedHmac }) => {
  const message = buildHmacMessage(searchParams);
  const digest = crypto.createHmac("sha256", secret).update(message).digest("hex");
  return timingSafeEqualHex(digest, providedHmac);
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const shop = (searchParams.get("shop") || "").trim().toLowerCase();
    const code = (searchParams.get("code") || "").trim();
    const state = (searchParams.get("state") || "").trim();
    const hmac = (searchParams.get("hmac") || "").trim();

    const missing = [];
    if (!shop) missing.push("shop");
    if (!code) missing.push("code");
    if (!state) missing.push("state");
    if (!hmac) missing.push("hmac");

    if (missing.length) {
      return NextResponse.json(
        { error: "Missing required query parameters", missing },
        { status: 400 }
      );
    }

    if (!isValidShopDomain(shop)) {
      return NextResponse.json({ error: "Invalid `shop` domain" }, { status: 400 });
    }

    const stateCookie = request.cookies.get("shopify_oauth_state")?.value;
    if (!stateCookie || stateCookie !== state) {
      return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
    }

    const apiKey = process.env.SHOPIFY_API_KEY;
    const apiSecret = process.env.SHOPIFY_API_SECRET;
    if (!apiKey || !apiSecret) {
      return NextResponse.json(
        { error: "Shopify OAuth is not configured" },
        { status: 500 }
      );
    }

    if (!isValidShopifyHmac({ searchParams, secret: apiSecret, providedHmac: hmac })) {
      return NextResponse.json(
        { error: "Invalid Shopify callback signature" },
        { status: 400 }
      );
    }

    const tokenResponse = await fetch(
      `https://${shop}/admin/oauth/access_token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: apiKey,
          client_secret: apiSecret,
          code,
        }),
      }
    );

    let tokenJson = null;
    try {
      tokenJson = await tokenResponse.json();
    } catch {
      tokenJson = null;
    }

    const accessToken = tokenJson?.access_token;
    if (!tokenResponse.ok || !accessToken) {
      return NextResponse.json(
        {
          error: "Token exchange failed",
          details: tokenJson?.error_description || tokenJson?.error || null,
        },
        { status: 502 }
      );
    }

    const { upsertShop } = await import("@/lib/db");
    await upsertShop({ shopDomain: shop, accessToken });

    const redirectUrl = new URL("/", request.url);
    redirectUrl.searchParams.set("shop", shop);
    const response = NextResponse.redirect(redirectUrl.toString(), 302);
    response.cookies.set({
      name: "shopify_oauth_state",
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
