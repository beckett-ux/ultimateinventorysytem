"use client";

import { useEffect, useMemo } from "react";

export default function ShopifyAuthRedirect({ shop, returnTo = "/app" }) {
  const installUrl = useMemo(() => {
    const url = new URL("/api/shopify/auth", window.location.origin);
    url.searchParams.set("shop", shop);
    url.searchParams.set("returnTo", returnTo);
    return url.toString();
  }, [shop, returnTo]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const target = window.top || window;
    target.location.assign(installUrl);
  }, [installUrl]);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ marginBottom: "0.75rem" }}>Authenticating…</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Redirecting to Shopify install.
      </p>
      <p style={{ marginTop: "1rem" }}>
        <a href={installUrl}>Continue</a>
      </p>
    </main>
  );
}

