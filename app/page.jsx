"use client";

import { useState } from "react";

export default function HomePage() {
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState({ type: "idle", message: "" });

  const isSaving = status.type === "saving";

  const handleSave = async () => {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
      setStatus({ type: "error", message: "Title is required." });
      return;
    }

    setStatus({ type: "saving", message: "Saving..." });

    try {
      const response = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: normalizedTitle }),
      });

      if (!response.ok) {
        setStatus({
          type: "error",
          message: `Save failed (${response.status}).`,
        });
        return;
      }

      setStatus({ type: "success", message: "Saved." });
    } catch {
      setStatus({ type: "error", message: "Save failed (network error)." });
    }
  };

  const messageColor =
    status.type === "error"
      ? "crimson"
      : status.type === "success"
        ? "green"
        : "inherit";

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1 style={{ marginBottom: "1rem" }}>Inventory Intake</h1>

      <div style={{ display: "grid", gap: "0.5rem" }}>
        <label htmlFor="intake-title">Title</label>
        <input
          id="intake-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Weekly intake"
          autoComplete="off"
          style={{ padding: "0.5rem", borderRadius: 6, border: "1px solid #ccc" }}
        />

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save"}
          </button>
          <div aria-live="polite" style={{ minHeight: 20, color: messageColor }}>
            {status.message}
          </div>
        </div>
      </div>
    </main>
  );
}
