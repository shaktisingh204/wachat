"use client";

/**
 * Conditional formatting panel: list/add/delete value-based rules over the current selection. Rules
 * are persisted per workbook and applied client-side by the grid (it re-reads + re-paints on change).
 */
import { useCallback, useEffect, useState } from "react";
import {
  getConditionalFormats,
  saveConditionalFormats,
} from "../../../app/actions/sabsheet-cformat.actions.ts";
import type { CFRule, CFOperator } from "../../../lib/sabsheet/cformat/types.ts";

export interface CFormatPanelProps {
  workbookId: string;
  sheet: number;
  box: { top: number; left: number; bottom: number; right: number };
  onClose: () => void;
  /** Called whenever the rule set changes so the grid can re-apply + repaint. */
  onRulesChange: (rules: CFRule[]) => void;
}

const OPS: { value: CFOperator; label: string; two?: boolean; text?: boolean }[] = [
  { value: "greaterThan", label: "Greater than" },
  { value: "lessThan", label: "Less than" },
  { value: "between", label: "Between", two: true },
  { value: "equalTo", label: "Equal to" },
  { value: "notEqualTo", label: "Not equal to" },
  { value: "textContains", label: "Text contains", text: true },
  { value: "colorScale2", label: "2-color scale" },
];

function rangeLabel(b: { top: number; left: number; bottom: number; right: number }): string {
  const col = (c: number) => {
    let n = c, s = "";
    while (n > 0) { s = String.fromCharCode(65 + ((n - 1) % 26)) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  return `${col(b.left)}${b.top}:${col(b.right)}${b.bottom}`;
}

export function CFormatPanel({ workbookId, sheet, box, onClose, onRulesChange }: CFormatPanelProps) {
  const [rules, setRules] = useState<CFRule[]>([]);
  const [op, setOp] = useState<CFOperator>("greaterThan");
  const [v1, setV1] = useState("0");
  const [v2, setV2] = useState("100");
  const [fill, setFill] = useState("#fce8e6");
  const [color, setColor] = useState("#c5221f");
  const [minColor, setMinColor] = useState("#ffffff");
  const [maxColor, setMaxColor] = useState("#1a73e8");

  const reload = useCallback(async () => {
    const r = await getConditionalFormats(workbookId);
    setRules(r);
    onRulesChange(r);
  }, [workbookId, onRulesChange]);

  useEffect(() => { void reload(); }, [reload]);

  const persist = async (next: CFRule[]) => {
    setRules(next);
    onRulesChange(next);
    await saveConditionalFormats(workbookId, next);
  };

  const add = async () => {
    const meta = OPS.find((o) => o.value === op)!;
    const rule: CFRule = {
      id: `cf_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      sheet,
      range: box,
      operator: op,
      ...(op === "colorScale2"
        ? { minColor, maxColor }
        : { value1: v1, ...(meta.two ? { value2: v2 } : {}), format: { fill, color } }),
    };
    await persist([...rules, rule]);
  };

  const remove = async (id: string) => persist(rules.filter((r) => r.id !== id));

  const meta = OPS.find((o) => o.value === op)!;

  return (
    <div style={panel}>
      <div style={head}>
        <strong>Conditional formatting</strong>
        <button style={x} onClick={onClose} aria-label="Close">✕</button>
      </div>
      <div style={body}>
        <div style={card}>
          <div style={sec}>New rule · {rangeLabel(box)}</div>
          <select style={input} value={op} onChange={(e) => setOp(e.target.value as CFOperator)} aria-label="Condition">
            {OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {op !== "colorScale2" && (
            <>
              <input style={input} value={v1} onChange={(e) => setV1(e.target.value)} placeholder={meta.text ? "text" : "value"} />
              {meta.two && <input style={input} value={v2} onChange={(e) => setV2(e.target.value)} placeholder="and" />}
              <div style={row}>
                <label style={lbl}>Fill <input type="color" value={fill} onChange={(e) => setFill(e.target.value)} /></label>
                <label style={lbl}>Text <input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
              </div>
            </>
          )}
          {op === "colorScale2" && (
            <div style={row}>
              <label style={lbl}>Min <input type="color" value={minColor} onChange={(e) => setMinColor(e.target.value)} /></label>
              <label style={lbl}>Max <input type="color" value={maxColor} onChange={(e) => setMaxColor(e.target.value)} /></label>
            </div>
          )}
          <button style={primary} onClick={() => void add()}>Add rule</button>
        </div>

        <div style={sec}>Rules ({rules.length})</div>
        {rules.map((r) => (
          <div key={r.id} style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12 }}>
              {rangeLabel(r.range)} · {OPS.find((o) => o.value === r.operator)?.label}
              {r.value1 !== undefined ? ` ${r.value1}` : ""}{r.value2 !== undefined ? `–${r.value2}` : ""}
            </span>
            <button style={linkBtn} onClick={() => void remove(r.id)}>Delete</button>
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
const row: React.CSSProperties = { display: "flex", gap: 12, marginBottom: 8 };
const lbl: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#5f6368" };
const primary: React.CSSProperties = { height: 32, padding: "0 16px", border: "none", borderRadius: 6, background: "#1a73e8", color: "#fff", font: FONT, cursor: "pointer" };
const linkBtn: React.CSSProperties = { color: "#1a73e8", background: "none", border: "none", padding: 0, cursor: "pointer", font: FONT };
const x: React.CSSProperties = { border: "none", background: "none", cursor: "pointer", color: "#5f6368", fontSize: 14 };
