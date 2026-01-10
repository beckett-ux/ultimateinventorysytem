import { NextResponse } from "next/server";
import { getShopify } from "@/lib/shopify";

export const runtime = "nodejs";

const determineErrorStatus = (error) => {
  const name = error?.name || "";
  if (
    name === "InvalidOAuthError" ||
    name === "InvalidHmacError" ||
    name === "InvalidShopError" ||
    name === "CookieNotFound"
  ) {
    return 400;
  }

  if (error?.code === "MISSING_ENV") {
    return 500;
  }

  return 500;
};

export async function GET(request) {
  try {
    const shopify = getShopify();
    const { session, headers } = await shopify.auth.callback({
      rawRequest: request,
    });

    await shopify.sessionStorage.storeSession(session);

    if (session?.shop && session?.accessToken) {
      const { upsertShop } = await import("@/lib/db");
      await upsertShop({ shopDomain: session.shop, accessToken: session.accessToken });
    }

    const redirectUrl = new URL("/", request.url);
    if (session?.shop) {
      redirectUrl.searchParams.set("shop", session.shop);
    }

    const response = NextResponse.redirect(redirectUrl.toString(), 302);
    for (const [key, value] of headers.entries()) {
      response.headers.append(key, value);
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unexpected error" },
      { status: determineErrorStatus(error) }
    );
  }
}

