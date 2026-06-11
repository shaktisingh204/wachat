"use client";

/**
 * Data validation panel: define dropdown-list rules over the current selection. Cells in a list range
 * then edit via a `<select>` of allowed values. Persisted per workbook; the grid loads + enforces them.
 */
import { useCallback, useEffect, useState } from "react";
import {
  getDataValidations,
  saveDataValidations,
} from "../../../app/actions/sabsheet-validation.actions.ts";
import type { DataValidationRule } from "../../../lib/sabsheet/validation/types.ts";

export interface ValidationPanelProps {
  workbookId: string;
  sheet: number;
  box: { top: number; left: number; bottom: number; right: number };
  onClose: () => void;
  onRulesChange: (rules: DataValidationRule[]) => void;
}

function rangeLabel(b: { top: number; left: number; bottom: number; right: number }): string {
  const col = (c: number) => {
    let n = c, s = "";
    while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  return `${col(b.left)}${b.top}:${col(b.right)}${b.bottom}`;
}

export function ValidationPanel({ workbookId, sheet, box, onClose, onRulesChange }: ValidationPanelProps) {
  const [rules, setRules] = useState<DataValidationRule[]>([]);
  const [items, setItems] = useState("Open, In Progress, Done");

  const reload = useCallback(async () => {
    const r = await getDataValidations(workbookId);
    setRules(r);
    onRulesChange(r);
  }, [workbookId, onRulesChange]);

  useEffect(() => { void reload(); }, [reload]);

  const persist = async (next: DataValidationRule[]) => {
    setRules(next);
    onRulesChange(next);
    await saveDataValidations(workbookId, next);
  };

  const add = async () => {
    const list = items.split(",").map((s) => s.trim()).filter(Boolean);
    if (!list.length) return;
    const rule: DataValidationRule = {
      id: `dv_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      sheet,
      range: box,
      type: "list",
      list,
    };
    await persist([...rules, rule]);
  };

  return (
    <div style={panel}>
      <div style={head}>
        <strong>Data validation</strong>
        <button style={x} onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div style={body}>
        <div style={card}>
          <div style={sec}>New list rule · {rangeLabel(box)}</div>
          <input style={input} value={items} onChange={(e) => setItems(e.target.value)} placeholder="Allowed values (comma-separated)" />
          <div style={{ fontSize: 11, color: "#9aa0a6", marginBottom: 8 }}>
            Cells in this range will edit via a dropdown of these values.
          </div>
          <button style={primary} onClick={() => void add()}>Add rule</button>
        </div>

        <div style={sec}>Rules ({rules.length})</div>
        {rules.map((r) => (
          <div key={r.id} style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12 }}>{rangeLabel(r.range)} · {r.list.length} options</span>
            <button style={linkBtn} onClick={() => void persist(rules.filter((x) => x.id !== r.id))}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const FONT = "13px -apple-system, system-ui, sans-serif";
const panel: React.CSSProperties = { width: 300, height: "100%", borderLeft: "1px solid #e1e3e6", background: "#fff", display: "flex", flexDirection: "column", font: FONT };
const head: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderBottom: "1px solid #e1e3e6" };
const body: React.CSSProperties = { flex: 1, overflowY: "auto", padding: 12 };
const card: React.CSSProperties = { border: "1px solid #e1e3e6", borderRadius: 8, padding: 12, marginBottom: 12 };
const sec: React.CSSProperties = { fontSize: 11, color: "#9aa0a6", textTransform: "uppercase", letterSpacing: 0.4, margin: "4px 0 8px" };
const input: React.CSSProperties = { width: "100%", height: 30, border: "1px solid #e1e3e6", borderRadius: 4, font: FONT, padding: "0 8px", marginBottom: 8, boxSizing: "border-box" };
const primary: React.CSSProperties = { height: 32, padding: "0 16px", border: "none", borderRadius: 6, background: "#1a73e8", color: "#fff", font: FONT, cursor: "pointer" };
const linkBtn: React.CSSProperties = { color: "#1a73e8", background: "none", border: "none", padding: 0, cursor: "pointer", font: FONT };
const x: React.CSSProperties = { border: "none", background: "none", cursor: "pointer", color: "#5f6368", fontSize: 14 };
