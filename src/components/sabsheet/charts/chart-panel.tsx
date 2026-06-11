"use client";

/**
 * SabSheet charts — side panel.
 *
 * Opened from the ribbon's "Insert > Chart" with the current selection's already-read
 * cells + box. Lets the user pick a chart type and toggle header row/col, previews the
 * result live (via `extractChartData` + `<ChartView>`), and saves the spec through the
 * `createChart` server action. Styled with inline styles matching `chrome/ribbon.tsx`.
 */
import * as React from "react";

import type { CellView } from "../../../lib/sabsheet/commands/ops.ts";
import { createChart } from "@/app/actions/sabsheet-charts.actions";
import type { ChartType } from "@/lib/sabsheet/charts/types";

import { extractChartData, type ChartBox } from "./chart-data.ts";
import { ChartView } from "./chart-view.tsx";

export interface ChartPanelProps {
  /** Cells already read from the current selection (sparse — only non-empty). */
  cells: CellView[];
  /** The selection rectangle (1-based, inclusive). */
  box: ChartBox;
  workbookId: string;
  sheetId: string;
  onClose: () => void;
  /** Called with the new chart id after a successful save. */
  onSaved?: (chartId: string) => void;
}

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "area", label: "Area" },
  { value: "pie", label: "Pie" },
];

export function ChartPanel({
  cells,
  box,
  workbookId,
  sheetId,
  onClose,
  onSaved,
}: ChartPanelProps) {
  const [type, setType] = React.useState<ChartType>("bar");
  const [title, setTitle] = React.useState("");
  const [headerRow, setHeaderRow] = React.useState(true);
  const [headerCol, setHeaderCol] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const spec = React.useMemo(
    () => ({ type, title: title.trim() || undefined, headerRow, headerCol }),
    [type, title, headerRow, headerCol],
  );

  const data = React.useMemo(
    () => extractChartData(cells, box, { headerRow, headerCol }),
    [cells, box, headerRow, headerCol],
  );

  const handleSave = React.useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const chart = await createChart({
        workbookId,
        sheetId,
        range: { top: box.top, left: box.left, bottom: box.bottom, right: box.right },
        spec,
      });
      onSaved?.(chart._id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save chart.");
    } finally {
      setSaving(false);
    }
  }, [workbookId, sheetId, box, spec, onSaved, onClose]);

  return (
    <aside style={panel} role="dialog" aria-label="Insert chart">
      <header style={head}>
        <span style={headTitle}>Insert chart</span>
        <button type="button" style={closeBtn} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div style={body}>
        <label style={field}>
          <span style={fieldLabel}>Chart type</span>
          <select
            style={select}
            value={type}
            onChange={(e) => setType(e.target.value as ChartType)}
          >
            {CHART_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label style={field}>
          <span style={fieldLabel}>Title (optional)</span>
          <input
            style={input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Chart title"
          />
        </label>

        <label style={checkRow}>
          <input
            type="checkbox"
            checked={headerRow}
            onChange={(e) => setHeaderRow(e.target.checked)}
          />
          <span>First row is series names</span>
        </label>

        <label style={checkRow}>
          <input
            type="checkbox"
            checked={headerCol}
            onChange={(e) => setHeaderCol(e.target.checked)}
          />
          <span>First column is category labels</span>
        </label>

        <div style={previewWrap}>
          <div style={previewLabel}>Preview</div>
          <ChartView spec={spec} data={data} height={220} />
        </div>

        {error ? <div style={errorBox} role="alert">{error}</div> : null}
      </div>

      <footer style={foot}>
        <button type="button" style={ghostBtn} onClick={onClose} disabled={saving}>
          Cancel
        </button>
        <button
          type="button"
          style={primaryBtn}
          onClick={handleSave}
          disabled={saving || data.series.length === 0}
        >
          {saving ? "Saving…" : "Save chart"}
        </button>
      </footer>
    </aside>
  );
}

export default ChartPanel;

/* ---- styles (mirroring chrome/ribbon.tsx) ------------------------------- */

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

const input: React.CSSProperties = {
  height: 30,
  border: "1px solid #e1e3e6",
  borderRadius: 4,
  font: FONT,
  padding: "0 8px",
};

const checkRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "#202124",
  cursor: "pointer",
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
