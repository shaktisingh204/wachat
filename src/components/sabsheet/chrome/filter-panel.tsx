"use client";

/**
 * Auto-filter panel: the selection's first row is treated as headers; each column shows a checklist of
 * its distinct values. Unchecking values hides the matching rows (client-side). Session view state —
 * not persisted (like Excel's filter dropdowns, applied per session here).
 */
import { useMemo, useState } from "react";
import { distinctByColumn, computeHiddenRows, type ColumnFilters } from "../data/filter.ts";
import type { CellView } from "../../../lib/sabsheet/commands/ops.ts";

export interface FilterPanelProps {
  cells: CellView[];
  box: { top: number; left: number; bottom: number; right: number };
  onApply: (hiddenRows: number[]) => void;
  onClear: () => void;
  onClose: () => void;
}

function headerLabel(cells: CellView[], box: FilterPanelProps["box"], offset: number): string {
  const col = box.left + offset;
  const h = cells.find((c) => c.row === box.top && c.col === col)?.text;
  if (h) return h;
  let n = col, s = "";
  while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

export function FilterPanel({ cells, box, onApply, onClear, onClose }: FilterPanelProps) {
  const distinct = useMemo(() => distinctByColumn(cells, box), [cells, box]);
  // checked[offset] = Set of currently-shown values; start all-checked.
  const [checked, setChecked] = useState<Record<number, Set<string>>>(() => {
    const init: Record<number, Set<string>> = {};
    for (const [off, vals] of Object.entries(distinct)) init[Number(off)] = new Set(vals);
    return init;
  });

  const toggle = (offset: number, value: string) =>
    setChecked((prev) => {
      const next = new Set(prev[offset]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [offset]: next };
    });

  const apply = () => {
    const filters: ColumnFilters = {};
    for (const [off, vals] of Object.entries(distinct)) {
      const offset = Number(off);
      const shown = checked[offset];
      // A column with all values checked imposes no constraint.
      if (shown && shown.size < vals.length) filters[offset] = [...shown];
    }
    onApply(computeHiddenRows(cells, box, filters));
  };

  return (
    <div style={panel}>
      <div style={head}>
        <strong>Filter</strong>
        <button style={x} onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div style={body}>
        {Object.entries(distinct).map(([off, vals]) => {
          const offset = Number(off);
          return (
            <div key={off} style={card}>
              <div style={sec}>{headerLabel(cells, box, offset)}</div>
              <div style={{ maxHeight: 160, overflowY: "auto" }}>
                {vals.map((v) => (
                  <label key={v} style={item}>
                    <input
                      type="checkbox"
                      checked={checked[offset]?.has(v) ?? true}
                      onChange={() => toggle(offset, v)}
                    />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v === "" ? "(blank)" : v}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={foot}>
        <button style={primary} onClick={apply}>Apply</button>
        <button style={ghost} onClick={onClear}>Clear filter</button>
      </div>
    </div>
  );
}

const FONT = "13px -apple-system, system-ui, sans-serif";
const panel: React.CSSProperties = { width: 280, height: "100%", borderLeft: "1px solid #e1e3e6", background: "#fff", display: "flex", flexDirection: "column", font: FONT };
const head: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid #e1e3e6" };
const body: React.CSSProperties = { flex: 1, overflowY: "auto", padding: 12 };
const foot: React.CSSProperties = { display: "flex", gap: 8, padding: 12, borderTop: "1px solid #e1e3e6" };
const card: React.CSSProperties = { border: "1px solid #e1e3e6", borderRadius: 8, padding: 10, marginBottom: 12 };
const sec: React.CSSProperties = { fontSize: 11, color: "#9aa0a6", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 };
const item: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#202124", padding: "2px 0" };
const primary: React.CSSProperties = { height: 32, padding: "0 16px", border: "none", borderRadius: 6, background: "#1a73e8", color: "#fff", font: FONT, cursor: "pointer" };
const ghost: React.CSSProperties = { height: 32, padding: "0 12px", border: "1px solid #e1e3e6", borderRadius: 6, background: "#fff", color: "#202124", font: FONT, cursor: "pointer" };
const x: React.CSSProperties = { border: "none", background: "none", cursor: "pointer", color: "#5f6368", fontSize: 14 };
