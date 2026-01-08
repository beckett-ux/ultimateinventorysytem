"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { approvedBrands } from "@/lib/approvedBrands";

const defaultForm = {
  brand: "",
  itemName: "",
  categoryPath: "",
  shopifyDescription: "",
  size: "",
  condition: "10",
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

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const roundToHalf = (value) => Math.round(value * 2) / 2;

const parseFirstNumber = (value) => {
  if (typeof value === "number") {
    return value;
  }
  if (!value) {
    return null;
  }
  const match = `${value}`.match(/(\d+(\.\d+)?)/);
  if (!match) {
    return null;
  }
  const parsed = Number.parseFloat(match[1]);
  return Number.isNaN(parsed) ? null : parsed;
};

const formatCondition = (value) => {
  const normalized = Number.parseFloat(value);
  if (Number.isNaN(normalized)) {
    return "";
  }
  const formatted = normalized.toFixed(1);
  return formatted.endsWith(".0") ? formatted.replace(".0", "") : formatted;
};

const normalizeConditionInput = (value) => {
  const parsed = parseFirstNumber(value);
  if (parsed === null) {
    return "";
  }
  const rounded = roundToHalf(clamp(parsed, 0, 10));
  return formatCondition(rounded);
};

const parseMoney = (value) => {
  if (!value) {
    return "";
  }
  const cleaned = `${value}`.replace(/[^0-9.]/g, "");
  if (!cleaned) {
    return "";
  }
  const [whole, ...rest] = cleaned.split(".");
  const normalized = rest.length ? `${whole}.${rest.join("")}` : whole;
  return normalized.replace(/^0+(?=\d)/, "");
};

const formatUSD = (value) => {
  if (!value) {
    return "";
  }
  return `$${value}`;
};

const dedupeAdjacentWords = (value) => {
  if (!value) {
    return "";
  }
  const tokens = value.split(/\s+/).filter(Boolean);
  const deduped = [];
  for (const token of tokens) {
    const last = deduped[deduped.length - 1];
    if (last && last.toLowerCase() === token.toLowerCase()) {
      continue;
    }
    deduped.push(token);
  }
  if (
    deduped.length > 1 &&
    deduped[deduped.length - 1].toLowerCase() ===
      deduped[deduped.length - 2].toLowerCase()
  ) {
    deduped.pop();
  }
  return deduped.join(" ");
};

const getCategoryLeaf = (categoryPath) => {
  const parts = parseCategoryPath(categoryPath || "");
  return parts[parts.length - 1] || "";
};

const endsWithWord = (value, word) => {
  if (!value || !word) {
    return false;
  }
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}$`, "i").test(value.trim());
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
  const [quickMode, setQuickMode] = useState(false);
  const [quickStep, setQuickStep] = useState(0);
  const [quickStatus, setQuickStatus] = useState("idle");
  const [quickError, setQuickError] = useState(null);
  const [quickCategoryQuery, setQuickCategoryQuery] = useState("");
  const [quickCategoryIndex, setQuickCategoryIndex] = useState(0);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryStep, setCategoryStep] = useState("gender");
  const [categorySelection, setCategorySelection] = useState({
    gender: categoryTree[0]?.label || "",
    category: "",
  });
  const [brandLocked, setBrandLocked] = useState(false);
  const [vendorOptions, setVendorOptions] = useState(fallbackVendorOptions);
  const quickTotalSteps = 10;

  const itemNameRef = useRef(null);
  const brandInputRef = useRef(null);
  const vendorInputRef = useRef(null);
  const quickItemNameRef = useRef(null);
  const quickCategoryRef = useRef(null);
  const quickSizeRef = useRef(null);
  const quickDescriptionRef = useRef(null);
  const quickConditionRef = useRef(null);
  const quickCostRef = useRef(null);
  const quickPriceRef = useRef(null);
  const quickVendorRef = useRef(null);
  const quickLocationRef = useRef(null);
  const quickSaveRef = useRef(null);
  const quickStepRefs = useRef([]);

  const normalizedCategories = useMemo(
    () => categoryTree.map(normalizeCategoryNode),
    []
  );

  const quickCategoryOptions = useMemo(() => {
    const options = [];
    normalizedCategories.forEach((gender) => {
      gender.children.forEach((category) => {
        category.children.forEach((subcategory) => {
          options.push({
            label: subcategory,
            path: buildCategoryPath([
              gender.label,
              category.label,
              subcategory,
            ]),
          });
        });
      });
    });
    return options;
  }, [normalizedCategories]);

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

  const filteredQuickCategories = useMemo(() => {
    const query = quickCategoryQuery.trim().toLowerCase();
    if (!query) {
      return quickCategoryOptions;
    }
    return quickCategoryOptions.filter((option) => {
      const label = option.label.toLowerCase();
      const path = option.path.toLowerCase();
      return label.includes(query) || path.includes(query);
    });
  }, [quickCategoryQuery, quickCategoryOptions]);

  const titlePreview = useMemo(() => {
    const categoryLeaf = getCategoryLeaf(form.categoryPath);
    const baseParts = [form.brand, form.itemName]
      .map((value) => value.trim())
      .filter(Boolean);
    const baseTitle = baseParts.join(" ");
    const shouldAppendCategory =
      categoryLeaf && !endsWithWord(form.itemName, categoryLeaf);
    const titleParts = shouldAppendCategory
      ? [...baseParts, categoryLeaf]
      : baseParts;
    return dedupeAdjacentWords(titleParts.join(" "));
  }, [form.brand, form.itemName, form.categoryPath]);

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

  const conditionNumber = useMemo(() => {
    const normalized = normalizeConditionInput(form.condition);
    const parsed = Number.parseFloat(normalized || "0");
    return Number.isNaN(parsed) ? 0 : parsed;
  }, [form.condition]);

  const conditionProgress = useMemo(() => {
    return Math.min(100, Math.max(0, (conditionNumber / 10) * 100));
  }, [conditionNumber]);

  useEffect(() => {
    if (quickMode) {
      setBrandLocked(false);
      setQuickStep(0);
      setQuickStatus("idle");
      setQuickError(null);
      setQuickCategoryQuery("");
      setQuickCategoryIndex(0);
      setForm((prev) => ({
        ...prev,
        vendorSource: defaultForm.vendorSource,
      }));
      requestAnimationFrame(() => {
        brandInputRef.current?.focus();
      });
    }
  }, [quickMode]);

  useEffect(() => {
    if (!quickMode) {
      return;
    }
    const stepElement = quickStepRefs.current[quickStep];
    if (stepElement) {
      stepElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    focusQuickStep(quickStep);
  }, [quickMode, quickStep]);

  useEffect(() => {
    const normalized = normalizeConditionInput(form.condition);
    if (normalized !== form.condition) {
      setForm((prev) => ({ ...prev, condition: normalized }));
    }
  }, [form.condition]);

  useEffect(() => {
    if (!filteredQuickCategories.length) {
      return;
    }
    setQuickCategoryIndex((prev) =>
      prev >= filteredQuickCategories.length ? 0 : prev
    );
  }, [filteredQuickCategories]);

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

  const focusQuickStep = (step) => {
    const focusMap = {
      0: brandInputRef,
      1: quickItemNameRef,
      2: quickCategoryRef,
      3: quickSizeRef,
      4: quickDescriptionRef,
      5: quickConditionRef,
      6: quickCostRef,
      7: quickPriceRef,
      8: quickVendorRef,
      9: quickLocationRef,
      10: quickSaveRef,
    };
    const targetRef = focusMap[step];
    if (targetRef?.current) {
      targetRef.current.focus();
    }
  };

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

  const handleQuickAdvance = (nextStep) => {
    setQuickStep((prev) =>
      typeof nextStep === "number"
        ? nextStep
        : Math.min(prev + 1, quickTotalSteps)
    );
  };

  const handleQuickBrandKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== "Tab") {
      return;
    }

    if (event.key === "Tab") {
      if (brandSuggestion) {
        event.preventDefault();
        setForm((prev) => ({ ...prev, brand: brandSuggestion }));
      }
      return;
    }

    event.preventDefault();
    if (brandSuggestion) {
      setForm((prev) => ({ ...prev, brand: brandSuggestion }));
    } else if (form.brand.trim()) {
      setForm((prev) => ({ ...prev, brand: form.brand.trim() }));
    } else {
      return;
    }
    handleQuickAdvance(1);
  };

  const handleQuickCategoryKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      if (!filteredQuickCategories.length) {
        return;
      }
      event.preventDefault();
      setQuickCategoryIndex((prev) =>
        Math.min(prev + 1, filteredQuickCategories.length - 1)
      );
      return;
    }
    if (event.key === "ArrowUp") {
      if (!filteredQuickCategories.length) {
        return;
      }
      event.preventDefault();
      setQuickCategoryIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = filteredQuickCategories[quickCategoryIndex];
      if (selected) {
        setForm((prev) => ({ ...prev, categoryPath: selected.path }));
      }
      if (selected || form.categoryPath) {
        handleQuickAdvance(3);
      }
    }
  };

  const handleQuickDescriptionKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey
    ) {
      event.preventDefault();
      handleQuickAdvance(5);
    }
  };

  const handleQuickVendorKeyDown = (event) => {
    if (event.key !== "Enter" && event.key !== "Tab") {
      return;
    }

    if (event.key === "Tab") {
      if (vendorSuggestion) {
        event.preventDefault();
        setForm((prev) => ({ ...prev, vendorSource: vendorSuggestion }));
      }
      return;
    }

    event.preventDefault();
    if (vendorSuggestion) {
      setForm((prev) => ({ ...prev, vendorSource: vendorSuggestion }));
    }
    handleQuickAdvance(9);
  };

  const handleQuickLocationKeyDown = (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setForm((prev) => ({ ...prev, location: "charlotte" }));
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setForm((prev) => ({ ...prev, location: "dupont" }));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      handleQuickAdvance(10);
    }
  };

  const handleCategorySelect = ({ gender, category, subcategory }) => {
    setForm((prev) => ({
      ...prev,
      categoryPath: buildCategoryPath([gender, category, subcategory]),
    }));
    setCategoryOpen(false);
    setCategoryStep("gender");
  };

  const handleQuickCategorySelect = (option) => {
    setForm((prev) => ({ ...prev, categoryPath: option.path }));
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
    const formatted = normalizeConditionInput(event.target.value);
    setForm((prev) => ({ ...prev, condition: formatted }));
  };

  const handleCurrencyChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: parseMoney(value) }));
  };

  const validateIntake = async () => {
    const response = await fetch("/api/intake/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const data = await response.json();
    if (!response.ok) {
      const submitError = new Error(
        data?.error || "Unable to validate intake payload"
      );
      submitError.details = data?.details;
      throw submitError;
    }

    return data;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("loading");
    setError(null);
    setPreview(null);

    try {
      const data = await validateIntake();
      setPreview(data);
      setStatus("success");
    } catch (submitError) {
      setStatus("error");
      setError(submitError.message);
    }
  };

  const handleQuickSave = async () => {
    setQuickStatus("loading");
    setQuickError(null);
    setPreview(null);

    try {
      const data = await validateIntake();
      setPreview(data);
      setQuickStatus("success");
    } catch (submitError) {
      setQuickStatus("error");
      setQuickError(submitError.message);
      const field = submitError.details?.[0]?.path?.[0];
      const stepMap = {
        brand: 0,
        itemName: 1,
        categoryPath: 2,
        size: 3,
        shopifyDescription: 4,
        condition: 5,
        cost: 6,
        price: 7,
        vendorSource: 8,
        location: 9,
      };
      if (field && Object.prototype.hasOwnProperty.call(stepMap, field)) {
        setQuickStep(stepMap[field]);
      }
    }
  };

  const quickProgressStep = Math.min(quickStep + 1, quickTotalSteps);
  const quickActiveCategory =
    filteredQuickCategories[quickCategoryIndex] || null;

  return (
    <main className="intake-shell">
      <header className="intake-header">
        <div>
          <h1>Inventory Intake</h1>
          <span className="intake-subtitle">Street Commerce</span>
        </div>
      </header>

      <div className={`intake-layout ${quickMode ? "is-quick-mode" : ""}`}>
        <form
          onSubmit={handleSubmit}
          className={`intake-form ${quickMode ? "quickModeRoot" : ""}`}
        >
          {quickMode ? (
            <section className="intake-section quick-mode-card">
              <div className="section-heading">
                <div>
                  <h2>Start with brand</h2>
                  <p>
                    Tab autocompletes. Enter confirms and advances through each
                    step.
                  </p>
                </div>
                <div className="quick-mode-toggle">
                  <label>
                    <input
                      type="checkbox"
                      checked={quickMode}
                      onChange={(event) => setQuickMode(event.target.checked)}
                    />
                    Quick mode
                  </label>
                </div>
              </div>

              <div className="quick-progress">
                Step {quickProgressStep} of {quickTotalSteps}
              </div>

              <div className="quick-steps">
                {quickStep >= 0 && (
                  <div
                    className={`quickStep ${
                      quickStep > 0 ? "quickStepCompleted" : ""
                    }`}
                    ref={(el) => {
                      quickStepRefs.current[0] = el;
                    }}
                  >
                    <label className="quickStepLabel">Brand</label>
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
                        onKeyDown={handleQuickBrandKeyDown}
                        placeholder="Start typing a brand"
                        autoComplete="off"
                      />
                    </div>
                    <span className="quickHint">
                      Tab to autocomplete · Enter to continue
                    </span>
                  </div>
                )}

                {quickStep >= 1 && (
                  <div
                    className={`quickStep ${
                      quickStep > 1 ? "quickStepCompleted" : ""
                    }`}
                    ref={(el) => {
                      quickStepRefs.current[1] = el;
                    }}
                  >
                    <label className="quickStepLabel">Item name</label>
                    <input
                      ref={quickItemNameRef}
                      name="itemName"
                      value={form.itemName}
                      onChange={handleChange}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleQuickAdvance(2);
                        }
                      }}
                      placeholder="Pony Hair Ramones"
                    />
                  </div>
                )}

                {quickStep >= 2 && (
                  <div
                    className={`quickStep ${
                      quickStep > 2 ? "quickStepCompleted" : ""
                    }`}
                    ref={(el) => {
                      quickStepRefs.current[2] = el;
                    }}
                  >
                    <label className="quickStepLabel">Category</label>
                    <div className="quick-category">
                      <input
                        ref={quickCategoryRef}
                        value={quickCategoryQuery}
                        onChange={(event) => {
                          setQuickCategoryQuery(event.target.value);
                          setQuickCategoryIndex(0);
                        }}
                        onKeyDown={handleQuickCategoryKeyDown}
                        placeholder="Search categories"
                      />
                      <div className="quickCategoryList" role="listbox">
                        {filteredQuickCategories.length ? (
                          filteredQuickCategories.map((option, index) => (
                            <button
                              key={option.path}
                              type="button"
                              className={
                                index === quickCategoryIndex
                                  ? "quickCategoryOption is-active"
                                  : "quickCategoryOption"
                              }
                              onClick={() => {
                                handleQuickCategorySelect(option);
                                handleQuickAdvance(3);
                              }}
                            >
                              <span>{option.label}</span>
                              <small>{option.path}</small>
                            </button>
                          ))
                        ) : (
                          <div className="quickCategoryEmpty">
                            No matches. Keep typing.
                          </div>
                        )}
                      </div>
                    </div>
                    {form.categoryPath && (
                      <span className="quickHint">
                        Selected: {form.categoryPath}
                      </span>
                    )}
                    {quickActiveCategory && (
                      <span className="quickHint">
                        Enter to select {quickActiveCategory.label}
                      </span>
                    )}
                  </div>
                )}

                {quickStep >= 3 && (
                  <div
                    className={`quickStep ${
                      quickStep > 3 ? "quickStepCompleted" : ""
                    }`}
                    ref={(el) => {
                      quickStepRefs.current[3] = el;
                    }}
                  >
                    <label className="quickStepLabel">Size</label>
                    <input
                      ref={quickSizeRef}
                      name="size"
                      value={form.size}
                      onChange={handleChange}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleQuickAdvance(4);
                        }
                      }}
                      placeholder="IT 40"
                    />
                  </div>
                )}

                {quickStep >= 4 && (
                  <div
                    className={`quickStep ${
                      quickStep > 4 ? "quickStepCompleted" : ""
                    }`}
                    ref={(el) => {
                      quickStepRefs.current[4] = el;
                    }}
                  >
                    <label className="quickStepLabel">
                      Shopify description
                    </label>
                    <textarea
                      ref={quickDescriptionRef}
                      name="shopifyDescription"
                      value={form.shopifyDescription}
                      onChange={handleChange}
                      onKeyDown={handleQuickDescriptionKeyDown}
                      placeholder="Short description for the listing."
                    />
                    <span className="quickHint">Ctrl+Enter to continue</span>
                  </div>
                )}

                {quickStep >= 5 && (
                  <div
                    className={`quickStep ${
                      quickStep > 5 ? "quickStepCompleted" : ""
                    }`}
                    ref={(el) => {
                      quickStepRefs.current[5] = el;
                    }}
                  >
                    <label className="quickStepLabel">Condition</label>
                    <div className="condition-slider quickCondition">
                      <span className="condition-value">
                        Condition: {formatCondition(conditionNumber) || "0"}/10
                      </span>
                      <input
                        ref={quickConditionRef}
                        type="range"
                        min="0"
                        max="10"
                        step="0.5"
                        value={Number(form.condition || 0)}
                        onChange={handleConditionChange}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleQuickAdvance(6);
                          }
                        }}
                        style={{
                          background: `linear-gradient(90deg, #111827 ${conditionProgress}%, #cbd5f5 ${conditionProgress}%)`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {quickStep >= 6 && (
                  <div
                    className={`quickStep ${
                      quickStep > 6 ? "quickStepCompleted" : ""
                    }`}
                    ref={(el) => {
                      quickStepRefs.current[6] = el;
                    }}
                  >
                    <label className="quickStepLabel">Intake cost</label>
                    <input
                      ref={quickCostRef}
                      name="cost"
                      value={formatUSD(form.cost)}
                      onChange={handleCurrencyChange}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleQuickAdvance(7);
                        }
                      }}
                      placeholder="$250"
                    />
                  </div>
                )}

                {quickStep >= 7 && (
                  <div
                    className={`quickStep ${
                      quickStep > 7 ? "quickStepCompleted" : ""
                    }`}
                    ref={(el) => {
                      quickStepRefs.current[7] = el;
                    }}
                  >
                    <label className="quickStepLabel">Sell price</label>
                    <input
                      ref={quickPriceRef}
                      name="price"
                      value={formatUSD(form.price)}
                      onChange={handleCurrencyChange}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleQuickAdvance(8);
                        }
                      }}
                      placeholder="$695"
                    />
                  </div>
                )}

                {quickStep >= 8 && (
                  <div
                    className={`quickStep ${
                      quickStep > 8 ? "quickStepCompleted" : ""
                    }`}
                    ref={(el) => {
                      quickStepRefs.current[8] = el;
                    }}
                  >
                    <label className="quickStepLabel">
                      Consignee / Vendor
                    </label>
                    <div className="spotlight-field compact">
                      <div className="spotlight-ghost" aria-hidden="true">
                        <span className="ghost-typed">
                          {form.vendorSource}
                        </span>
                        <span>{vendorGhostRemainder}</span>
                      </div>
                      <input
                        ref={quickVendorRef}
                        name="vendorSource"
                        value={form.vendorSource}
                        onChange={handleChange}
                        onKeyDown={handleQuickVendorKeyDown}
                        placeholder="Search vendors"
                        autoComplete="off"
                      />
                    </div>
                    <span className="quickHint">
                      Tab to autocomplete · Enter to continue
                    </span>
                  </div>
                )}

                {quickStep >= 9 && (
                  <div
                    className={`quickStep ${
                      quickStep > 9 ? "quickStepCompleted" : ""
                    }`}
                    ref={(el) => {
                      quickStepRefs.current[9] = el;
                    }}
                  >
                    <label className="quickStepLabel">Location</label>
                    <div
                      className="segmented"
                      ref={quickLocationRef}
                      tabIndex={0}
                      onKeyDown={handleQuickLocationKeyDown}
                    >
                      {locationOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={
                            form.location === option.value
                              ? "is-selected"
                              : undefined
                          }
                          onClick={() =>
                            setForm((prev) => ({
                              ...prev,
                              location: option.value,
                            }))
                          }
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <span className="quickHint">Enter to save</span>
                  </div>
                )}

                {quickStep >= 10 && (
                  <div
                    className="quickStep"
                    ref={(el) => {
                      quickStepRefs.current[10] = el;
                    }}
                  >
                    <label className="quickStepLabel">Save intake</label>
                    <div className="quickFooter">
                      <button
                        ref={quickSaveRef}
                        type="button"
                        className="primary-button"
                        onClick={handleQuickSave}
                        disabled={quickStatus === "loading"}
                      >
                        {quickStatus === "loading"
                          ? "Saving..."
                          : "Save intake"}
                      </button>
                      {quickStatus === "success" && (
                        <span className="success">Saved & validated</span>
                      )}
                    </div>
                    {quickStatus === "error" && quickError && (
                      <span className="error">{quickError}</span>
                    )}
                  </div>
                )}

                {preview && (
                  <div className="quickReview">
                    <span className="summary-label">Review</span>
                    <div className="summary-row">
                      <span>Title</span>
                      <strong>{preview.title}</strong>
                    </div>
                    <div className="summary-row">
                      <span>Price</span>
                      <strong>{formatUSD(preview.pricing.price)}</strong>
                    </div>
                    <div className="summary-row">
                      <span>Category</span>
                      <strong>{preview.categoryPath}</strong>
                    </div>
                    <div className="summary-row">
                      <span>Size</span>
                      <strong>{form.size || "--"}</strong>
                    </div>
                    <div className="summary-row">
                      <span>Tags</span>
                      <strong>{preview.tags.join(", ")}</strong>
                    </div>
                    <details className="summary-code">
                      <summary>View normalized payload</summary>
                      <pre>{JSON.stringify(preview, null, 2)}</pre>
                    </details>
                  </div>
                )}
              </div>
            </section>
          ) : (
            <>
              <section className="intake-section spotlight-section">
                <div className="section-heading">
                  <div>
                    <h2>Start with brand</h2>
                    <p>Type to autocomplete. Enter locks the brand and moves on.</p>
                  </div>
                  <div className="quick-mode-toggle">
                    <label>
                      <input
                        type="checkbox"
                        checked={quickMode}
                        onChange={(event) => setQuickMode(event.target.checked)}
                      />
                      Quick mode
                    </label>
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
              </section>

              <section className="intake-section">
                <div className="section-heading">
                  <div>
                    <h2>Core identity</h2>
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
                            <div className="category-step-meta">
                              {categoryStep !== "gender" && (
                                <button
                                  type="button"
                                  className="category-back"
                                  onClick={() =>
                                    setCategoryStep((prev) =>
                                      prev === "subcategory"
                                        ? "category"
                                        : "gender"
                                    )
                                  }
                                >
                                  Back
                                </button>
                              )}
                              <div>
                                <strong>
                                  {categoryStep === "gender"
                                    ? "Choose gender"
                                    : categoryStep === "category"
                                    ? "Choose category"
                                    : "Choose subcategory"}
                                </strong>
                              </div>
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
                                  onClick={(event) => {
                                    event.preventDefault();
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
                                  onClick={(event) => {
                                    event.preventDefault();
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
                                  onClick={(event) => {
                                    event.preventDefault();
                                    handleCategorySelect({
                                      gender: selectedGender?.label,
                                      category: selectedCategory?.label,
                                      subcategory,
                                    });
                                  }}
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
                  </div>
                </div>
                <div className="field-grid single">
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
                        Condition: {formatCondition(conditionNumber) || "0"}/10
                      </span>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.5"
                        value={Number(form.condition || 0)}
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
                  </div>
                </div>
                <div className="field-grid three">
                  <label className="field">
                    <span>Intake cost</span>
                    <input
                      name="cost"
                      value={formatUSD(form.cost)}
                      onChange={handleCurrencyChange}
                      placeholder="$250"
                    />
                  </label>
                  <label className="field">
                    <span>Sell price</span>
                    <input
                      name="price"
                      value={formatUSD(form.price)}
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
                  </label>
                </div>
              </section>

              <section className="intake-section">
                <div className="section-heading">
                  <div>
                    <h2>Location</h2>
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
            </>
          )}
        </form>

        {!quickMode && (
          <aside className="intake-summary">
            <div className="summary-card product-preview">
              <span className="summary-label">Shopify preview</span>
              <div className="preview-header">
                <div>
                  <h3>{titlePreview || "Brand + Item Name"}</h3>
                  <span className="preview-price">
                    {formatUSD(form.price) || "$0.00"}
                  </span>
                </div>
                <span className="preview-condition">
                  {form.condition
                    ? `${formatCondition(conditionNumber)}/10`
                    : "Condition --"}
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
                  <strong>{formatUSD(form.cost) || "--"}</strong>
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
        )}
      </div>
    </main>
  );
}
