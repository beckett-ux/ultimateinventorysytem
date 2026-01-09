import { NextResponse } from "next/server";

export const runtime = "nodejs";

const isValidShopDomain = (shop) =>
  /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);

export async function GET(request) {
  try {
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

    const { getShopAccessToken } = await import("@/lib/db");
    const accessToken = await getShopAccessToken(shop);

    return NextResponse.json({ installed: Boolean(accessToken) }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

