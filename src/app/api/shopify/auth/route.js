import { NextResponse } from "next/server";
import { getShopify, tryGetShopifyAppUrlOrigin } from "@/lib/shopify";

export const runtime = "nodejs";

const CALLBACK_PATH = "/api/shopify/callback";
const SHOPIFY_OAUTH_BEGIN_EVENT = "shopify_oauth_begin";

const isValidShopDomain = (shop) =>
  /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);

const isObviouslyLocalOrigin = (origin) => {
  if (!origin) return true;

  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".localhost")
    );
  } catch {
    return true;
  }
};

const resolveRedirectOrigin = ({ requestUrl }) => {
  const vercelEnvRaw = (process.env.VERCEL_ENV || "").trim().toLowerCase();
  const nodeEnvRaw = (process.env.NODE_ENV || "").trim().toLowerCase();

  const isPreview = vercelEnvRaw === "preview";
  const isProduction =
    vercelEnvRaw === "production" || (!vercelEnvRaw && nodeEnvRaw === "production");

  const env = isPreview ? "preview" : isProduction ? "production" : "development";

  const canonicalOrigin = tryGetShopifyAppUrlOrigin();
  const requestOrigin = new URL(requestUrl).origin;

  if (isPreview) {
    return {
      env,
      canonicalOrigin,
      requestOrigin,
      chosenOrigin: canonicalOrigin,
      reason: "preview_always_canonical",
    };
  }

  if (isProduction) {
    if (canonicalOrigin && !isObviouslyLocalOrigin(canonicalOrigin)) {
      return {
        env,
        canonicalOrigin,
        requestOrigin,
        chosenOrigin: canonicalOrigin,
        reason: "production_canonical_valid",
      };
    }

    return {
      env,
      canonicalOrigin,
      requestOrigin,
      chosenOrigin: requestOrigin,
      reason: canonicalOrigin ? "production_canonical_local" : "production_missing_canonical",
    };
  }

  if (canonicalOrigin) {
    return {
      env,
      canonicalOrigin,
      requestOrigin,
      chosenOrigin: canonicalOrigin,
      reason: "dev_canonical_present",
    };
  }

  return {
    env,
    canonicalOrigin,
    requestOrigin,
    chosenOrigin: requestOrigin,
    reason: "dev_missing_canonical",
  };
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const shop = (searchParams.get("shop") || "").trim().toLowerCase();
  const hasHost = Boolean((searchParams.get("host") || "").trim());
  const isDebug = (searchParams.get("debug") || "").trim() === "1";

  if (!shop) {
    return NextResponse.json(
      { error: "Missing `shop` query parameter" },
      { status: 400 }
    );
  }

  if (!isValidShopDomain(shop)) {
    return NextResponse.json({ error: "Invalid `shop` domain" }, { status: 400 });
  }

  const originDecision = resolveRedirectOrigin({ requestUrl: request.url });

  if (isDebug) {
    const redirectUri = originDecision.chosenOrigin
      ? new URL(CALLBACK_PATH, originDecision.chosenOrigin).toString()
      : null;

    const payload = {
      vercelEnv: process.env.VERCEL_ENV || null,
      chosenOrigin: originDecision.chosenOrigin,
      requestOrigin: originDecision.requestOrigin,
      callbackPath: CALLBACK_PATH,
      redirectUri,
    };

    if (originDecision.canonicalOrigin) {
      payload.canonicalOrigin = originDecision.canonicalOrigin;
    }

    return NextResponse.json(payload);
  }

  try {
    const shopifyAppUrl = process.env.SHOPIFY_APP_URL || null;
    const { env, canonicalOrigin, requestOrigin, chosenOrigin, reason } = originDecision;

    if (!chosenOrigin) {
      return NextResponse.json(
        {
          error: "SHOPIFY_APP_URL must be a valid URL in Preview environments",
          shop,
          hasHost,
          vercelEnv: process.env.VERCEL_ENV || null,
          nodeEnv: process.env.NODE_ENV || null,
          shopifyAppUrl,
        },
        { status: 500 }
      );
    }

    const shopify = getShopify();
    const redirectUri = new URL(CALLBACK_PATH, chosenOrigin).toString();

    console.info(
      JSON.stringify({
        event: SHOPIFY_OAUTH_BEGIN_EVENT,
        env,
        shop,
        hasHost,
        callbackPath: CALLBACK_PATH,
        canonicalOrigin,
        requestOrigin,
        chosenOrigin,
        chosenOriginReason: reason,
        redirectUri,
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
        authUrl.searchParams.set("redirect_uri", redirectUri);
        response.headers.set("location", authUrl.toString());
      } catch {
        /* ignore invalid Location */
      }
    }

    return response;
  } catch (error) {
    const shopifyAppUrl = process.env.SHOPIFY_APP_URL || null;
    let diagnostics = null;

    try {
      const { env, canonicalOrigin, requestOrigin, chosenOrigin, reason } =
        resolveRedirectOrigin({ requestUrl: request.url });

      diagnostics = {
        env,
        callbackPath: CALLBACK_PATH,
        canonicalOrigin,
        requestOrigin,
        chosenOrigin,
        chosenOriginReason: reason,
        redirectUri: chosenOrigin ? new URL(CALLBACK_PATH, chosenOrigin).toString() : null,
      };
    } catch {
      /* ignore diagnostics computation errors */
    }

    return NextResponse.json(
      {
        error: error?.message || "Shopify OAuth is not configured",
        shop,
        hasHost,
        shopifyAppUrl,
        ...(diagnostics || {}),
      },
      { status: 500 }
    );
  }
}

