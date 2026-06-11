"use client";

/**
 * Excel-style ribbon, styled like current Google Sheets (Material You): a row of text tabs and a
 * rounded "pill" toolbar (#edf2fa) of compact icon buttons with circular hover states. Groups are
 * separated by hairline dividers (labels live in tooltips/aria-labels). Every control drives the grid
 * through `SheetCanvasHandle`; unimplemented features are shown disabled rather than hidden.
 *
 * Interaction notes (per design review): hover states are gated behind `(hover:hover)`, presses get
 * `scale(.97)` feedback, transitions only touch background/transform at ≤160ms ease-out, and
 * `prefers-reduced-motion` drops the motion.
 */
import { useState } from "react";
import { StylePath } from "../../../lib/sabsheet/commands/ops.ts";
import type { SheetCanvasHandle } from "../grid/sheet-canvas.tsx";

export type SheetPanel = "ai" | "connections" | "charts" | "forms" | "pivot" | "cformat" | "validation" | "filter" | "share";

export interface RibbonProps {
  grid: React.RefObject<SheetCanvasHandle | null>;
  /** Shown as the "Download" button when present (persistent workbook + online). */
  onExportXlsx?: () => void;
  /** Opens a side panel (AI / connections / charts / forms / pivot / cformat / validation / filter). */
  onOpenPanel?: (panel: SheetPanel) => void;
  /** Opens the print/PDF view (persistent workbooks only). */
  onPrint?: () => void;
}

type Tab = "Home" | "Insert" | "Formulas" | "Data" | "View";
const TABS: Tab[] = ["Home", "Insert", "Formulas", "Data", "View"];

const NUMBER_FORMATS: { label: string; code: string }[] = [
  { label: "General", code: "General" },
  { label: "Number", code: "#,##0.00" },
  { label: "Percent", code: "0.00%" },
  { label: "Currency", code: '"$"#,##0.00' },
  { label: "Accounting", code: '_("$"* #,##0.00_)' },
  { label: "Date", code: "yyyy-mm-dd" },
  { label: "Time", code: "hh:mm:ss" },
  { label: "Text", code: "@" },
];

const CSS = `
.sbsr { background: #fff; font: 13px -apple-system, system-ui, sans-serif; }
.sbsr-tabs { display: flex; align-items: center; gap: 2px; padding: 4px 12px 6px; }
.sbsr-tab {
  border: none; background: transparent; padding: 5px 14px; border-radius: 16px;
  color: #444746; font: 500 13px -apple-system, system-ui, sans-serif; cursor: pointer;
  transition: background 120ms cubic-bezier(.23,1,.32,1), transform 160ms cubic-bezier(.23,1,.32,1);
}
@media (hover: hover) and (pointer: fine) { .sbsr-tab:hover { background: rgba(68,71,70,.08); } }
.sbsr-tab:active { transform: scale(.97); }
.sbsr-tab[aria-selected="true"] { background: #d3e3fd; color: #041e49; }
.sbsr-tab:focus-visible { outline: 2px solid #1a73e8; outline-offset: 1px; }
.sbsr-bar {
  display: flex; align-items: center; gap: 2px; margin: 0 12px 10px; padding: 4px 10px;
  background: #edf2fa; border-radius: 24px; min-height: 40px; overflow-x: auto;
  scrollbar-width: none;
}
.sbsr-bar::-webkit-scrollbar { display: none; }
.sbsr-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 5px; flex: none;
  height: 30px; min-width: 30px; padding: 0 9px; border: none; border-radius: 8px;
  background: transparent; color: #444746; font: 500 13px -apple-system, system-ui, sans-serif;
  cursor: pointer; white-space: nowrap;
  transition: background 100ms linear, transform 160ms cubic-bezier(.23,1,.32,1);
}
@media (hover: hover) and (pointer: fine) { .sbsr-btn:hover:not(:disabled) { background: rgba(68,71,70,.1); } }
.sbsr-btn:active:not(:disabled) { background: rgba(68,71,70,.16); transform: scale(.97); }
.sbsr-btn:disabled { opacity: .38; cursor: default; }
.sbsr-btn:focus-visible { outline: 2px solid #1a73e8; outline-offset: 1px; }
.sbsr-sep { width: 1px; height: 20px; background: #c4c7c5; margin: 0 6px; flex: none; }
.sbsr-select {
  height: 30px; border: none; border-radius: 8px; background: transparent; color: #444746;
  font: 500 13px -apple-system, system-ui, sans-serif; padding: 0 6px; cursor: pointer; flex: none;
  transition: background 100ms linear;
}
@media (hover: hover) and (pointer: fine) { .sbsr-select:hover { background: rgba(68,71,70,.1); } }
.sbsr-select:focus-visible { outline: 2px solid #1a73e8; outline-offset: 1px; }
.sbsr-hint { font-size: 12px; color: #5f6368; padding: 0 8px; white-space: nowrap; }
.sbsr-find {
  display: flex; align-items: center; gap: 10px; padding: 8px 16px;
  border-top: 1px solid #eef1f4; background: #fff;
}
.sbsr-input {
  height: 32px; border: 1px solid #c4c7c5; border-radius: 8px; padding: 0 10px;
  font: 13px -apple-system, system-ui, sans-serif; min-width: 160px; color: #1f1f1f;
}
.sbsr-input:focus { outline: 2px solid #1a73e8; outline-offset: -1px; border-color: transparent; }
.sbsr-check { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #5f6368; }
@media (prefers-reduced-motion: reduce) {
  .sbsr-tab, .sbsr-btn, .sbsr-select { transition: none; }
}
`;

export function Ribbon({ grid, onExportXlsx, onOpenPanel, onPrint }: RibbonProps) {
  const [tab, setTab] = useState<Tab>("Home");
  const [findOpen, setFindOpen] = useState(false);
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [matchCase, setMatchCase] = useState(false);

  const g = () => grid.current;
  const style = (path: string, value: string) => void g()?.applyStyle(path, value);

  return (
    <div className="sbsr">
      <style>{CSS}</style>
      <div className="sbsr-tabs" role="tablist" aria-label="Ribbon">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={t === tab} onClick={() => setTab(t)} className="sbsr-tab">
            {t}
          </button>
        ))}
      </div>

      <div className="sbsr-bar" role="toolbar" aria-label={`${tab} tools`}>
        {tab === "Home" && (
          <>
            <Btn title="Undo (Ctrl+Z)" onClick={() => void g()?.undo()}>↶</Btn>
            <Btn title="Redo (Ctrl+Y)" onClick={() => void g()?.redo()}>↷</Btn>
            <Sep />
            <Btn title="Bold (Ctrl+B)" bold onClick={() => style(StylePath.bold, "true")}>B</Btn>
            <Btn title="Italic (Ctrl+I)" italic onClick={() => style(StylePath.italic, "true")}>I</Btn>
            <Btn title="Underline (Ctrl+U)" underline onClick={() => style(StylePath.underline, "true")}>U</Btn>
            <ColorInput title="Text color" onPick={(c) => style(StylePath.fontColor, c)} swatch="A" />
            <ColorInput title="Fill color" onPick={(c) => style(StylePath.fillColor, c)} swatch="▦" />
            <Sep />
            <Btn title="Align left" onClick={() => style(StylePath.alignHorizontal, "left")}>⫷</Btn>
            <Btn title="Align center" onClick={() => style(StylePath.alignHorizontal, "center")}>≡</Btn>
            <Btn title="Align right" onClick={() => style(StylePath.alignHorizontal, "right")}>⫸</Btn>
            <Sep />
            <select
              aria-label="Number format"
              className="sbsr-select"
              defaultValue="General"
              onChange={(e) => style(StylePath.numberFormat, e.target.value)}
            >
              {NUMBER_FORMATS.map((f) => (
                <option key={f.code} value={f.code}>{f.label}</option>
              ))}
            </select>
            <Sep />
            <Btn title="Insert row above" onClick={() => void g()?.insertRows(false)}>＋Row</Btn>
            <Btn title="Insert column left" onClick={() => void g()?.insertColumns(false)}>＋Col</Btn>
            <Btn title="Delete rows" onClick={() => void g()?.deleteRows()}>－Row</Btn>
            <Btn title="Delete columns" onClick={() => void g()?.deleteColumns()}>－Col</Btn>
            <Btn title="Clear contents" onClick={() => void g()?.clearContents()}>Clear</Btn>
            <Sep />
            <Btn title="AutoSum" onClick={() => void g()?.autoSum()}>Σ</Btn>
            <Btn title="Sort A→Z" onClick={() => void g()?.sortSelection(true)}>A↓</Btn>
            <Btn title="Sort Z→A" onClick={() => void g()?.sortSelection(false)}>Z↓</Btn>
            <Btn title="Find & Replace" onClick={() => setFindOpen((v) => !v)}>🔍</Btn>
            {onOpenPanel && (
              <>
                <Sep />
                <Btn title="Conditional formatting on the selected range" onClick={() => onOpenPanel("cformat")}>▦ Format rules</Btn>
                <Btn title="AI: generate formulas, explain, transform" onClick={() => onOpenPanel("ai")}>✦ AI</Btn>
              </>
            )}
          </>
        )}

        {tab === "Insert" && (
          <>
            <Btn title="New sheet" onClick={() => void g()?.addSheet()}>＋ Sheet</Btn>
            <Sep />
            <Btn title="Insert row above" onClick={() => void g()?.insertRows(false)}>Row above</Btn>
            <Btn title="Insert row below" onClick={() => void g()?.insertRows(true)}>Row below</Btn>
            <Btn title="Insert column left" onClick={() => void g()?.insertColumns(false)}>Col left</Btn>
            <Btn title="Insert column right" onClick={() => void g()?.insertColumns(true)}>Col right</Btn>
            <Sep />
            <Btn title="Chart from the selected range" disabled={!onOpenPanel} onClick={() => onOpenPanel?.("charts")}>📊 Chart</Btn>
            <Btn title="Pivot table from the selected range" disabled={!onOpenPanel} onClick={() => onOpenPanel?.("pivot")}>Pivot</Btn>
            <Btn title="Image — coming soon" disabled>Image</Btn>
            {onOpenPanel && (
              <>
                <Sep />
                <Btn title="Public intake form → appends rows" onClick={() => onOpenPanel("forms")}>📋 Form</Btn>
              </>
            )}
          </>
        )}

        {tab === "Formulas" && (
          <>
            <Btn title="AutoSum a selected range" onClick={() => void g()?.autoSum()}>Σ AutoSum</Btn>
            <Btn title="Named ranges — coming soon" disabled>Name Manager</Btn>
            <Sep />
            <span className="sbsr-hint">343 functions — type “=” in any cell (SUM, VLOOKUP, XLOOKUP, IF, TEXTJOIN…)</span>
          </>
        )}

        {tab === "Data" && (
          <>
            <Btn title="Sort A→Z" onClick={() => void g()?.sortSelection(true)}>Sort A↓</Btn>
            <Btn title="Sort Z→A" onClick={() => void g()?.sortSelection(false)}>Sort Z↓</Btn>
            <Btn title="Filter the selected range" disabled={!onOpenPanel} onClick={() => onOpenPanel?.("filter")}>⛃ Filter</Btn>
            <Sep />
            <Btn title="Find & Replace" onClick={() => setFindOpen((v) => !v)}>Find & Replace</Btn>
            <Btn title="Data validation (dropdown lists)" disabled={!onOpenPanel} onClick={() => onOpenPanel?.("validation")}>Validation</Btn>
            <Btn title="Remove duplicates — coming soon" disabled>Dedupe</Btn>
            {onOpenPanel && (
              <>
                <Sep />
                <Btn title="Live data connections (CRM / REST / CSV)" onClick={() => onOpenPanel("connections")}>🔌 Connections</Btn>
              </>
            )}
          </>
        )}

        {tab === "View" && (
          <>
            <Btn title="Freeze rows above + cols left of the active cell" onClick={() => void g()?.freezeAtActive()}>Freeze panes</Btn>
            <Btn title="Unfreeze all" onClick={() => void g()?.unfreeze()}>Unfreeze</Btn>
            <Sep />
            {onExportXlsx ? (
              <Btn title="Download as .xlsx" onClick={onExportXlsx}>⤓ Download .xlsx</Btn>
            ) : (
              <span className="sbsr-hint">Sign-in + online required to export.</span>
            )}
            {onPrint && <Btn title="Print / Save as PDF" onClick={onPrint}>🖨 Print</Btn>}
          </>
        )}
      </div>

      {findOpen && (
        <div className="sbsr-find">
          <input aria-label="Find" placeholder="Find" value={find} onChange={(e) => setFind(e.target.value)} className="sbsr-input" />
          <input aria-label="Replace with" placeholder="Replace with" value={replace} onChange={(e) => setReplace(e.target.value)} className="sbsr-input" />
          <label className="sbsr-check">
            <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} /> Match case
          </label>
          <Btn title="Replace all in selection (or whole sheet if one cell)" onClick={() => find && void g()?.replaceAll(find, replace, matchCase)}>
            Replace all
          </Btn>
          <Btn title="Close" onClick={() => setFindOpen(false)}>✕</Btn>
        </div>
      )}
    </div>
  );
}

function Sep() {
  return <span className="sbsr-sep" aria-hidden />;
}

function Btn({
  children,
  title,
  onClick,
  disabled,
  bold,
  italic,
  underline,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}) {
  return (
    <button
      type="button"
      className="sbsr-btn"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        fontWeight: bold ? 700 : 500,
        fontStyle: italic ? "italic" : "normal",
        textDecoration: underline ? "underline" : "none",
      }}
    >
      {children}
    </button>
  );
}

function ColorInput({ title, onPick, swatch }: { title: string; onPick: (c: string) => void; swatch: string }) {
  return (
    <label title={title} className="sbsr-btn" style={{ position: "relative", cursor: "pointer" }}>
      {swatch}
      <input
        type="color"
        aria-label={title}
        onChange={(e) => onPick(e.target.value)}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
      />
    </label>
  );
}
