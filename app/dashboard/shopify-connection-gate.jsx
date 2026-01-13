"use client";

import { useEffect, useState } from "react";

import { navigateOutsideIframe } from "@/lib/navigateOutsideIframe";

export default function ShopifyConnectionGate({
  installHref,
  debugHref,
  timeoutMs = 2500,
}) {
  const [showActions, setShowActions] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowActions(true), timeoutMs);
    return () => clearTimeout(timer);
  }, [timeoutMs]);

  if (!showActions) {
    return (
      <p className="hint" style={{ marginTop: 0 }}>
        Checking shop connection...
      </p>
    );
  }

  return (
    <>
      <p className="hint" style={{ marginTop: 0 }}>
        Connection needs action.
      </p>
      <a
        className="primary-button"
        href={installHref}
        onClick={(event) => {
          event.preventDefault();
          navigateOutsideIframe(installHref);
        }}
      >
        Continue to connect
      </a>
      <p className="hint" style={{ marginTop: "0.75rem" }}>
        <a href={debugHref}>Debug connection</a>
      </p>
    </>
  );
}

