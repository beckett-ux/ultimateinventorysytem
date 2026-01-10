import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function normalizeShopParam(rawShop: string | null): string | null {
  if (!rawShop) return null;
  const shop = rawShop.trim().toLowerCase();
  if (!shop) return null;

  const shopRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.myshopify\.com$/;
  if (!shopRegex.test(shop)) return null;

  return shop;
}

export function middleware(request: NextRequest) {
  const acceptHeader = request.headers.get("accept") ?? "";
  if (!acceptHeader.includes("text/html")) {
    return NextResponse.next();
  }

  const shop = normalizeShopParam(request.nextUrl.searchParams.get("shop"));
  const cspValue = shop
    ? `frame-ancestors https://${shop} https://admin.shopify.com;`
    : "frame-ancestors 'none';";

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", cspValue);
  response.headers.delete("X-Frame-Options");
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

