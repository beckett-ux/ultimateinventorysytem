import { NextResponse } from "next/server";
import { fetchShopifyLocations } from "@/lib/shopifyAdmin";

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

    const result = await fetchShopifyLocations({ shopDomain: shop });

    if (result.status === 401) {
      return NextResponse.json(
        { error: "Shop is not installed", code: "not_installed" },
        { status: 401 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        {
          error: "Shopify API error",
          details: {
            errors: result.errors || [],
            userErrors: result.userErrors || [],
          },
        },
        { status: result.status >= 400 ? result.status : 502 }
      );
    }

    return NextResponse.json({ locations: result.locations }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
