"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  vendorSource: "Street Commerce",
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

const fallbackVendorOptions = [
  "Street Commerce",
  "Store Purchase",
  "Consignment - Smith",
  "Consignment - Carter",
  "Consignment - Harper",
];

const formatConditionValue = (value) => {
  const normalized = Number.parseFloat(value);
  if (Number.isNaN(normalized)) {
    return "";
  }
  const formatted = normalized.toFixed(1);
  return formatted.endsWith(".0") ? formatted.replace(".0", "") : formatted;
};

const normalizeCategoryNode = (node) => {
  if (typeof node === "string") {
    return { label: node, children: [node] };
  }
  return {
    label: node.label,
    children: (node.children || []).map((child) =>
      typeof child === "string"
        ? { label: child, children: [child] }
        : {
            label: child.label,
            children: child.children?.length ? child.children : [child.label],
          }
    ),
  };
};

const parseCategoryPath = (path) =>
  path
    .split(/›|>/)
    .map((part) => part.trim())
    .filter(Boolean);

const buildCategoryPath = (parts) =>
  parts.filter(Boolean).join(" > ");

const parseCsv = (content) => {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];

    if (char === '"') {
      if (inQuotes && content[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && content[index + 1] === "\n") {
        index += 1;
      }
      row.push(value);
      if (row.some((cell) => cell.trim())) {
        rows.push(row);
      }
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value || row.length) {
    row.push(value);
    if (row.some((cell) => cell.trim())) {
      rows.push(row);
    }
  }

  return rows;
};

export default function Home() {
  const [form, setForm] = useState(defaultForm);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryStep, setCategoryStep] = useState("gender");
  const [categorySelection, setCategorySelection] = useState({
    gender: categoryTree[0]?.label || "",
    category: "",
  });
  const [brandLocked, setBrandLocked] = useState(false);
  const [vendorOptions, setVendorOptions] = useState(fallbackVendorOptions);

  const itemNameRef = useRef(null);
  const brandInputRef = useRef(null);
  const vendorInputRef = useRef(null);

  const normalizedCategories = useMemo(
    () => categoryTree.map(normalizeCategoryNode),
    []
  );

  const selectedGender = useMemo(
    () =>
      normalizedCategories.find(
        (gender) => gender.label === categorySelection.gender
      ) || normalizedCategories[0],
    [normalizedCategories, categorySelection.gender]
  );

  const selectedCategory = useMemo(() => {
    if (!selectedGender) {
      return null;
    }
    return (
      selectedGender.children.find(
        (category) => category.label === categorySelection.category
      ) || selectedGender.children[0]
    );
  }, [selectedGender, categorySelection.category]);

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

  const vendorSuggestion = useMemo(() => {
    if (!form.vendorSource) {
      return "";
    }
    const normalized = form.vendorSource.toLowerCase();
    return (
      vendorOptions.find((vendor) =>
        vendor.toLowerCase().startsWith(normalized)
      ) || ""
    );
  }, [form.vendorSource, vendorOptions]);

  const vendorGhostRemainder = useMemo(() => {
    if (!vendorSuggestion) {
      return "";
    }
    return vendorSuggestion.slice(form.vendorSource.length);
  }, [vendorSuggestion, form.vendorSource]);

  const titlePreview = useMemo(() => {
    const parts = [form.brand, form.itemName]
      .map((value) => value.trim())
      .filter(Boolean);
    return parts.length ? parts.join(" ") : "";
  }, [form.brand, form.itemName]);

  const descriptionPreview = useMemo(() => {
    if (!form.shopifyDescription) {
      return "Add a description to preview the Shopify listing.";
    }
    const trimmed = form.shopifyDescription.trim();
    return trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed;
  }, [form.shopifyDescription]);

  const locationLabel = useMemo(() => {
    return (
      locationOptions.find((option) => option.value === form.location)?.label ||
      form.location
    );
  }, [form.location]);

  const conditionProgress = useMemo(() => {
    const value = Number.parseFloat(form.condition || "0");
    if (Number.isNaN(value)) {
      return 0;
    }
    return Math.min(100, Math.max(0, (value / 10) * 100));
  }, [form.condition]);

  useEffect(() => {
    const sheetId = process.env.NEXT_PUBLIC_VENDOR_SHEET_ID;
    if (!sheetId) {
      return;
    }
    const sheetName = process.env.NEXT_PUBLIC_VENDOR_SHEET_TAB || "Sheet1";
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
      sheetName
    )}`;

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to fetch vendor sheet");
        }
        return response.text();
      })
      .then((text) => {
        const rows = parseCsv(text);
        const vendors = rows
          .flat()
          .map((cell) => cell.trim())
          .filter(Boolean);
        if (vendors.length) {
          const uniqueVendors = Array.from(new Set(vendors));
          if (!uniqueVendors.includes(defaultForm.vendorSource)) {
            uniqueVendors.unshift(defaultForm.vendorSource);
          }
          setVendorOptions(uniqueVendors);
        }
      })
      .catch(() => {
        setVendorOptions(fallbackVendorOptions);
      });
  }, []);

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

  const handleCategorySelect = ({ gender, category, subcategory }) => {
    setForm((prev) => ({
      ...prev,
      categoryPath: buildCategoryPath([gender, category, subcategory]),
    }));
    setCategoryOpen(false);
    setCategoryStep("gender");
  };

  const handleBrandEdit = () => {
    setBrandLocked(false);
    requestAnimationFrame(() => {
      brandInputRef.current?.focus();
    });
  };

  const handleVendorKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== "Tab") {
      return;
    }
    event.preventDefault();

    if (vendorSuggestion) {
      setForm((prev) => ({ ...prev, vendorSource: vendorSuggestion }));
    }
  };

  const handleCategoryOpen = () => {
    setCategoryOpen((prev) => {
      const next = !prev;
      if (next) {
        const [gender, category] = parseCategoryPath(form.categoryPath);
        setCategorySelection((current) => ({
          gender: gender || current.gender || categoryTree[0]?.label || "",
          category: category || current.category || "",
        }));
        setCategoryStep("gender");
      }
      return next;
    });
  };

  const handleConditionChange = (event) => {
    const formatted = formatConditionValue(event.target.value);
    setForm((prev) => ({ ...prev, condition: formatted }));
  };

  const formatCurrencyInput = (value) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    if (!cleaned) {
      return "";
    }
    const parts = cleaned.split(".");
    const normalized = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join("")}` : parts[0];
    return `$${normalized}`;
  };

  const handleCurrencyChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: formatCurrencyInput(value) }));
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
                <div className="category-picker">
                  <button
                    type="button"
                    className="dropdown-trigger"
                    onClick={handleCategoryOpen}
                  >
                    {form.categoryPath || "Choose a category"}
                  </button>
                  {categoryOpen && (
                    <div className="dropdown-panel category-panel">
                      <div className="category-step-header">
                        {categoryStep !== "gender" && (
                          <button
                            type="button"
                            className="category-back"
                            onClick={() =>
                              setCategoryStep((prev) =>
                                prev === "subcategory" ? "category" : "gender"
                              )
                            }
                          >
                            Back
                          </button>
                        )}
                        <div>
                          <span className="category-label">Step</span>
                          <strong>
                            {categoryStep === "gender"
                              ? "Choose gender"
                              : categoryStep === "category"
                              ? "Choose category"
                              : "Choose subcategory"}
                          </strong>
                        </div>
                      </div>
                      <div className="category-step-list">
                        {categoryStep === "gender" &&
                          normalizedCategories.map((gender) => (
                            <button
                              key={gender.label}
                              type="button"
                              className={
                                categorySelection.gender === gender.label
                                  ? "is-selected"
                                  : undefined
                              }
                              onClick={() => {
                                setCategorySelection({
                                  gender: gender.label,
                                  category: "",
                                });
                                setCategoryStep("category");
                              }}
                            >
                              {gender.label}
                            </button>
                          ))}
                        {categoryStep === "category" &&
                          selectedGender?.children.map((category) => (
                            <button
                              key={category.label}
                              type="button"
                              className={
                                categorySelection.category === category.label
                                  ? "is-selected"
                                  : undefined
                              }
                              onClick={() => {
                                setCategorySelection((prev) => ({
                                  ...prev,
                                  category: category.label,
                                }));
                                setCategoryStep("subcategory");
                              }}
                            >
                              {category.label}
                            </button>
                          ))}
                        {categoryStep === "subcategory" &&
                          selectedCategory?.children.map((subcategory) => (
                            <button
                              key={subcategory}
                              type="button"
                              onClick={() =>
                                handleCategorySelect({
                                  gender: selectedGender?.label,
                                  category: selectedCategory?.label,
                                  subcategory,
                                })
                              }
                            >
                              {subcategory}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
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
                <div className="condition-slider">
                  <span className="condition-value">
                    Condition: {form.condition || "0"}/10
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={form.condition || 0}
                    onChange={handleConditionChange}
                    style={{
                      background: `linear-gradient(90deg, #111827 ${conditionProgress}%, #cbd5f5 ${conditionProgress}%)`,
                    }}
                  />
                  <div className="condition-scale">
                    <span>0</span>
                    <span>2.5</span>
                    <span>5</span>
                    <span>7.5</span>
                    <span>10</span>
                  </div>
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
                  onChange={handleCurrencyChange}
                  placeholder="$250"
                />
              </label>
              <label className="field">
                <span>Sell price</span>
                <input
                  name="price"
                  value={form.price}
                  onChange={handleCurrencyChange}
                  placeholder="$695"
                />
              </label>
              <label className="field">
                <span>Consignee / Vendor</span>
                <div className="spotlight-field compact">
                  <div className="spotlight-ghost" aria-hidden="true">
                    <span className="ghost-typed">{form.vendorSource}</span>
                    <span>{vendorGhostRemainder}</span>
                  </div>
                  <input
                    ref={vendorInputRef}
                    name="vendorSource"
                    value={form.vendorSource}
                    onChange={handleChange}
                    onKeyDown={handleVendorKeyDown}
                    placeholder="Search vendors"
                    autoComplete="off"
                  />
                </div>
                {vendorSuggestion &&
                  vendorSuggestion !== form.vendorSource &&
                  form.vendorSource && (
                    <span className="hint">
                      Press Enter to accept {vendorSuggestion}.
                    </span>
                  )}
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
          <div className="summary-card product-preview">
            <span className="summary-label">Shopify preview</span>
            <div className="preview-header">
              <div>
                <h3>{titlePreview || "Brand + Item Name"}</h3>
                <span className="preview-price">{form.price || "$0.00"}</span>
              </div>
              <span className="preview-condition">
                {form.condition ? `${form.condition}/10` : "Condition --"}
              </span>
            </div>
            <p className="preview-description">{descriptionPreview}</p>
            <div className="preview-grid">
              <div>
                <span>Category</span>
                <strong>{form.categoryPath || "Select a category"}</strong>
              </div>
              <div>
                <span>Size</span>
                <strong>{form.size || "--"}</strong>
              </div>
              <div>
                <span>Vendor</span>
                <strong>{form.vendorSource || "--"}</strong>
              </div>
              <div>
                <span>Location</span>
                <strong>{locationLabel || "--"}</strong>
              </div>
              <div>
                <span>Cost</span>
                <strong>{form.cost || "--"}</strong>
              </div>
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
    </main>
  );
}
