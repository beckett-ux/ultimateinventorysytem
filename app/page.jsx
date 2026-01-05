"use client";

import { useMemo, useState } from "react";

const defaultForm = {
  brand: "",
  itemName: "",
  category: "",
  subCategory: "",
  size: "",
  condition: "",
  cost: "",
  price: "",
  location: "",
};

export default function Home() {
  const [form, setForm] = useState(defaultForm);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState(null);

  const titlePreview = useMemo(() => {
    const parts = [form.brand, form.category, form.subCategory]
      .map((value) => value.trim())
      .filter(Boolean);
    return parts.length ? parts.join(" ") : "";
  }, [form.brand, form.category, form.subCategory]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
    <main>
      <h1>Inventory Intake</h1>
      <p>
        Start a 1-of-1 intake and preview the GPT-normalized output before it
        hits Shopify.
      </p>

      <form onSubmit={handleSubmit}>
        <label>
          Brand
          <input name="brand" value={form.brand} onChange={handleChange} />
        </label>
        <label>
          Item name
          <input name="itemName" value={form.itemName} onChange={handleChange} />
        </label>
        <label>
          Category
          <input name="category" value={form.category} onChange={handleChange} />
        </label>
        <label>
          Sub-category
          <input
            name="subCategory"
            value={form.subCategory}
            onChange={handleChange}
          />
        </label>
        <label>
          Size
          <input name="size" value={form.size} onChange={handleChange} />
        </label>
        <label>
          Condition
          <input name="condition" value={form.condition} onChange={handleChange} />
        </label>
        <label>
          Intake cost
          <input name="cost" value={form.cost} onChange={handleChange} />
        </label>
        <label>
          Price
          <input name="price" value={form.price} onChange={handleChange} />
        </label>
        <label>
          Location
          <select name="location" value={form.location} onChange={handleChange}>
            <option value="">Select location</option>
            <option value="dupont">DuPont</option>
            <option value="charlotte">Charlotte</option>
          </select>
        </label>

        <button type="submit" disabled={status === "loading"}>
          {status === "loading" ? "Validating..." : "Validate intake"}
        </button>
      </form>

      <section className="preview">
        <strong>Live title preview</strong>
        <div>{titlePreview || "Waiting on input..."}</div>

        {status === "error" && <div className="code-block">{error}</div>}
        {preview && (
          <div className="code-block">{JSON.stringify(preview, null, 2)}</div>
        )}
      </section>
    </main>
  );
}
