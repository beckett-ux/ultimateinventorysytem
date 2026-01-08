"use client";

import { useMemo, useRef, useState } from "react";

import { approvedBrands } from "@/lib/approvedBrands";

const defaultForm = {
  brand: "",
  itemName: "",
  categoryPath: "",
  shopifyDescription: "",
  size: "",
  condition: "",
  cost: "",
  price: "",
  location: "dupont",
  vendorSource: "Store Purchase",
};

const categoryTree = [
  {
    label: "Mens",
    children: [
      {
        label: "Tops",
        children: ["T-Shirt", "Longsleeve", "Shirt", "Tank Top", "Jersey"],
      },
      {
        label: "Outerwear",
        children: [
          "Bombers",
          "Denim Jackets",
          "Leather Jackets",
          "Trench",
          "Light Jackets",
          "Heavy Jackets",
        ],
      },
      {
        label: "Bottoms",
        children: ["Jeans", "Sweatpants", "Chino", "Slacks", "Shorts"],
      },
      {
        label: "Shoes",
        children: ["Boots", "Sneakers", "Slip Ons", "Sandals"],
      },
      {
        label: "Accessories",
        children: ["Belts", "Wallets", "Hats", "Sunglasses"],
      },
      { label: "Tailoring", children: ["Suit", "Blazers"] },
    ],
  },
  {
    label: "Womens",
    children: [
      {
        label: "Tops",
        children: ["Blouse", "T-Shirt", "Knit", "Tank"],
      },
      {
        label: "Outerwear",
        children: ["Leather", "Trench", "Puffer", "Denim"],
      },
      {
        label: "Bottoms",
        children: ["Jeans", "Trousers", "Skirts", "Shorts"],
      },
      {
        label: "Shoes",
        children: ["Boots", "Heels", "Sneakers", "Flats"],
      },
      {
        label: "Accessories",
        children: ["Bags", "Belts", "Jewelry", "Sunglasses"],
      },
    ],
  },
  {
    label: "Collectibles",
    children: ["Specialty", "Archive", "Limited Edition"],
  },
];

const locationOptions = [
  { label: "DuPont Store", value: "dupont" },
  { label: "Charlotte Store", value: "charlotte" },
];

const vendorOptions = [
  "Store Purchase",
  "Consignment - Smith",
  "Consignment - Carter",
  "Consignment - Harper",
];

const conditionValues = Array.from({ length: 21 }, (_, index) => {
  const value = (index * 0.5).toFixed(1);
  return value.endsWith(".0") ? value.replace(".0", "") : value;
});

const flattenCategories = (nodes, parents = []) =>
  nodes.flatMap((node) => {
    const label = typeof node === "string" ? node : node.label;
    const children = typeof node === "string" ? [] : node.children;
    const nextParents = [...parents, label];

    if (!children || children.length === 0) {
      return [{ label, path: nextParents.join(" › ") }];
    }

    return flattenCategories(children, nextParents);
  });

export default function Home() {
  const [form, setForm] = useState(defaultForm);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [brandLocked, setBrandLocked] = useState(false);

  const itemNameRef = useRef(null);
  const brandInputRef = useRef(null);

  const categoryOptions = useMemo(() => flattenCategories(categoryTree), []);

  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) {
      return categoryOptions;
    }
    return categoryOptions.filter((option) =>
      option.path.toLowerCase().includes(query)
    );
  }, [categoryOptions, categorySearch]);

  const brandSuggestion = useMemo(() => {
    if (!form.brand) {
      return "";
    }
    const normalized = form.brand.toLowerCase();
    return (
      approvedBrands.find((brand) => brand.toLowerCase().startsWith(normalized)) ||
      ""
    );
  }, [form.brand]);

  const ghostRemainder = useMemo(() => {
    if (!brandSuggestion) {
      return "";
    }
    return brandSuggestion.slice(form.brand.length);
  }, [brandSuggestion, form.brand]);

  const titlePreview = useMemo(() => {
    const parts = [form.brand, form.itemName]
      .map((value) => value.trim())
      .filter(Boolean);
    return parts.length ? parts.join(" ") : "";
  }, [form.brand, form.itemName]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleBrandKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== "Tab") {
      return;
    }
    event.preventDefault();

    if (brandSuggestion) {
      setForm((prev) => ({ ...prev, brand: brandSuggestion }));
      setBrandLocked(true);
    } else if (form.brand.trim()) {
      setBrandLocked(true);
    }

    itemNameRef.current?.focus();
  };

  const handleCategorySelect = (path) => {
    setForm((prev) => ({ ...prev, categoryPath: path }));
    setCategoryOpen(false);
  };

  const handleBrandEdit = () => {
    setBrandLocked(false);
    requestAnimationFrame(() => {
      brandInputRef.current?.focus();
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setError(null);
    setPreview(null);

    try {
      const response = await fetch("/api/intake/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Unable to validate intake payload");
      }

      setPreview(data);
      setStatus("success");
    } catch (submitError) {
      setStatus("error");
      setError(submitError.message);
    }
  };

  return (
    <main className="intake-shell">
      <header className="intake-header">
        <div>
          <span className="intake-kicker">Inventory Intake</span>
          <h1>New product intake</h1>
          <p>
            A single-page workflow designed for fast, keyboard-first entry with
            instant validation.
          </p>
        </div>
        <div className="intake-status">
          <span>Draft saved automatically</span>
        </div>
      </header>

      <div className="intake-layout">
        <form onSubmit={handleSubmit} className="intake-form">
          <section className="intake-section spotlight-section">
            <div className="section-heading">
              <div>
                <h2>Start with brand</h2>
                <p>Type to autocomplete. Enter locks the brand and moves on.</p>
              </div>
              {brandLocked && (
                <button
                  type="button"
                  className="text-button"
                  onClick={handleBrandEdit}
                >
                  Edit
                </button>
              )}
            </div>
            <div className="spotlight-field">
              <div className="spotlight-ghost" aria-hidden="true">
                <span className="ghost-typed">{form.brand}</span>
                <span>{ghostRemainder}</span>
              </div>
              <input
                ref={brandInputRef}
                name="brand"
                value={form.brand}
                onChange={handleChange}
                onKeyDown={handleBrandKeyDown}
                placeholder="Start typing a brand"
                autoComplete="off"
                readOnly={brandLocked}
              />
            </div>
            {brandSuggestion && !brandLocked && (
              <span className="hint">Press Enter to accept {brandSuggestion}.</span>
            )}
            {!brandSuggestion && form.brand && !brandLocked && (
              <span className="hint">New brand? Press Enter to add it.</span>
            )}
          </section>

          <section className="intake-section">
            <div className="section-heading">
              <div>
                <h2>Core identity</h2>
                <p>Everything needed for the product title and category path.</p>
              </div>
            </div>
            <div className="field-grid three">
              <label className="field">
                <span>Item name</span>
                <input
                  ref={itemNameRef}
                  name="itemName"
                  value={form.itemName}
                  onChange={handleChange}
                  placeholder="Pony Hair Ramones"
                />
              </label>
              <label className="field">
                <span>Category</span>
                <button
                  type="button"
                  className="dropdown-trigger"
                  onClick={() => setCategoryOpen((prev) => !prev)}
                >
                  {form.categoryPath || "Choose a category"}
                </button>
                {categoryOpen && (
                  <div className="dropdown-panel">
                    <input
                      value={categorySearch}
                      onChange={(event) => setCategorySearch(event.target.value)}
                      placeholder="Search categories"
                    />
                    <div className="dropdown-list">
                      {filteredCategories.map((option) => (
                        <button
                          key={option.path}
                          type="button"
                          onClick={() => handleCategorySelect(option.path)}
                        >
                          <span>{option.path}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </label>
              <label className="field">
                <span>Item size</span>
                <input
                  name="size"
                  value={form.size}
                  onChange={handleChange}
                  placeholder="IT 40"
                />
              </label>
            </div>
          </section>

          <section className="intake-section">
            <div className="section-heading">
              <div>
                <h2>Product details</h2>
                <p>Capture condition and description once the basics are in.</p>
              </div>
            </div>
            <div className="field-grid two">
              <label className="field">
                <span>Shopify description</span>
                <textarea
                  name="shopifyDescription"
                  value={form.shopifyDescription}
                  onChange={handleChange}
                  placeholder="Short description for the listing."
                />
              </label>
              <div className="field condition-field">
                <span>Item condition</span>
                <div className="condition-values">
                  {conditionValues.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={
                        form.condition === value ? "is-selected" : undefined
                      }
                      onClick={() =>
                        setForm((prev) => ({ ...prev, condition: value }))
                      }
                    >
                      {value}/10
                    </button>
                  ))}
                </div>
                <div className="condition-slider">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={form.condition || "0"}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        condition: event.target.value,
                      }))
                    }
                  />
                  <input
                    name="condition"
                    value={form.condition}
                    onChange={handleChange}
                    placeholder="8.5"
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="intake-section">
            <div className="section-heading">
              <div>
                <h2>Pricing & ownership</h2>
                <p>Enter financials and who the item belongs to.</p>
              </div>
            </div>
            <div className="field-grid three">
              <label className="field">
                <span>Intake cost</span>
                <input
                  name="cost"
                  value={form.cost}
                  onChange={handleChange}
                  placeholder="$250"
                />
              </label>
              <label className="field">
                <span>Sell price</span>
                <input
                  name="price"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="$695"
                />
              </label>
              <label className="field">
                <span>Consignee / Vendor</span>
                <input
                  name="vendorSource"
                  value={form.vendorSource}
                  onChange={handleChange}
                  list="vendor-options"
                />
              </label>
            </div>
          </section>

          <section className="intake-section">
            <div className="section-heading">
              <div>
                <h2>Location</h2>
                <p>Select the store location for this intake.</p>
              </div>
            </div>
            <div className="segmented">
              {locationOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    form.location === option.value ? "is-selected" : undefined
                  }
                  onClick={() =>
                    setForm((prev) => ({ ...prev, location: option.value }))
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <div className="sticky-actions">
            <button type="submit" disabled={status === "loading"}>
              {status === "loading" ? "Saving..." : "Save intake"}
            </button>
            {status === "success" && (
              <span className="success">Saved & validated</span>
            )}
            {status === "error" && <span className="error">{error}</span>}
          </div>
        </form>

        <aside className="intake-summary">
          <div className="summary-card">
            <span className="summary-label">Live title</span>
            <strong>{titlePreview || "Brand + Item Name"}</strong>
            <div className="summary-row">
              <span>Category</span>
              <strong>{form.categoryPath || "Pick a category"}</strong>
            </div>
            <div className="summary-row">
              <span>Condition</span>
              <strong>{form.condition ? `${form.condition}/10` : "--"}</strong>
            </div>
          </div>
          <div className="summary-card">
            <span className="summary-label">Pricing</span>
            <div className="summary-row">
              <span>Cost</span>
              <strong>{form.cost || "--"}</strong>
            </div>
            <div className="summary-row">
              <span>Sell price</span>
              <strong>{form.price || "--"}</strong>
            </div>
            <div className="summary-row">
              <span>Consignee</span>
              <strong>{form.vendorSource || "--"}</strong>
            </div>
          </div>
          {preview && (
            <details className="summary-code">
              <summary>View normalized payload</summary>
              <pre>{JSON.stringify(preview, null, 2)}</pre>
            </details>
          )}
        </aside>
      </div>

      <datalist id="vendor-options">
        {vendorOptions.map((vendor) => (
          <option key={vendor} value={vendor} />
        ))}
      </datalist>
    </main>
  );
}
