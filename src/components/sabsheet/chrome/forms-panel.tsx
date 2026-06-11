"use client";

/**
 * Forms side panel — list/create Airtable-style public intake forms for a workbook. Each form binds to
 * the workbook's first (default) sheet and maps fields to columns A, B, C… in order. Submissions
 * append a row via the public route `/sabsheet/form/<token>` (built by the forms backend).
 *
 * Note: v2 worksheets live inside the engine snapshot, so only the default sheet has a Mongo
 * `sabsheet_sheets` doc (created at workbook creation) — forms target that sheet for now.
 */
import { useCallback, useEffect, useState } from "react";
import { listForms, createForm, deleteForm } from "../../../app/actions/sabsheet-forms.actions.ts";
import { listSabsheetSheets } from "../../../app/actions/sabsheet.actions.ts";
import type { SabsheetForm } from "../../../lib/sabsheet/forms/types.ts";

export interface FormsPanelProps {
  workbookId: string;
  onClose: () => void;
}

export function FormsPanel({ workbookId, onClose }: FormsPanelProps) {
  const [forms, setForms] = useState<SabsheetForm[]>([]);
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled form");
  const [fieldLabels, setFieldLabels] = useState("Name, Email, Message");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [f, sheets] = await Promise.all([listForms(workbookId), listSabsheetSheets(workbookId)]);
      setForms(f);
      setSheetId(sheets[0]?._id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load forms");
    }
  }, [workbookId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = async () => {
    if (!sheetId) {
      setError("No sheet to bind the form to.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const labels = fieldLabels.split(",").map((s) => s.trim()).filter(Boolean);
      await createForm({
        workbookId,
        sheetId,
        title: title.trim() || "Untitled form",
        fields: labels.map((label, i) => ({ columnIndex: i, label, type: "text" as const, required: false })),
      });
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create form");
    } finally {
      setBusy(false);
    }
  };

  const publicUrl = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/sabsheet/form/${token}` : `/sabsheet/form/${token}`;

  return (
    <div style={panel}>
      <div style={head}>
        <strong>Forms</strong>
        <button style={x} onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div style={body}>
        <div style={card}>
          <div style={sec}>New form</div>
          <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Form title" />
          <input
            style={input}
            value={fieldLabels}
            onChange={(e) => setFieldLabels(e.target.value)}
            placeholder="Field labels (comma-separated)"
          />
          <div style={{ fontSize: 11, color: "#9aa0a6", marginBottom: 6 }}>
            Fields map to columns A, B, C… on the first sheet.
          </div>
          <button style={primary} onClick={() => void create()} disabled={busy}>
            {busy ? "Creating…" : "Create form"}
          </button>
        </div>

        {error && <div style={{ color: "#c5221f", fontSize: 12, margin: "8px 0" }}>{error}</div>}

        <div style={sec}>Your forms ({forms.length})</div>
        {forms.map((f) => (
          <div key={f._id} style={card}>
            <div style={{ fontWeight: 600 }}>{f.title}</div>
            <div style={{ fontSize: 11, color: "#5f6368", margin: "4px 0" }}>
              {f.fields.length} fields · {f.submitCount} responses · {f.status}
            </div>
            <input readOnly style={{ ...input, fontSize: 11 }} value={publicUrl(f.token)} onFocus={(e) => e.target.select()} />
            <div style={{ display: "flex", gap: 8 }}>
              <a href={publicUrl(f.token)} target="_blank" rel="noreferrer" style={link}>Open</a>
              <button
                style={link}
                onClick={async () => {
                  await deleteForm(f._id);
                  await reload();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const FONT = "13px -apple-system, system-ui, sans-serif";
const panel: React.CSSProperties = { width: 320, height: "100%", borderLeft: "1px solid #e1e3e6", background: "#fff", display: "flex", flexDirection: "column", font: FONT };
const head: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid #e1e3e6" };
const body: React.CSSProperties = { flex: 1, overflowY: "auto", padding: 12 };
const card: React.CSSProperties = { border: "1px solid #e1e3e6", borderRadius: 8, padding: 12, marginBottom: 12 };
const sec: React.CSSProperties = { fontSize: 11, color: "#9aa0a6", textTransform: "uppercase", letterSpacing: 0.4, margin: "4px 0 8px" };
const input: React.CSSProperties = { width: "100%", height: 30, border: "1px solid #e1e3e6", borderRadius: 4, font: FONT, padding: "0 8px", marginBottom: 8, boxSizing: "border-box" };
const primary: React.CSSProperties = { height: 32, padding: "0 16px", border: "none", borderRadius: 6, background: "#1a73e8", color: "#fff", font: FONT, cursor: "pointer" };
const link: React.CSSProperties = { color: "#1a73e8", background: "none", border: "none", padding: 0, cursor: "pointer", font: FONT, textDecoration: "none" };
const x: React.CSSProperties = { border: "none", background: "none", cursor: "pointer", color: "#5f6368", fontSize: 14 };
