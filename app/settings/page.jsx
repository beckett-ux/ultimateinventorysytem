"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { navigateOutsideIframe } from "@/lib/navigateOutsideIframe";

const extractNumericLocationId = (gid) => {
  if (!gid) return null;
  const match = String(gid).match(/\/(\d+)$/);
  return match ? match[1] : null;
};

const parseJson = async (response) => {
  try {
    return (await response.json()) || {};
  } catch {
    return {};
  }
};

function SettingsContent() {
  const searchParams = useSearchParams();

  const shop = useMemo(
    () => (searchParams.get("shop") || "").trim().toLowerCase(),
    [searchParams]
  );

  const [locations, setLocations] = useState([]);
  const [defaultLocationId, setDefaultLocationId] = useState(null);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (!shop) {
      setLocations([]);
      setDefaultLocationId(null);
      setSelectedLocationId("");
      setStatus("idle");
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setStatus("loading");
      setError(null);
      setSaveStatus("idle");
      setSaveError(null);

      try {
        const [locationsResponse, defaultResponse] = await Promise.all([
          fetch(`/api/shopify/locations?shop=${encodeURIComponent(shop)}`),
          fetch(
            `/api/shopify/settings/default-location?shop=${encodeURIComponent(
              shop
            )}`
          ),
        ]);

        const locationsPayload = await parseJson(locationsResponse);
        const defaultPayload = await parseJson(defaultResponse);

        if (locationsResponse.status === 401 || defaultResponse.status === 401) {
          throw new Error("Shop is not installed.");
        }

        if (!locationsResponse.ok) {
          throw new Error(
            locationsPayload?.error ||
              `Failed to load locations (${locationsResponse.status})`
          );
        }

        if (!defaultResponse.ok) {
          throw new Error(
            defaultPayload?.error ||
              `Failed to load default location (${defaultResponse.status})`
          );
        }

        const normalizedLocations = Array.isArray(locationsPayload?.locations)
          ? locationsPayload.locations
              .map((location) => {
                const id = extractNumericLocationId(location?.id);
                const name = location?.name;
                if (!id || !name) return null;
                return { id, name };
              })
              .filter(Boolean)
          : [];

        const normalizedDefaultLocationId =
          defaultPayload?.defaultLocationId === null ||
          defaultPayload?.defaultLocationId === undefined
            ? null
            : String(defaultPayload.defaultLocationId);

        if (cancelled) return;

        setLocations(normalizedLocations);
        setDefaultLocationId(normalizedDefaultLocationId);

        const nextSelected =
          normalizedDefaultLocationId ||
          normalizedLocations[0]?.id ||
          "";
        setSelectedLocationId(nextSelected);

        setStatus("ready");
      } catch (loadError) {
        if (cancelled) return;
        setStatus("error");
        setError(loadError?.message || "Failed to load settings.");
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [shop]);

  const handleSave = async () => {
    if (!shop || !selectedLocationId) return;

    setSaveStatus("saving");
    setSaveError(null);

    try {
      const response = await fetch("/api/shopify/settings/default-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shop, locationId: selectedLocationId }),
      });

      const payload = await parseJson(response);

      if (response.status === 401) {
        throw new Error("Shop is not installed.");
      }

      if (!response.ok) {
        throw new Error(payload?.error || `Save failed (${response.status})`);
      }

      const savedLocationId =
        payload?.defaultLocationId === null || payload?.defaultLocationId === undefined
          ? null
          : String(payload.defaultLocationId);

      setDefaultLocationId(savedLocationId);
      setSelectedLocationId(savedLocationId || selectedLocationId);
      setSaveStatus("success");
    } catch (saveErr) {
      setSaveStatus("error");
      setSaveError(saveErr?.message || "Save failed.");
    }
  };

  if (!shop) {
    return (
      <main className="intake-shell cardTight">
        <header className="intakeHeaderBar">
          <div />
          <div className="intakeHeaderCenter">
            <h1 className="intakeTitle">Settings</h1>
            <div className="intakeSub">STREET COMMERCE</div>
          </div>
          <div />
        </header>

        <section className="intake-section">
          <div className="section-heading">
            <div>
              <h2>Missing shop</h2>
              <p className="hint">
                Add <code>?shop=example.myshopify.com</code> to the URL.
              </p>
            </div>
          </div>
          <Link className="text-button" href="/">
            Back to intake
          </Link>
        </section>
      </main>
    );
  }

  const installUrl = `/api/shopify/auth?shop=${encodeURIComponent(shop)}`;
  const intakeUrl = `/?shop=${encodeURIComponent(shop)}`;

  return (
    <main className="intake-shell cardTight">
      <header className="intakeHeaderBar">
        <div />
        <div className="intakeHeaderCenter">
          <h1 className="intakeTitle">Settings</h1>
          <div className="intakeSub">STREET COMMERCE</div>
        </div>
        <div />
      </header>

      <section className="intake-section">
        <div className="section-heading">
          <div>
            <h2>Default location</h2>
            <p className="hint">{shop}</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link className="text-button" href={intakeUrl}>
            Back to intake
          </Link>
          <a
            className="text-button"
            href={installUrl}
            onClick={(event) => {
              event.preventDefault();
              navigateOutsideIframe(installUrl);
            }}
          >
            Install app
          </a>
        </div>

        {status === "loading" && <p className="hint">Loading…</p>}
        {status === "error" && <div className="error">{error}</div>}

        {status === "ready" && (
          <>
            {locations.length === 0 ? (
              <div className="error">No locations found for this shop.</div>
            ) : (
              <div className="field">
                <label className="fieldLabel" htmlFor="default-location">
                  Default location
                </label>
                <select
                  id="default-location"
                  className="fieldInput"
                  value={selectedLocationId}
                  onChange={(e) => {
                    setSelectedLocationId(e.target.value);
                    setSaveStatus("idle");
                    setSaveError(null);
                  }}
                >
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
                {defaultLocationId && (
                  <p className="hint">Current default: {defaultLocationId}</p>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button
                type="button"
                className="primary-button"
                disabled={
                  saveStatus === "saving" ||
                  !selectedLocationId ||
                  selectedLocationId === String(defaultLocationId ?? "")
                }
                onClick={handleSave}
              >
                {saveStatus === "saving" ? "Saving…" : "Save"}
              </button>

              {saveStatus === "success" && (
                <span className="success">Saved</span>
              )}
              {saveStatus === "error" && (
                <span className="error">{saveError}</span>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <main className="intake-shell cardTight">
          <header className="intakeHeaderBar">
            <div />
            <div className="intakeHeaderCenter">
              <h1 className="intakeTitle">Settings</h1>
              <div className="intakeSub">STREET COMMERCE</div>
            </div>
            <div />
          </header>

          <section className="intake-section">
            <div className="section-heading">
              <div>
                <h2>Loading</h2>
                <p className="hint">Preparing settings…</p>
              </div>
            </div>
          </section>
        </main>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
