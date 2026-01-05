"use client";

import { useMemo, useState } from "react";

import { approvedBrands } from "@/lib/approvedBrands";

const defaultForm = {
  brand: "",
  itemName: "",
  category: "",
  subCategory: "",
  shopifyDescription: "",
  size: "",
  condition: "",
  cost: "",
  price: "",
  location: "",
  vendorSource: "",
  intakeLabel: "",
};

const categoryOptions = [
  "Accessories",
  "Apparel",
  "Bags",
  "Footwear",
  "Jewelry",
  "Outerwear",
  "Specialty",
];

const conditionOptions = [
  "New",
  "Like New",
  "Excellent",
  "Very Good",
  "Good",
  "Fair",
];

const locationOptions = [
  { label: "DuPont Store", value: "dupont" },
  { label: "Charlotte Store", value: "charlotte" },
];

const steps = [
  {
    id: "brand",
    name: "brand",
    label: "Start typing a brand",
    helper: "Press tab to autocomplete from the approved brand list.",
    placeholder: "Rick Owens",
    type: "text",
    list: "approved-brands",
  },
  {
    id: "itemName",
    name: "itemName",
    label: "Describe the item",
    helper: "Keep it short so the title stays tight.",
    placeholder: "Pony Hair Ramones",
    type: "text",
  },
  {
    id: "category",
    name: "category",
    label: "Pick the primary category",
    helper: "This controls the Shopify category path.",
    type: "select",
    options: categoryOptions,
    placeholder: "Choose a category",
  },
  {
    id: "subCategory",
    name: "subCategory",
    label: "Add a sub-category",
    helper: "Example: Sneaker, Tote, Trench.",
    placeholder: "Sneaker",
    type: "text",
  },
  {
    id: "shopifyDescription",
    name: "shopifyDescription",
    label: "Write the listing description",
    helper: "This becomes the Shopify description field.",
    placeholder: "Short description for the listing.",
    type: "text",
  },
  {
    id: "size",
    name: "size",
    label: "Enter the size",
    helper: "Use brand sizing if possible.",
    placeholder: "IT 40",
    type: "text",
  },
  {
    id: "condition",
    name: "condition",
    label: "Select the condition",
    helper: "Match the condition tag used internally.",
    type: "select",
    options: conditionOptions,
    placeholder: "Choose a condition",
  },
  {
    id: "location",
    name: "location",
    label: "Choose a store location",
    helper: "Inventory will be set to 1 at this location.",
    type: "select",
    options: locationOptions,
    placeholder: "Select location",
  },
  {
    id: "vendorSource",
    name: "vendorSource",
    label: "Who did this come from?",
    helper: "Vendor, consignor, or internal source.",
    placeholder: "Consignment - Client Name",
    type: "text",
  },
  {
    id: "intakeLabel",
    name: "intakeLabel",
    label: "Add the intake label",
    helper: "Use the internal identifier or barcode label.",
    placeholder: "INT-2024-0912",
    type: "text",
  },
  {
    id: "cost",
    name: "cost",
    label: "What did we pay?",
    helper: "This becomes the Shopify cost field.",
    placeholder: "$250",
    type: "text",
  },
  {
    id: "price",
    name: "price",
    label: "Set the sell price",
    helper: "This becomes the Shopify price field.",
    placeholder: "$695",
    type: "text",
  },
];

export default function Home() {
  const [form, setForm] = useState(defaultForm);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);

  const titlePreview = useMemo(() => {
    const parts = [form.brand, form.itemName, form.subCategory]
      .map((value) => value.trim())
      .filter(Boolean);
    return parts.length ? parts.join(" ") : "";
  }, [form.brand, form.itemName, form.subCategory]);

  const activeStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const locationLabel =
    locationOptions.find((option) => option.value === form.location)?.label ||
    "";

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleNext = () => {
    if (isLastStep) {
      return;
    }
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
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

  const handleKeyDown = (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();

    if (isLastStep) {
      handleSubmit(event);
    } else {
      handleNext();
    }
  };

  const renderField = () => {
    if (activeStep.type === "select") {
      return (
        <select
          name={activeStep.name}
          value={form[activeStep.name]}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        >
          <option value="">{activeStep.placeholder}</option>
          {activeStep.options.map((option) => {
            if (typeof option === "string") {
              return (
                <option key={option} value={option}>
                  {option}
                </option>
              );
            }

            return (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            );
          })}
        </select>
      );
    }

    return (
      <input
        name={activeStep.name}
        value={form[activeStep.name]}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={activeStep.placeholder}
        list={activeStep.list}
        autoComplete="off"
      />
    );
  };

  return (
    <main className="intake-shell">
      <header className="intake-header">
        <span className="intake-kicker">Inventory Intake</span>
        <h1>Start inventorying</h1>
        <p>
          A guided, ChatGPT-style flow that builds the exact Shopify payload for
          1-of-1 items.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="intake-form">
        <section className="intake-card" key={activeStep.id}>
          <div className="intake-step">
            <span className="step-count">
              Step {stepIndex + 1} of {steps.length}
            </span>
            <h2>{activeStep.label}</h2>
            <p>{activeStep.helper}</p>
          </div>

          <div className="intake-input">{renderField()}</div>

          <div className="intake-actions">
            <button
              type="button"
              className="ghost"
              onClick={handleBack}
              disabled={stepIndex === 0}
            >
              Back
            </button>
            <button
              type={isLastStep ? "submit" : "button"}
              onClick={isLastStep ? undefined : handleNext}
              disabled={status === "loading"}
            >
              {isLastStep
                ? status === "loading"
                  ? "Validating..."
                  : "Generate preview"
                : "Next"}
            </button>
          </div>
        </section>
      </form>

      <section className="intake-preview">
        <div>
          <strong>Live title preview</strong>
          <div className="preview-title">
            {preview?.title || titlePreview || "Waiting on input..."}
          </div>
        </div>

        <div className="preview-meta">
          <div>
            <span>Category</span>
            <strong>
              {form.category && form.subCategory
                ? `${form.category} > ${form.subCategory}`
                : "Select a category"}
            </strong>
          </div>
          <div>
            <span>Size</span>
            <strong>{form.size || "Add size"}</strong>
          </div>
          <div>
            <span>Location</span>
            <strong>{locationLabel || "Pick a store"}</strong>
          </div>
        </div>

        {status === "error" && <div className="code-block">{error}</div>}
        {preview && (
          <details className="code-block">
            <summary>View normalized payload</summary>
            <pre>{JSON.stringify(preview, null, 2)}</pre>
          </details>
        )}
      </section>

      <datalist id="approved-brands">
        {approvedBrands.map((brand) => (
          <option key={brand} value={brand} />
        ))}
      </datalist>
    </main>
  );
}
