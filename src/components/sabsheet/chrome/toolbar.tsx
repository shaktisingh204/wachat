"use client";

/**
 * Minimal formatting toolbar for the P4 grid: undo/redo, bold/italic/underline, and a number-format
 * preset dropdown. Each control drives the grid through `SheetCanvasHandle` (style attributes map to
 * IronCalc style paths; number formats are ECMA-376 codes the engine renders on the next viewport read).
 *
 * The full 20ui menubar + rich toolbar is the P5 chrome build; this is the lightweight surface that
 * exercises the engine's styling + history during P4.
 */
import { StylePath } from "../../../lib/sabsheet/commands/ops.ts";
import type { SheetCanvasHandle } from "../grid/sheet-canvas.tsx";

export interface ToolbarProps {
  grid: React.RefObject<SheetCanvasHandle | null>;
  /** When provided, shows a "Download .xlsx" button (persistent workbooks only). */
  onExportXlsx?: () => void;
}

const NUMBER_FORMATS: { label: string; code: string }[] = [
  { label: "Automatic", code: "General" },
  { label: "Number", code: "#,##0.00" },
  { label: "Percent", code: "0.00%" },
  { label: "Currency", code: '"$"#,##0.00' },
  { label: "Date", code: "yyyy-mm-dd" },
  { label: "Plain text", code: "@" },
];

export function Toolbar({ grid, onExportXlsx }: ToolbarProps) {
  const style = (path: string, value: string) => void grid.current?.applyStyle(path, value);

  return (
    <div style={bar} role="toolbar" aria-label="Formatting">
      {onExportXlsx && (
        <>
          <button style={btn} title="Download as .xlsx" onClick={onExportXlsx} aria-label="Download as Excel">
            ⤓ xlsx
          </button>
          <span style={sep} aria-hidden />
        </>
      )}
      <button style={btn} title="Undo (Ctrl+Z)" onClick={() => void grid.current?.undo()} aria-label="Undo">
        ↶
      </button>
      <button style={btn} title="Redo (Ctrl+Y)" onClick={() => void grid.current?.redo()} aria-label="Redo">
        ↷
      </button>
      <span style={sep} aria-hidden />
      <button style={{ ...btn, fontWeight: 700 }} title="Bold" onClick={() => style(StylePath.bold, "true")} aria-label="Bold">
        B
      </button>
      <button style={{ ...btn, fontStyle: "italic" }} title="Italic" onClick={() => style(StylePath.italic, "true")} aria-label="Italic">
        I
      </button>
      <button style={{ ...btn, textDecoration: "underline" }} title="Underline" onClick={() => style(StylePath.underline, "true")} aria-label="Underline">
        U
      </button>
      <span style={sep} aria-hidden />
      <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ color: "#5f6368", fontSize: 12 }}>123</span>
        <select
          aria-label="Number format"
          style={select}
          defaultValue="General"
          onChange={(e) => style(StylePath.numberFormat, e.target.value)}
        >
          {NUMBER_FORMATS.map((f) => (
            <option key={f.code} value={f.code}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

const bar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 4,
  height: 36,
  padding: "0 8px",
  borderBottom: "1px solid #e1e3e6",
  background: "#fff",
};
const btn: React.CSSProperties = {
  minWidth: 28,
  height: 26,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "1px solid transparent",
  borderRadius: 4,
  background: "transparent",
  cursor: "pointer",
  color: "#202124",
  font: "14px -apple-system, system-ui, sans-serif",
};
const sep: React.CSSProperties = { width: 1, height: 20, background: "#e1e3e6", margin: "0 4px" };
const select: React.CSSProperties = {
  height: 26,
  border: "1px solid #e1e3e6",
  borderRadius: 4,
  font: "13px -apple-system, system-ui, sans-serif",
  padding: "0 4px",
};
