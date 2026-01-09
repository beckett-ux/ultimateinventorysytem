import { NextResponse } from "next/server";

export const runtime = "nodejs";

const isValidShopDomain = (shop) =>
  /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);

const normalizeLocationId = (locationId) => {
  if (locationId === null || locationId === undefined) return null;
  const text = String(locationId).trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) return null;
  return text;
};

const notInstalledResponse = () =>
  NextResponse.json(
    { error: "Shop is not installed", code: "not_installed" },
    { status: 401 }
  );

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

    const { getShopAccessToken, getShopDefaultLocationId } = await import(
      "@/lib/db"
    );
    const accessToken = await getShopAccessToken(shop);
    if (!accessToken) {
      return notInstalledResponse();
    }

    const defaultLocationId = await getShopDefaultLocationId(shop);
    return NextResponse.json({ defaultLocationId }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    let body = {};
    try {
      body = (await request.json()) || {};
    } catch {
      body = {};
    }

    const shop = (body.shop || "").trim().toLowerCase();
    const locationId = normalizeLocationId(body.locationId);

    const missing = [];
    if (!shop) missing.push("shop");
    if (!locationId) missing.push("locationId");

    if (missing.length) {
      return NextResponse.json(
        { error: "Missing required body parameters", missing },
        { status: 400 }
      );
    }

    if (!isValidShopDomain(shop)) {
      return NextResponse.json({ error: "Invalid `shop` domain" }, { status: 400 });
    }

    const { getShopAccessToken, upsertShopDefaultLocationId } = await import(
      "@/lib/db"
    );
    const accessToken = await getShopAccessToken(shop);
    if (!accessToken) {
      return notInstalledResponse();
    }

    const defaultLocationId = await upsertShopDefaultLocationId({
      shopDomain: shop,
      locationId,
    });

    return NextResponse.json({ defaultLocationId }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

