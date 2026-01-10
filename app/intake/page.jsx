"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { approvedBrands } from "@/lib/approvedBrands";
import { navigateOutsideIframe } from "@/lib/navigateOutsideIframe";
import SpeechMicButton from "@/components/SpeechMicButton";

const buildShopifyAuthUrl = (shopDomain) => {
  if (typeof window === "undefined") {
    if (!shopDomain) return "/api/shopify/auth";
    return `/api/shopify/auth?shop=${encodeURIComponent(shopDomain)}`;
  }

  const params = new URLSearchParams(window.location.search);
  if (shopDomain) {
    params.set("shop", shopDomain);
  }
  const query = params.toString();
  return query ? `/api/shopify/auth?${query}` : "/api/shopify/auth";
};

function ShopifyQueryGuardBanner() {
  const router = useRouter();
  const hasCorrectedUrl = useRef(false);
  const [status, setStatus] = useState({
    enabled: false,
    shopOk: false,
    hostOk: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.location.pathname !== "/intake") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const shopOk = Boolean(params.get("shop"));
    const hostOk = Boolean(params.get("host"));

    setStatus({ enabled: true, shopOk, hostOk });

    if (hasCorrectedUrl.current || (shopOk && hostOk)) {
      return;
    }

    const referer = document.referrer;
    if (!referer) {
      return;
    }

    try {
      const refererUrl = new URL(referer);
      const refererParams = new URLSearchParams(refererUrl.search);
      const refererShopOk = Boolean(refererParams.get("shop"));
      const refererHostOk = Boolean(refererParams.get("host"));

      if (!refererShopOk || !refererHostOk || !refererUrl.search) {
        return;
      }

      hasCorrectedUrl.current = true;
      router.replace(`/intake${refererUrl.search}`);
    } catch {
      return;
    }
  }, [router]);

  if (!status.enabled) {
    return null;
  }

  return (
    <div style={{ fontSize: 12, color: "#666", padding: "4px 0" }}>
      {status.shopOk ? "shop ok" : "shop missing"} /{" "}
      {status.hostOk ? "host ok" : "host missing"}
    </div>
  );
}

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
  vendorSource: "",
  consignmentPayoutPct: "",
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
const LOCATION_STORAGE_KEY = "ui_location";


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

const formatPriceCents = (value) => {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  return (parsed / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
};

const formatDateTime = (value) => {
  if (!value) {
    return "";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
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

const extractConsignmentVendor = (value) => {
  if (!value) {
    return "";
  }
  const match = `${value}`.match(/^consignment\s*-\s*(.+)$/i);
  return match ? match[1].trim() : "";
};

const resolveConsignmentVendor = async (vendorValue) => {
  const extracted = extractConsignmentVendor(vendorValue);
  if (!extracted) {
    return vendorValue;
  }
  try {
    const response = await fetch(
      `/api/vendors?q=${encodeURIComponent(extracted)}`
    );
    if (!response.ok) {
      return extracted;
    }
    const data = await response.json().catch(() => ({}));
    return data?.match || extracted;
  } catch (error) {
    return extracted;
  }
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
    .split(/ΓÇ║|>/)
    .map((part) => part.trim())
    .filter(Boolean);

const buildCategoryPath = (parts) =>
  parts.filter(Boolean).join(" > ");

function ConditionControl({
  value,
  conditionNumber,
  conditionProgress,
  onChange,
  onKeyDown,
  inputRef,
  className,
  valuePrefix = "Condition: ",
  valueClassName,
}) {
  const conditionLabel = `${formatCondition(conditionNumber) || "0"}/10`;
  return (
    <div className={`condition-slider ${className || ""}`.trim()}>
      <span
        className={`condition-value ${valueClassName || ""}`.trim()}
      >{`${valuePrefix}${conditionLabel}`}</span>
      <input
        ref={inputRef}
        type="range"
        min="0"
        max="10"
        step="0.5"
        value={Number(value || 0)}
        onChange={onChange}
        onKeyDown={onKeyDown}
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
  );
}

function BrandSpotlightInput({
  value,
  ghostRemainder,
  inputRef,
  onChange,
  onKeyDown,
  placeholder,
  readOnly = false,
}) {
  return (
    <div className="spotlight-field">
      <div className="spotlight-ghost" aria-hidden="true">
        <span className="ghost-typed">{value}</span>
        <span>{ghostRemainder}</span>
      </div>
      <input
        ref={inputRef}
        name="brand"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        readOnly={readOnly}
      />
    </div>
  );
}

function ShopifyPreview({
  preview,
  titlePreview,
  descriptionPreview,
  conditionNumber,
  form,
  locationLabel,
}) {
  const priceNum = parseFirstNumber(form.price);
  const costNum = parseFirstNumber(form.cost);
  const pctNum = parseFirstNumber(form.consignmentPayoutPct);
  const isConsignment = pctNum !== null;
  const roundToCents = (value) => Math.round(value * 100) / 100;
  const vendorPayout = isConsignment
    ? priceNum !== null
      ? roundToCents(priceNum * 0.6)
      : null
    : 0;
  const storeProfit = isConsignment
    ? priceNum !== null
      ? roundToCents(priceNum * 0.4)
      : null
    : priceNum !== null && costNum !== null
      ? roundToCents(Math.max(priceNum - costNum, 0))
      : null;
  const purchaseProfit = !isConsignment ? storeProfit : null;
  const marginPct =
    purchaseProfit !== null && priceNum
      ? Math.round((purchaseProfit / priceNum) * 100)
      : null;
  const storeCutPct =
    isConsignment &&
    typeof priceNum === "number" &&
    priceNum > 0 &&
    typeof storeProfit === "number"
      ? Math.round((storeProfit / priceNum) * 100)
      : 0;
  const consignmentPctRaw = (() => {
    if (!isConsignment) {
      return null;
    }
    if (typeof pctNum === "number" && !Number.isNaN(pctNum)) {
      return pctNum <= 1 ? pctNum * 100 : pctNum;
    }
    if (
      typeof vendorPayout === "number" &&
      typeof priceNum === "number" &&
      priceNum > 0
    ) {
      return (vendorPayout / priceNum) * 100;
    }
    return null;
  })();
  const consignmentPct =
    consignmentPctRaw === null || Number.isNaN(consignmentPctRaw)
      ? null
      : Math.round(consignmentPctRaw);
  const formatMoneyValue = (value) => {
    if (value === null || Number.isNaN(value)) {
      return "--";
    }
    const normalized = Number.isInteger(value) ? `${value}` : value.toFixed(2);
    return formatUSD(normalized);
  };
  const formatPercentValue = (value) =>
    value === null || Number.isNaN(value) ? "--" : `${value}%`;
  const costDisplay = isConsignment ? "$0" : formatUSD(form.cost) || "--";

  return (
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
            <span className="preview-label">Category</span>
            <strong className="preview-value">
              {form.categoryPath || "Select a category"}
            </strong>
          </div>
          <div>
            <span className="preview-label">Size</span>
            <strong className="preview-value">{form.size || "--"}</strong>
          </div>
          <div>
            <span className="preview-label">Vendor</span>
            <strong className="preview-value">
              {form.vendorSource || "--"}
            </strong>
          </div>
          <div>
            <span className="preview-label">Location</span>
            <strong className="preview-value">{locationLabel || "--"}</strong>
          </div>
          <div>
            <span className="preview-label">Cost</span>
            <strong className="preview-value">
              {costDisplay}
            </strong>
          </div>
        </div>
        <div
          className="preview-profit"
          style={
            isConsignment
              ? { gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }
              : undefined
          }
        >
          {isConsignment ? (
            <>
              <div>
                <span className="preview-label">Vendor payout</span>
                <strong className="preview-value">
                  {formatMoneyValue(vendorPayout)}
                </strong>
              </div>
              <div>
                <span className="preview-label">Store profit</span>
                <strong className="preview-value">
                  {formatMoneyValue(storeProfit)}
                </strong>
              </div>
              <div>
                <span className="preview-label">Consignment %</span>
                <strong className="preview-value">
                  {formatPercentValue(consignmentPct)}
                </strong>
              </div>
              <div>
                <span className="preview-label">Store cut %</span>
                <strong className="preview-value">
                  {formatPercentValue(storeCutPct)}
                </strong>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="preview-label">Profit</span>
                <strong className="preview-value">
                  {formatMoneyValue(purchaseProfit)}
                </strong>
              </div>
              <div>
                <span className="preview-label">Margin</span>
                <strong className="preview-value">
                  {formatPercentValue(marginPct)}
                </strong>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="summary-card checklist-card">
        <span className="preview-label checklist-title">
          Each listing requires
        </span>
        <ul className="checklist-list">
          <li>
            <strong className="preview-value">Brand</strong>
          </li>
          <li>
            <strong className="preview-value">Category</strong>
          </li>
          <li>
            <strong className="preview-value">Size</strong>
          </li>
          <li>
            <strong className="preview-value">Description</strong>
          </li>
          <li>
            <strong className="preview-value">Condition</strong>
          </li>
          <li>
            <strong className="preview-value">Intake cost</strong>
          </li>
          <li>
            <strong className="preview-value">Sale price</strong>
          </li>
          <li>
            <strong className="preview-value">Vendor</strong>
          </li>
          <li>
            <strong className="preview-value">Location</strong>
          </li>
        </ul>
      </div>
      {preview && (
        <details className="summary-code">
          <summary>View normalized payload</summary>
          <pre>{JSON.stringify(preview, null, 2)}</pre>
        </details>
      )}
    </aside>
  );
}

export default function Home() {
  const [form, setForm] = useState(defaultForm);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [recentItems, setRecentItems] = useState([]);
  const [recentStatus, setRecentStatus] = useState("idle");
  const [recentError, setRecentError] = useState("");
  const [shopifyCreateState, setShopifyCreateState] = useState({});
  const [quickMode, setQuickMode] = useState(true);
  const [quickStep, setQuickStep] = useState(0);
  const [quickStatus, setQuickStatus] = useState("idle");
  const [quickError, setQuickError] = useState(null);
  const [quickSavedId, setQuickSavedId] = useState(null);
  const [quickItemDetails, setQuickItemDetails] = useState("");
  const [itemDetailsStatus, setItemDetailsStatus] = useState("idle");
  const [itemDetailsMessage, setItemDetailsMessage] = useState("");
  const [quickCategoryQuery, setQuickCategoryQuery] = useState("");
  const [quickCategoryIndex, setQuickCategoryIndex] = useState(0);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryStep, setCategoryStep] = useState("gender");
  const [categorySelection, setCategorySelection] = useState({
    gender: categoryTree[0]?.label || "",
    category: "",
  });
  const [brandLocked, setBrandLocked] = useState(false);
  const quickTotalSteps = 10;

  const router = useRouter();
  const [shop, setShop] = useState("");
  const [shopDraft, setShopDraft] = useState(shop);
  const [shopGateError, setShopGateError] = useState("");
  const [shopInstalled, setShopInstalled] = useState(null);
  const [shopInstallCheckStatus, setShopInstallCheckStatus] = useState("idle");
  const [shopInstallCheckError, setShopInstallCheckError] = useState("");

  useEffect(() => {
    const readShopFromLocation = () => {
      if (typeof window === "undefined") {
        return "";
      }
      const params = new URLSearchParams(window.location.search);
      return (params.get("shop") || "").trim().toLowerCase();
    };

    const syncShop = () => setShop(readShopFromLocation());
    syncShop();
    window.addEventListener("popstate", syncShop);
    return () => {
      window.removeEventListener("popstate", syncShop);
    };
  }, []);

  useEffect(() => {
    setShopDraft(shop);
    setShopGateError("");
    setShopInstalled(null);
  }, [shop]);

  useEffect(() => {
    if (!shop) {
      setShopInstallCheckStatus("idle");
      setShopInstallCheckError("");
      setShopInstalled(null);
      return;
    }

    let cancelled = false;
    setShopInstallCheckStatus("loading");
    setShopInstallCheckError("");
    setShopInstalled(null);

    fetch(`/api/shopify/installed?shop=${encodeURIComponent(shop)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (cancelled) return;

        if (!response.ok) {
          setShopInstalled(false);
          setShopInstallCheckStatus("error");
          setShopInstallCheckError(
            data?.error || "Unable to check Shopify install status"
          );
          return;
        }

        setShopInstalled(Boolean(data?.installed));
        setShopInstallCheckStatus("success");
      })
      .catch((error) => {
        if (cancelled) return;
        setShopInstalled(false);
        setShopInstallCheckStatus("error");
        setShopInstallCheckError(
          error?.message || "Unable to check Shopify install status"
        );
      });

    return () => {
      cancelled = true;
    };
  }, [shop]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!shop || shopInstallCheckStatus !== "success" || shopInstalled !== false) {
      return;
    }

    navigateOutsideIframe(buildShopifyAuthUrl(shop), { replace: true });
  }, [shop, shopInstallCheckStatus, shopInstalled]);

  const handleShopSubmit = (event) => {
    event.preventDefault();
    const normalized = (shopDraft || "").trim().toLowerCase();
    if (!normalized) {
      setShopGateError("Enter your Shopify shop domain.");
      return;
    }

    setShop(normalized);
    const nextParams =
      typeof window === "undefined"
        ? new URLSearchParams()
        : new URLSearchParams(window.location.search);
    nextParams.set("shop", normalized);
    const nextQuery = nextParams.toString();
    router.push(nextQuery ? `/intake?${nextQuery}` : "/intake");
  };

  const loadRecentItems = async () => {
    setRecentStatus("loading");
    setRecentError("");

    try {
      const response = await fetch("/api/intake");
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Unable to load recent saves.");
      }

      setRecentItems(Array.isArray(data?.items) ? data.items : []);
      setRecentStatus("success");
    } catch (fetchError) {
      setRecentStatus("error");
      setRecentError(fetchError?.message || "Unable to load recent saves.");
    }
  };

  const setCreateStatus = (inventoryItemId, nextState) => {
    setShopifyCreateState((prev) => ({
      ...prev,
      [inventoryItemId]: { ...(prev[inventoryItemId] || {}), ...nextState },
    }));
  };

  const handleCreateShopifyProduct = async (inventoryItemId) => {
    if (!inventoryItemId) {
      return;
    }

    setCreateStatus(inventoryItemId, {
      status: "loading",
      message: "",
      handle: null,
      productId: null,
    });

    try {
      const response = await fetch("/api/shopify/create-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryItemId }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.ok === false) {
        setCreateStatus(inventoryItemId, {
          status: "error",
          message:
            data?.error ||
            "Unable to create Shopify product. Check your environment configuration.",
        });
        return;
      }

      const productId = data?.productId ?? data?.id ?? data?.product?.id ?? null;
      const handle = data?.handle ?? data?.product?.handle ?? null;
      const successMessage = productId
        ? `Created product ${productId}${handle ? ` (${handle})` : ""}`
        : "Created product in Shopify.";

      setCreateStatus(inventoryItemId, {
        status: "success",
        message: successMessage,
        handle,
        productId,
      });
    } catch (createError) {
      setCreateStatus(inventoryItemId, {
        status: "error",
        message:
          createError?.message || "Unexpected error creating Shopify product.",
      });
    }
  };

  useEffect(() => {
    if (shopInstalled !== true) {
      return;
    }
    loadRecentItems();
  }, [shopInstalled]);

  const itemNameRef = useRef(null);
  const brandInputRef = useRef(null);
  const quickItemDetailsRef = useRef(null);
  const quickItemDetailsSelectionRef = useRef(null);
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

  useEffect(() => {
    const selection = quickItemDetailsSelectionRef.current;
    if (!selection) {
      return;
    }
    quickItemDetailsSelectionRef.current = null;

    const textarea = quickItemDetailsRef.current;
    if (!textarea) {
      return;
    }

    try {
      textarea.focus({ preventScroll: true });
    } catch (error) {
      try {
        textarea.focus();
      } catch (focusError) {
        return;
      }
    }

    try {
      textarea.setSelectionRange(selection.start, selection.end);
    } catch (rangeError) {
      // ignore selection errors
    }
  }, [quickItemDetails]);

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
    return trimmed.length > 160 ? `${trimmed.slice(0, 160)}ΓÇª` : trimmed;
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
    const savedLocation = localStorage.getItem(LOCATION_STORAGE_KEY) ?? "";
    if (!savedLocation) {
      return;
    }
    const isKnown = locationOptions.some(
      (option) => option.value === savedLocation
    );
    if (!isKnown) {
      return;
    }
    setForm((prev) =>
      prev.location === savedLocation ? prev : { ...prev, location: savedLocation }
    );
  }, []);

  useEffect(() => {
    if (quickMode) {
      setBrandLocked(false);
      setQuickStep(0);
      setQuickStatus("idle");
      setQuickError(null);
      setQuickItemDetails("");
      setItemDetailsStatus("idle");
      setItemDetailsMessage("");
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

  const focusQuickStep = (step) => {
    const focusMap = {
      0: brandInputRef,
      1: quickItemDetailsRef,
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

  const isQuickStepLocked = (stepIndex) => stepIndex > quickStep;

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
    if (event.key !== "Enter") {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const target = event.currentTarget;
      const start = target.selectionStart ?? 0;
      const end = target.selectionEnd ?? 0;
      const nextValue = `${form.shopifyDescription.slice(
        0,
        start
      )}\n${form.shopifyDescription.slice(end)}`;
      setForm((prev) => ({ ...prev, shopifyDescription: nextValue }));
      requestAnimationFrame(() => {
        target.selectionStart = start + 1;
        target.selectionEnd = start + 1;
        target.focus();
      });
      return;
    }

    event.preventDefault();
    handleQuickAdvance(5);
  };

  const isEmptyValue = (value) =>
    value === null || value === undefined || `${value}`.trim() === "";

  const mergeParsedFields = (parsedFields) => {
    setForm((prev) => {
      const next = { ...prev };
      Object.entries(parsedFields).forEach(([key, value]) => {
        if (isEmptyValue(value)) {
          return;
        }
        if (key === "location") {
          return;
        }
        if (key === "vendor") {
          next.vendorSource = value;
          return;
        }
        if (key === "consignmentPayoutPct") {
          if (isEmptyValue(prev.consignmentPayoutPct)) {
            next.consignmentPayoutPct = `${value}`;
          }
          return;
        }
        if (key === "brand") {
          if (isEmptyValue(prev.brand)) {
            next.brand = value;
          }
          return;
        }
        if (key === "condition") {
          if (
            isEmptyValue(prev.condition) ||
            prev.condition === defaultForm.condition
          ) {
            next.condition = value;
          }
          return;
        }
        if (isEmptyValue(prev[key])) {
          next[key] = value;
        }
      });
      return next;
    });
  };

  const handleQuickItemDetailsSubmit = async () => {
    const trimmedDetails = quickItemDetails.trim();
    setItemDetailsMessage("");
    setItemDetailsStatus("idle");

    if (itemDetailsStatus === "loading") {
      return;
    }

    if (!trimmedDetails) {
      if (isEmptyValue(form.itemName)) {
        setForm((prev) => ({ ...prev, itemName: "" }));
      }
      handleQuickAdvance(2);
      return;
    }

    try {
      setItemDetailsStatus("loading");
      setItemDetailsMessage("AI autofilling from your notes...");
      const rawInput = `${form.brand}\n${trimmedDetails}`.trim();
      const response = await fetch("/api/intake/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Unable to parse item details");
      }
      const parsedFields = await response.json();
      const payoutNum = parseFirstNumber(parsedFields.consignmentPayoutPct);
      const costNum = parseFirstNumber(parsedFields.cost);
      const isConsignment = payoutNum !== null;
      const needsDefaultVendor =
        isEmptyValue(parsedFields.vendor) &&
        !isConsignment &&
        costNum !== null &&
        costNum > 0;
      const vendorCandidate = needsDefaultVendor
        ? "Street Commerce"
        : parsedFields.vendor;
      const resolvedVendor = await resolveConsignmentVendor(vendorCandidate);
      const resolvedFields =
        resolvedVendor === vendorCandidate &&
        vendorCandidate === parsedFields.vendor
          ? parsedFields
          : { ...parsedFields, vendor: resolvedVendor };
      mergeParsedFields(resolvedFields);
      if (resolvedFields.categoryPath) {
        setQuickCategoryQuery(resolvedFields.categoryPath);
        const matchIndex = quickCategoryOptions.findIndex(
          (option) => option.path === resolvedFields.categoryPath
        );
        if (matchIndex >= 0) {
          setQuickCategoryIndex(matchIndex);
        }
      }
      setItemDetailsStatus("success");
    } catch (parseError) {
      setItemDetailsStatus("error");
      setItemDetailsMessage("CouldnΓÇÖt autofill. You can keep going.");
      setForm((prev) =>
        isEmptyValue(prev.itemName)
          ? { ...prev, itemName: trimmedDetails }
          : prev
      );
    } finally {
      setTimeout(() => {
        setItemDetailsStatus("idle");
        setItemDetailsMessage("");
      }, 800);
      handleQuickAdvance(2);
    }
  };

  const handleQuickLocationKeyDown = (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setForm((prev) => ({ ...prev, location: "charlotte" }));
      localStorage.setItem(LOCATION_STORAGE_KEY, "charlotte");
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setForm((prev) => ({ ...prev, location: "dupont" }));
      localStorage.setItem(LOCATION_STORAGE_KEY, "dupont");
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

  const handleLocationSelect = (value) => {
    setForm((prev) => ({ ...prev, location: value }));
    localStorage.setItem(LOCATION_STORAGE_KEY, value);
  };

  const handleBrandEdit = () => {
    setBrandLocked(false);
    requestAnimationFrame(() => {
      brandInputRef.current?.focus();
    });
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

  const buildNotes = () => {
    const lines = [];
    const description = form.shopifyDescription?.trim();
    if (description) {
      lines.push(`Description: ${description}`);
    }
    const size = form.size?.trim();
    if (size) {
      lines.push(`Size: ${size}`);
    }
    const cost = parseFirstNumber(form.cost);
    if (typeof cost === "number" && !Number.isNaN(cost) && cost > 0) {
      lines.push(`Cost: $${cost}`);
    }
    const vendorSource = form.vendorSource?.trim();
    if (vendorSource) {
      lines.push(`Vendor: ${vendorSource}`);
    }
    const consignmentPayoutPct = form.consignmentPayoutPct?.trim();
    if (consignmentPayoutPct) {
      lines.push(`Consignment payout: ${consignmentPayoutPct}`);
    }
    const location = locationLabel?.trim() || form.location?.trim();
    if (location) {
      lines.push(`Location: ${location}`);
    }
    return lines.length ? lines.join("\n") : null;
  };

  const buildIntakeInsertPayload = () => {
    const price = parseFirstNumber(form.price);
    const priceCents =
      typeof price === "number" && !Number.isNaN(price)
        ? Math.round(price * 100)
        : null;
    const normalizedCondition = normalizeConditionInput(form.condition);
    const title = titlePreview?.trim() || form.itemName?.trim() || "";

    return {
      title,
      sku: null,
      brand: form.brand?.trim() || null,
      category: form.categoryPath?.trim() || null,
      condition: normalizedCondition || null,
      price_cents: priceCents,
      notes: buildNotes(),
    };
  };

  const submitIntakeInsert = async (payload) => {
    const response = await fetch("/api/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const submitError = new Error(
        data?.error || "Unable to save intake"
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
    setSavedId(null);
    setPreview(null);

    try {
      const payload = buildIntakeInsertPayload();
      setPreview(payload);
      const data = await submitIntakeInsert(payload);
      setSavedId(data?.id ?? null);
      setStatus("success");
      loadRecentItems();
    } catch (submitError) {
      setStatus("error");
      setError(submitError.message);
    }
  };

  const handleQuickSave = async () => {
    setQuickStatus("loading");
    setQuickError(null);
    setQuickSavedId(null);
    setPreview(null);

    try {
      const payload = buildIntakeInsertPayload();
      setPreview(payload);
      const data = await submitIntakeInsert(payload);
      setQuickSavedId(data?.id ?? null);
      setQuickStatus("success");
      loadRecentItems();
    } catch (submitError) {
      setQuickStatus("error");
      setQuickError(submitError.message);
      const field = submitError.details?.[0]?.path?.[0];
      const stepMap = {
        title: 1,
      };
      if (field && Object.prototype.hasOwnProperty.call(stepMap, field)) {
        setQuickStep(stepMap[field]);
      }
    }
  };

  const quickProgressStep = Math.min(quickStep + 1, quickTotalSteps);
  const quickActiveCategory =
    filteredQuickCategories[quickCategoryIndex] || null;
  const quickStepLocks = {
    brand: isQuickStepLocked(0),
    itemDetails: isQuickStepLocked(1),
    category: isQuickStepLocked(2),
    size: isQuickStepLocked(3),
    description: isQuickStepLocked(4),
    condition: isQuickStepLocked(5),
    cost: isQuickStepLocked(6),
    price: isQuickStepLocked(7),
    vendor: isQuickStepLocked(8),
    location: isQuickStepLocked(9),
  };

  if (!shop) {
    return (
      <main className="intake-shell cardTight">
        <ShopifyQueryGuardBanner />
        <header className="intakeHeaderBar">
          <div />
          <div className="intakeHeaderCenter">
            <h1 className="intakeTitle">Inventory Intake</h1>
            <div className="intakeSub">STREET COMMERCE</div>
          </div>
          <div />
        </header>

        <form className="intake-form" onSubmit={handleShopSubmit}>
          <section className="intake-section">
            <div className="section-heading">
              <div>
                <h2>Choose a shop</h2>
                <p className="hint">Enter your Shopify domain to continue.</p>
              </div>
            </div>

            <div className="field">
              <label className="fieldLabel" htmlFor="shop-domain">
                Shop domain
              </label>
              <input
                id="shop-domain"
                className="fieldInput"
                value={shopDraft}
                onChange={(event) => setShopDraft(event.target.value)}
                placeholder="example.myshopify.com"
                autoComplete="off"
              />
            </div>

            {shopGateError && <div className="error">{shopGateError}</div>}

            <button type="submit" className="primary-button">
              Continue
            </button>
          </section>
        </form>
      </main>
    );
  }

  if (shopInstalled === null && shopInstallCheckStatus === "loading") {
    return (
      <main className="intake-shell cardTight">
        <header className="intakeHeaderBar">
          <div />
          <div className="intakeHeaderCenter">
            <h1 className="intakeTitle">Inventory Intake</h1>
            <div className="intakeSub">STREET COMMERCE</div>
          </div>
          <div />
        </header>

        <section className="intake-section">
          <div className="section-heading">
            <div>
              <h2>Checking shop connection</h2>
              <p className="hint">{shop}</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (shopInstalled === false) {
    const installUrl = buildShopifyAuthUrl(shop);

    if (shop && shopInstallCheckStatus === "success") {
      return (
        <main className="intake-shell cardTight">
          <header className="intakeHeaderBar">
            <div />
            <div className="intakeHeaderCenter">
              <h1 className="intakeTitle">Inventory Intake</h1>
              <div className="intakeSub">STREET COMMERCE</div>
            </div>
            <div />
          </header>

          <section className="intake-section">
            <div className="section-heading">
              <div>
                <h2>Redirecting to Shopify</h2>
                <p className="hint">{shop}</p>
              </div>
            </div>

            <a
              className="primary-button"
              href={installUrl}
              onClick={(event) => {
                event.preventDefault();
                navigateOutsideIframe(installUrl);
              }}
            >
              Continue to Shopify
            </a>

            <button
              type="button"
              className="text-button"
              onClick={() => {
                setShop("");
                const nextParams =
                  typeof window === "undefined"
                    ? new URLSearchParams()
                    : new URLSearchParams(window.location.search);
                nextParams.delete("shop");
                const nextQuery = nextParams.toString();
                router.push(nextQuery ? `/intake?${nextQuery}` : "/intake");
              }}
            >
              Use a different shop
            </button>
          </section>
        </main>
      );
    }

    return (
      <main className="intake-shell cardTight">
        <header className="intakeHeaderBar">
          <div />
          <div className="intakeHeaderCenter">
            <h1 className="intakeTitle">Inventory Intake</h1>
            <div className="intakeSub">STREET COMMERCE</div>
          </div>
          <div />
        </header>

        <section className="intake-section">
          <div className="section-heading">
            <div>
              <h2>Connect Shopify</h2>
              <p className="hint">{shop}</p>
            </div>
          </div>

          {shopInstallCheckError && (
            <div className="error">{shopInstallCheckError}</div>
          )}

          <a
            className="primary-button"
            href={installUrl}
            onClick={(event) => {
              event.preventDefault();
              navigateOutsideIframe(installUrl);
            }}
          >
            Install Shopify app
          </a>

          <button
            type="button"
            className="text-button"
            onClick={() => {
              setShop("");
              const nextParams =
                typeof window === "undefined"
                  ? new URLSearchParams()
                  : new URLSearchParams(window.location.search);
              nextParams.delete("shop");
              const nextQuery = nextParams.toString();
              router.push(nextQuery ? `/intake?${nextQuery}` : "/intake");
            }}
          >
            Use a different shop
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="intake-shell cardTight">
      <ShopifyQueryGuardBanner />
      <header className="intakeHeaderBar">
        <div />
        <div className="intakeHeaderCenter">
          <h1 className="intakeTitle">Inventory Intake</h1>
          <div className="intakeSub">STREET COMMERCE</div>
        </div>

        <div className="intakeHeaderRight">
          <a
            className="text-button"
            style={{ marginRight: 16, textDecoration: "none" }}
            href={`/settings?shop=${encodeURIComponent(shop)}`}
          >
            Settings
          </a>
          <label className="quickModeToggle">
            <input
              className="quickModeCheckbox"
              type="checkbox"
              checked={quickMode}
              onChange={(e) => setQuickMode(e.target.checked)}
            />
            <span>Quick mode</span>
          </label>
        </div>
      </header>

      <div className={`intake-layout ${quickMode ? "is-quick-mode" : ""}`}>
        <form
          onSubmit={handleSubmit}
          className={`intake-form ${quickMode ? "quickModeRoot" : ""}`}
        >
          {quickMode ? (
            <section className="intake-section quick-mode-card">
              <div className="quick-progress">
                Step {quickProgressStep} of {quickTotalSteps}
              </div>

              <div className="quick-steps">
                <div
                  className={`quickStep ${
                    quickStepLocks.brand ? "quickStepLocked" : ""
                  }`}
                  ref={(el) => {
                    quickStepRefs.current[0] = el;
                  }}
                >
                  <span className="quickStepLabel">Brand</span>
                  <fieldset
                    disabled={quickStepLocks.brand}
                    className="quickStepFieldset"
                  >
                    <BrandSpotlightInput
                      value={form.brand}
                      ghostRemainder={ghostRemainder}
                      inputRef={brandInputRef}
                      onChange={handleChange}
                      onKeyDown={handleQuickBrandKeyDown}
                      placeholder="Start typing a brand"
                      readOnly={brandLocked}
                    />
                  </fieldset>
                </div>

                <div
                  className={`quickStep ${
                    quickStepLocks.itemDetails ? "quickStepLocked" : ""
                  } field`}
                  ref={(el) => {
                    quickStepRefs.current[1] = el;
                  }}
                >
                  <span className="quickStepLabel">Item details</span>
                  <fieldset
                    disabled={quickStepLocks.itemDetails}
                    className="quickStepFieldset"
                  >
                    <div className="textareaWrap">
                      <textarea
                        className="quickItemDetails fieldTextarea fieldTextareaWithMic"
                        ref={quickItemDetailsRef}
                        value={quickItemDetails}
                        onChange={(event) =>
                          setQuickItemDetails(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            if (itemDetailsStatus !== "loading") {
                              handleQuickItemDetailsSubmit();
                            }
                            return;
                          }
                          if (itemDetailsStatus === "loading") {
                            event.preventDefault();
                            return;
                          }
                        }}
                        rows={6}
                        placeholder="Pony hair Ramones sneakers size 13 cost 100 sell 900 9/10"
                      />
                      <SpeechMicButton
                        className="micButton"
                        onText={(t) => {
                          const transcript = String(t || "").trim();
                          if (!transcript) {
                            return;
                          }

                          const textarea = quickItemDetailsRef.current;
                          const selectionStart = textarea?.selectionStart;
                          const selectionEnd = textarea?.selectionEnd;

                          setQuickItemDetails((prev) => {
                            const currentValue = String(prev || "");
                            if (
                              typeof selectionStart !== "number" ||
                              typeof selectionEnd !== "number"
                            ) {
                              return currentValue
                                ? `${currentValue}\n${transcript}`
                                : transcript;
                            }

                            const before = currentValue.slice(0, selectionStart);
                            const after = currentValue.slice(selectionEnd);
                            const needsLeadingSpace =
                              before &&
                              !/\s$/.test(before) &&
                              !/^[\s,.;:!?]/.test(transcript);
                            const insertion = `${
                              needsLeadingSpace ? " " : ""
                            }${transcript}`;
                            const nextValue = `${before}${insertion}${after}`;
                            const nextCaret = before.length + insertion.length;

                            quickItemDetailsSelectionRef.current = {
                              start: nextCaret,
                              end: nextCaret,
                            };

                            return nextValue;
                          });
                        }}
                      />
                    </div>
                  </fieldset>
                  {itemDetailsStatus === "loading" && (
                    <span className="quickHint">{itemDetailsMessage}</span>
                  )}
                  {itemDetailsStatus === "error" && itemDetailsMessage && (
                    <span className="error">{itemDetailsMessage}</span>
                  )}
                </div>

                <div
                  className={`quickStep ${
                    quickStepLocks.category ? "quickStepLocked" : ""
                  } field`}
                  ref={(el) => {
                    quickStepRefs.current[2] = el;
                  }}
                >
                  <span className="quickStepLabel">Category</span>
                  <fieldset
                    disabled={quickStepLocks.category}
                    className="quickStepFieldset"
                  >
                    <div className="quick-category">
                      <input
                        className="fieldInput"
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
                  </fieldset>
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

                <div
                  className={`quickStep ${
                    quickStepLocks.size ? "quickStepLocked" : ""
                  } field`}
                  ref={(el) => {
                    quickStepRefs.current[3] = el;
                  }}
                >
                  <span className="quickStepLabel">Size</span>
                  <fieldset
                    disabled={quickStepLocks.size}
                    className="quickStepFieldset"
                  >
                    <input
                      className="fieldInput"
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
                  </fieldset>
                </div>

                <div
                  className={`quickStep ${
                    quickStepLocks.description ? "quickStepLocked" : ""
                  } field`}
                  ref={(el) => {
                    quickStepRefs.current[4] = el;
                  }}
                >
                  <span className="quickStepLabel">Description</span>
                  <fieldset
                    disabled={quickStepLocks.description}
                    className="quickStepFieldset"
                  >
                    <textarea
                      className="fieldTextarea"
                      ref={quickDescriptionRef}
                      name="shopifyDescription"
                      value={form.shopifyDescription}
                      onChange={handleChange}
                      onKeyDown={handleQuickDescriptionKeyDown}
                      placeholder="Short description for the listing."
                    />
                  </fieldset>
                </div>

                <div
                  className={`quickStep ${
                    quickStepLocks.condition ? "quickStepLocked" : ""
                  } field`}
                  ref={(el) => {
                    quickStepRefs.current[5] = el;
                  }}
                >
                  <span className="quickStepLabel">Condition</span>
                  <fieldset
                    disabled={quickStepLocks.condition}
                    className="quickStepFieldset"
                  >
                    <ConditionControl
                      value={form.condition}
                      conditionNumber={conditionNumber}
                      conditionProgress={conditionProgress}
                      onChange={handleConditionChange}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleQuickAdvance(6);
                        }
                      }}
                      inputRef={quickConditionRef}
                      className="quickCondition"
                      valuePrefix=""
                      valueClassName="conditionValue"
                    />
                  </fieldset>
                </div>

                <div
                  className={`quickStep ${
                    quickStepLocks.cost ? "quickStepLocked" : ""
                  } field`}
                  ref={(el) => {
                    quickStepRefs.current[6] = el;
                  }}
                >
                  <span className="quickStepLabel">Intake cost</span>
                  <fieldset
                    disabled={quickStepLocks.cost}
                    className="quickStepFieldset"
                  >
                    <input
                      className="fieldInput"
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
                  </fieldset>
                </div>

                <div
                  className={`quickStep ${
                    quickStepLocks.price ? "quickStepLocked" : ""
                  } field`}
                  ref={(el) => {
                    quickStepRefs.current[7] = el;
                  }}
                >
                  <span className="quickStepLabel">Sell price</span>
                  <fieldset
                    disabled={quickStepLocks.price}
                    className="quickStepFieldset"
                  >
                    <input
                      className="fieldInput"
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
                  </fieldset>
                </div>

                <div
                  className={`quickStep ${
                    quickStepLocks.vendor ? "quickStepLocked" : ""
                  } field`}
                  ref={(el) => {
                    quickStepRefs.current[8] = el;
                  }}
                >
                  <span className="quickStepLabel">Vendor</span>
                  <fieldset
                    disabled={quickStepLocks.vendor}
                    className="quickStepFieldset"
                  >
                    <input
                      className="fieldInput"
                      ref={quickVendorRef}
                      name="vendorSource"
                      value={form.vendorSource}
                      onChange={handleChange}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          handleQuickAdvance(9);
                        }
                      }}
                      placeholder="Vendor"
                      autoComplete="off"
                    />
                  </fieldset>
                </div>

                <div
                  className={`quickStep ${
                    quickStepLocks.location ? "quickStepLocked" : ""
                  } field`}
                  ref={(el) => {
                    quickStepRefs.current[9] = el;
                  }}
                >
                  <span className="quickStepLabel">Location</span>
                  <fieldset
                    disabled={quickStepLocks.location}
                    className="quickStepFieldset"
                  >
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
                            handleLocationSelect(option.value)
                          }
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>

                {quickStep >= 10 && (
                  <div
                    className="quickStep field"
                    ref={(el) => {
                      quickStepRefs.current[10] = el;
                    }}
                  >
                    <span className="quickStepLabel">Save intake</span>
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
                        <span className="success">
                          Saved{quickSavedId ? ` (id: ${quickSavedId})` : ""}
                        </span>
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
                      <strong>
                        {typeof preview.price_cents === "number"
                          ? formatUSD((preview.price_cents / 100).toFixed(2))
                          : "--"}
                      </strong>
                    </div>
                    <div className="summary-row">
                      <span>Category</span>
                      <strong>{preview.category || "--"}</strong>
                    </div>
                    <div className="summary-row">
                      <span>Size</span>
                      <strong>{form.size || "--"}</strong>
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
                {brandLocked && (
                  <div className="section-heading">
                    <div />
                    <div className="quick-mode-toggle">
                      <button
                        type="button"
                        className="text-button"
                        onClick={handleBrandEdit}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                )}
                <BrandSpotlightInput
                  value={form.brand}
                  ghostRemainder={ghostRemainder}
                  inputRef={brandInputRef}
                  onChange={handleChange}
                  onKeyDown={handleBrandKeyDown}
                  placeholder="Start typing a brand"
                  readOnly={brandLocked}
                />
              </section>

              <section className="intake-section">
                <div className="section-heading">
                  <div>
                    <h2>Core identity</h2>
                  </div>
                </div>
                <div className="field-grid three">
                  <label className="field">
                    <span className="fieldLabel">Item name</span>
                    <input
                      className="fieldInput"
                      ref={itemNameRef}
                      name="itemName"
                      value={form.itemName}
                      onChange={handleChange}
                      placeholder="Pony Hair Ramones"
                    />
                  </label>
                  <label className="field">
                    <span className="fieldLabel">Category</span>
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
                    <span className="fieldLabel">Item size</span>
                    <input
                      className="fieldInput"
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
                    <span className="fieldLabel">Shopify description</span>
                    <textarea
                      className="fieldTextarea"
                      name="shopifyDescription"
                      value={form.shopifyDescription}
                      onChange={handleChange}
                      placeholder="Short description for the listing."
                    />
                  </label>
                  <div className="field condition-field">
                    <span className="fieldLabel">Item condition</span>
                    <ConditionControl
                      value={form.condition}
                      conditionNumber={conditionNumber}
                      conditionProgress={conditionProgress}
                      onChange={handleConditionChange}
                    />
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
                    <span className="fieldLabel">Intake cost</span>
                    <input
                      className="fieldInput"
                      name="cost"
                      value={formatUSD(form.cost)}
                      onChange={handleCurrencyChange}
                      placeholder="$250"
                    />
                  </label>
                  <label className="field">
                    <span className="fieldLabel">Sell price</span>
                    <input
                      className="fieldInput"
                      name="price"
                      value={formatUSD(form.price)}
                      onChange={handleCurrencyChange}
                      placeholder="$695"
                    />
                  </label>
                  <label className="field">
                    <span className="fieldLabel">Consignee / Vendor</span>
                    <input
                      className="fieldInput"
                      name="vendorSource"
                      value={form.vendorSource}
                      onChange={handleChange}
                      placeholder="Vendor"
                      autoComplete="off"
                    />
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
                        handleLocationSelect(option.value)
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
                  <span className="success">
                    Saved{savedId ? ` (id: ${savedId})` : ""}
                  </span>
                )}
                {status === "error" && <span className="error">{error}</span>}
              </div>
            </>
          )}

          <section className="intake-section">
            <div className="section-heading">
              <div>
                <h2>Recent saves</h2>
                <p className="hint">Latest 10 rows saved to Postgres.</p>
              </div>
            </div>

            {recentStatus === "loading" && (
              <p className="hint">Loading recent saves…</p>
            )}
            {recentStatus === "error" && (
              <div className="error">{recentError}</div>
            )}
            {recentStatus !== "loading" && recentItems.length === 0 && (
              <p className="hint">No recent saves yet.</p>
            )}
            {recentItems.length > 0 && (
              <ul className="checklist-list">
                {recentItems.map((item, index) => {
                  const createState = shopifyCreateState[item?.id] || {};
                  const isCreating = createState.status === "loading";

                  return (
                    <li
                      key={
                        item?.id
                          ? String(item.id)
                          : `${String(item?.created_at ?? "row")}-${index}`
                      }
                    >
                      <div style={{ display: "grid", gap: 4 }}>
                        <div>
                          <strong className="preview-value">
                            {item?.title || "(untitled)"}
                          </strong>
                        </div>
                        <div className="hint">
                          {item?.brand ? `Brand: ${item.brand}` : null}
                          {item?.brand && item?.category ? " · " : null}
                          {item?.category ? `Category: ${item.category}` : null}
                          {(item?.brand || item?.category) && item?.condition
                            ? " · "
                            : null}
                          {item?.condition
                            ? `Condition: ${item.condition}`
                            : null}
                          {(item?.brand ||
                            item?.category ||
                            item?.condition) &&
                          item?.price_cents !== null &&
                          item?.price_cents !== undefined
                            ? " · "
                            : null}
                          {item?.price_cents !== null &&
                          item?.price_cents !== undefined
                            ? `Price: ${formatPriceCents(item.price_cents)}`
                            : null}
                        </div>
                        <div className="hint">
                          id: {String(item?.id ?? "")}
                          {item?.created_at ? " · " : null}
                          {item?.created_at
                            ? formatDateTime(item.created_at)
                            : null}
                        </div>
                        <div
                          className="hint"
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            className="primary-button"
                            disabled={isCreating}
                            onClick={() => handleCreateShopifyProduct(item?.id)}
                          >
                            {isCreating ? "Creating..." : "Create in Shopify"}
                          </button>
                          {createState.status === "success" && (
                            <span className="success">
                              {createState.message || "Created product."}
                            </span>
                          )}
                          {createState.status === "error" && (
                            <span className="error">
                              {createState.message || "Unable to create product."}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </form>

        <ShopifyPreview
          preview={preview}
          titlePreview={titlePreview}
          descriptionPreview={descriptionPreview}
          conditionNumber={conditionNumber}
          form={form}
          locationLabel={locationLabel}
        />
      </div>
    </main>
  );
}
