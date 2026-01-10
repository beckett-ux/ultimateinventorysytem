import IntakePage from "../intake/page";
import ShopifyAuthRedirect from "./shopify-auth-redirect";

import { loadOfflineSession } from "@/lib/shopify";

const sanitizeShopDomain = (shop) =>
  (shop || "").trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/\/+$/, "");

const isValidShopDomain = (shop) =>
  /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);

export default async function EmbeddedAppPage({ searchParams }) {
  const shop = sanitizeShopDomain(searchParams?.shop);

  if (!shop || !isValidShopDomain(shop)) {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
        <h1 style={{ marginBottom: "0.75rem" }}>Missing shop</h1>
        <p style={{ marginTop: 0, color: "#555" }}>
          Open this page from Shopify Admin (it supplies <code>shop</code> and{" "}
          <code>host</code>).
        </p>
      </main>
    );
  }

  const { session } = await loadOfflineSession({ shop });

  if (!session?.accessToken) {
    return <ShopifyAuthRedirect shop={shop} returnTo="/app" />;
  }

  return <IntakePage />;
}

