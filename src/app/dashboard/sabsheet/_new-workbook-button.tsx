"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSabsheetWorkbook } from "@/app/actions/sabsheet.actions";

/** Creates a fresh persistent v2 workbook and opens it. */
export function NewWorkbookButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const create = () =>
    start(async () => {
      setError(null);
      try {
        const wb = await createSabsheetWorkbook({ title: "Untitled spreadsheet" });
        router.push(`/dashboard/sabsheet/${wb._id}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to create");
      }
    });

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button
        onClick={create}
        disabled={pending}
        style={{
          height: 40,
          padding: "0 20px",
          border: "none",
          borderRadius: 8,
          background: "#1a73e8",
          color: "#fff",
          font: "600 14px -apple-system, system-ui, sans-serif",
          cursor: pending ? "default" : "pointer",
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? "Creating…" : "+ New spreadsheet"}
      </button>
      {error && <span style={{ color: "#c5221f", fontSize: 12 }}>{error}</span>}
    </div>
  );
}
