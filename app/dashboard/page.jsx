import Link from "next/link";

import { loadOfflineSession } from "@/lib/shopify";
import { NavigateOutsideIframeOnMount } from "@/lib/navigateOutsideIframe";

export const dynamic = "force-dynamic";

const sanitizeShopDomain = (shop) =>
  (shop || "").trim().toLowerCase().replace(/^https?:\/\//i, "").replace(/\/+$/, "");

const isValidShopDomain = (shop) =>
  /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);

const buildQueryString = (searchParams) => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
      continue;
    }

    if (value != null) query.append(key, value);
  }

  return query.toString();
};

export default async function DashboardPage({ searchParams }) {
  const shop = sanitizeShopDomain(searchParams?.shop);
  const shopOk = shop && isValidShopDomain(shop);

  if (!shopOk) {
    return (
      <main className="intake-shell cardTight">
        <header className="intakeHeaderBar">
          <div />
          <div className="intakeHeaderCenter">
            <h1 className="intakeTitle">Dashboard</h1>
            <div className="intakeSub">STREET COMMERCE</div>
          </div>
          <div />
        </header>

        <section className="intake-section">
          <div className="section-heading">
            <div>
              <h2>Missing shop</h2>
              <p className="hint">Open from Shopify Admin (shop + host query params).</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const query = new URLSearchParams(buildQueryString(searchParams));
  query.set("shop", shop);
  if (!query.get("embedded")) query.set("embedded", "1");
  const queryString = query.toString();

  const intakeHref = queryString ? `/intake?${queryString}` : "/intake";
  const installHref = queryString ? `/api/shopify/auth?${queryString}` : "/api/shopify/auth";

  const { session } = shopOk ? await loadOfflineSession({ shop }) : { session: null };

  return (
    <main className="intake-shell cardTight">
      <header className="intakeHeaderBar">
        <div />
        <div className="intakeHeaderCenter">
          <h1 className="intakeTitle">Dashboard</h1>
          <div className="intakeSub">STREET COMMERCE</div>
        </div>
        <div />
      </header>

      <section className="intake-section">
        <div className="section-heading">
          <div>
            <h2>Inventory Intake</h2>
            {shop ? <p className="hint">{shop}</p> : null}
          </div>
        </div>

        {!session?.accessToken ? (
          <>
            <NavigateOutsideIframeOnMount url={installHref} replace />
            <p className="hint" style={{ marginTop: 0 }}>
              Checking shop connection…
            </p>
            <a
              className="primary-button"
              href={installHref}
              target="_top"
              rel="noopener noreferrer"
            >
              Continue
            </a>
          </>
        ) : (
          <Link className="primary-button" href={intakeHref}>
            Open Inventory Intake
          </Link>
        )}
      </section>
    </main>
  );
}
