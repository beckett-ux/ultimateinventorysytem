"use client";

import { useEffect, useMemo, useState } from "react";
import { Provider as AppBridgeProvider } from "@shopify/app-bridge-react";

export default function ShopifyAppBridgeProvider({ children }) {
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  const [host, setHost] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setHost(params.get("host"));
  }, []);

  const config = useMemo(() => {
    if (!apiKey || !host) return null;
    return { apiKey, host, forceRedirect: true };
  }, [apiKey, host]);

  if (!config) {
    return children;
  }

  return <AppBridgeProvider config={config}>{children}</AppBridgeProvider>;
}
