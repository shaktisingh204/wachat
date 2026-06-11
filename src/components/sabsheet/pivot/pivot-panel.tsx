"use client";

/**
 * SabSheet pivot tables — side panel.
 *
 * Opened from the ribbon's "Insert > Pivot" with the current selection's already-read
 * cells + box. Treats the first selected row as headers (column names) and lets the
 * user pick a row field / col field / value field + aggregation, previews the result
 * live (via `computePivot` + `<PivotView>`), and saves the config through the
 * `createPivot` server action. Styled with inline styles matching `chrome/ribbon.tsx`
 * — its prop shape EXACTLY mirrors `ChartPanel` so the parent wires it identically.
 */
import * as React from "react";

import type { CellView } from "../../../lib/sabsheet/commands/ops.ts";
import { createPivot } from "@/app/actions/sabsheet-pivots.actions";

import {
  computePivot,
  type PivotAgg,
  type PivotBox,
  type PivotConfig,
} from "./pivot-compute.ts";
import { PivotView } from "./pivot-view.tsx";

export interface PivotPanelProps {
  /** Cells already read from the current selection (sparse — only non-empty). */
  cells: CellView[];
  /** The selection rectangle (1-based, inclusive). */
  box: PivotBox;
  workbookId: string;
  sheetId: string;
  onClose: () => void;
  /** Called with the new pivot id after a successful save. */
  onSaved?: (pivotId: string) => void;
}

const AGGS: { value: PivotAgg; label: string }[] = [
  { value: "sum", label: "Sum" },
  { value: "count", label: "Count" },
  { value: "average", label: "Average" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
];

/** Read the header row (offset 0 of the box) into 0-based field options. */
function useHeaders(cells: CellView[], box: PivotBox): { offset: number; label: string }[] {
  return React.useMemo(() => {
    const top = Math.min(box.top, box.bottom);
    const left = Math.min(box.left, box.right);
    const right = Math.max(box.left, box.right);
    const colCount = right - left + 1;
    const headers: string[] = Array.from({ length: colCount }, () => "");
    for (const c of cells) {
      if (c.row !== top) continue;
      if (c.col < left || c.col > right) continue;
      headers[c.col - left] = c.text ?? "";
    }
    return headers.map((h, i) => ({
      offset: i,
      label: h.trim() || `Column ${i + 1}`,
    }));
  }, [cells, box]);
}

export function PivotPanel({
  cells,
  box,
  workbookId,
  sheetId,
  onClose,
  onSaved,
}: PivotPanelProps) {
  const headers = useHeaders(cells, box);

  const [rowField, setRowField] = React.useState(0);
  const [colField, setColField] = React.useState<number | null>(null);
  const [valueField, setValueField] = React.useState(() =>
    headers.length > 1 ? headers.length - 1 : 0,
  );
  const [agg, setAgg] = React.useState<PivotAgg>("sum");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const config = React.useMemo<PivotConfig>(
    () => ({ rowField, colField, valueField, agg }),
    [rowField, colField, valueField, agg],
  );

  const result = React.useMemo(
    () => computePivot(cells, box, config),
    [cells, box, config],
  );

  const handleSave = React.useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const pivot = await createPivot({
        workbookId,
        sheetId,
        range: { top: box.top, left: box.left, bottom: box.bottom, right: box.right },
        config,
      });
      onSaved?.(pivot._id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save pivot.");
    } finally {
      setSaving(false);
    }
  }, [workbookId, sheetId, box, config, onSaved, onClose]);

  return (
    <aside style={panel} role="dialog" aria-label="Insert pivot table">
      <header style={head}>
        <span style={headTitle}>Insert pivot table</span>
        <button type="button" style={closeBtn} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div style={body}>
        <label style={field}>
          <span style={fieldLabel}>Rows</span>
          <select
            style={select}
            value={rowField}
            onChange={(e) => setRowField(Number(e.target.value))}
          >
            {headers.map((h) => (
              <option key={`row-${h.offset}`} value={h.offset}>
                {h.label}
              </option>
            ))}
          </select>
        </label>

        <label style={field}>
          <span style={fieldLabel}>Columns (optional)</span>
          <select
            style={select}
            value={colField === null ? "" : colField}
            onChange={(e) =>
              setColField(e.target.value === "" ? null : Number(e.target.value))
            }
          >
            <option value="">(none)</option>
            {headers.map((h) => (
              <option key={`col-${h.offset}`} value={h.offset}>
                {h.label}
              </option>
            ))}
          </select>
        </label>

        <label style={field}>
          <span style={fieldLabel}>Values</span>
          <select
            style={select}
            value={valueField}
            onChange={(e) => setValueField(Number(e.target.value))}
          >
            {headers.map((h) => (
              <option key={`val-${h.offset}`} value={h.offset}>
                {h.label}
              </option>
            ))}
          </select>
        </label>

        <label style={field}>
          <span style={fieldLabel}>Aggregation</span>
          <select
            style={select}
            value={agg}
            onChange={(e) => setAgg(e.target.value as PivotAgg)}
          >
            {AGGS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </label>

        <div style={previewWrap}>
          <div style={previewLabel}>Preview</div>
          <PivotView result={result} />
        </div>

        {error ? (
          <div style={errorBox} role="alert">
            {error}
          </div>
        ) : null}
      </div>

      <footer style={foot}>
        <button type="button" style={ghostBtn} onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          style={primaryBtn}
          onClick={handleSave}
          disabled={saving || result.rowKeys.length === 0}
        >
          {saving ? "Saving…" : "Save pivot"}
        </button>
      </footer>
    </aside>
  );
}

export default PivotPanel;

/* ---- styles (mirroring chrome/ribbon.tsx + chart-panel.tsx) ------------- */

const FONT = "13px -apple-system, system-ui, sans-serif";

const panel: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  width: 340,
  display: "flex",
  flexDirection: "column",
  background: "#fff",
  borderLeft: "1px solid #e1e3e6",
  boxShadow: "-2px 0 8px rgba(0,0,0,0.06)",
  font: FONT,
  zIndex: 30,
};

const head: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 14px",
  borderBottom: "1px solid #f1f3f4",
};

const headTitle: React.CSSProperties = { fontWeight: 600, color: "#202124" };

const closeBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#5f6368",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  padding: 4,
};

const body: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };

const fieldLabel: React.CSSProperties = { fontSize: 11, color: "#5f6368" };

const select: React.CSSProperties = {
  height: 30,
  border: "1px solid #e1e3e6",
  borderRadius: 4,
  font: FONT,
  padding: "0 6px",
};

const previewWrap: React.CSSProperties = {
  border: "1px solid #f1f3f4",
  borderRadius: 6,
  padding: 8,
  background: "#fafbfc",
};

const previewLabel: React.CSSProperties = {
  fontSize: 11,
  color: "#9aa0a6",
  marginBottom: 6,
};

const errorBox: React.CSSProperties = {
  fontSize: 12,
  color: "#c5221f",
  background: "#fce8e6",
  border: "1px solid #f5c6c2",
  borderRadius: 4,
  padding: "6px 10px",
};

const foot: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 8,
  padding: "10px 14px",
  borderTop: "1px solid #f1f3f4",
};

const ghostBtn: React.CSSProperties = {
  height: 30,
  padding: "0 14px",
  border: "1px solid #e1e3e6",
  borderRadius: 4,
  background: "#fff",
  color: "#202124",
  cursor: "pointer",
  font: FONT,
};

const primaryBtn: React.CSSProperties = {
  height: 30,
  padding: "0 16px",
  border: "1px solid #1a73e8",
  borderRadius: 4,
  background: "#1a73e8",
  color: "#fff",
  cursor: "pointer",
  font: FONT,
};
