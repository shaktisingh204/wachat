"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSabsheetWorkbook } from "@/app/actions/sabsheet.actions";

/**
 * The "Blank spreadsheet" template card (Google-Sheets-home style): a white card with the
 * multicolor plus. Creates a fresh workbook and opens it in the editor.
 */
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
    <div className="sbsl-tpl">
      <button className="sbsl-card" onClick={create} disabled={pending} aria-label="Create a blank spreadsheet">
        {pending ? (
          <span style={{ color: "#5f6368", font: "13px -apple-system, system-ui, sans-serif" }}>Creating…</span>
        ) : (
          <svg width="52" height="52" viewBox="0 0 64 64" aria-hidden>
            <rect x="8" y="26" width="24" height="12" rx="2" fill="#fbbc04" />
            <rect x="32" y="26" width="24" height="12" rx="2" fill="#ea4335" />
            <rect x="26" y="8" width="12" height="24" rx="2" fill="#4285f4" />
            <rect x="26" y="32" width="12" height="24" rx="2" fill="#34a853" />
          </svg>
        )}
      </button>
      <div className="sbsl-tlabel">Blank spreadsheet</div>
      {error && <div style={{ color: "#c5221f", fontSize: 12, marginTop: 4 }}>{error}</div>}
    </div>
  );
}
