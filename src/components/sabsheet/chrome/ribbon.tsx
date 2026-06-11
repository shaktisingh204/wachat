"use client";

/**
 * Excel-style ribbon — the full chrome for SabSheet v2. Tabs (Home / Insert / Formulas / Data / View)
 * group every wired capability and drive the grid through `SheetCanvasHandle`. Features that aren't
 * implemented yet are shown disabled with a "coming soon" hint rather than hidden, so the surface
 * mirrors Excel's layout honestly.
 */
import { useState } from "react";
import { StylePath } from "../../../lib/sabsheet/commands/ops.ts";
import type { SheetCanvasHandle } from "../grid/sheet-canvas.tsx";

export type SheetPanel = "ai" | "connections" | "charts" | "forms";

export interface RibbonProps {
  grid: React.RefObject<SheetCanvasHandle | null>;
  /** Shown as the "Download" button when present (persistent workbook + online). */
  onExportXlsx?: () => void;
  /** Opens a side panel (AI / connections / charts / forms). Persistent workbooks only. */
  onOpenPanel?: (panel: SheetPanel) => void;
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

export function Ribbon({ grid, onExportXlsx, onOpenPanel }: RibbonProps) {
  const [tab, setTab] = useState<Tab>("Home");
  const [findOpen, setFindOpen] = useState(false);
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [matchCase, setMatchCase] = useState(false);

  const g = () => grid.current;
  const style = (path: string, value: string) => void g()?.applyStyle(path, value);

  return (
    <div style={ribbonWrap}>
      <div style={tabStrip} role="tablist" aria-label="Ribbon">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={t === tab}
            onClick={() => setTab(t)}
            style={{ ...tabBtn, ...(t === tab ? tabBtnActive : null) }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={tabBody}>
        {tab === "Home" && (
          <>
            <Group label="Undo">
              <Btn title="Undo (Ctrl+Z)" onClick={() => void g()?.undo()}>↶</Btn>
              <Btn title="Redo (Ctrl+Y)" onClick={() => void g()?.redo()}>↷</Btn>
            </Group>
            <Group label="Font">
              <Btn title="Bold (Ctrl+B)" bold onClick={() => style(StylePath.bold, "true")}>B</Btn>
              <Btn title="Italic (Ctrl+I)" italic onClick={() => style(StylePath.italic, "true")}>I</Btn>
              <Btn title="Underline (Ctrl+U)" underline onClick={() => style(StylePath.underline, "true")}>U</Btn>
              <ColorInput title="Text color" onPick={(c) => style(StylePath.fontColor, c)} swatch="A" />
              <ColorInput title="Fill color" onPick={(c) => style(StylePath.fillColor, c)} swatch="▦" />
            </Group>
            <Group label="Alignment">
              <Btn title="Align left" onClick={() => style(StylePath.alignHorizontal, "left")}>⫷</Btn>
              <Btn title="Align center" onClick={() => style(StylePath.alignHorizontal, "center")}>≡</Btn>
              <Btn title="Align right" onClick={() => style(StylePath.alignHorizontal, "right")}>⫸</Btn>
            </Group>
            <Group label="Number">
              <select aria-label="Number format" style={select} defaultValue="General" onChange={(e) => style(StylePath.numberFormat, e.target.value)}>
                {NUMBER_FORMATS.map((f) => (
                  <option key={f.code} value={f.code}>{f.label}</option>
                ))}
              </select>
            </Group>
            <Group label="Cells">
              <Btn title="Insert row above" onClick={() => void g()?.insertRows(false)}>＋Row</Btn>
              <Btn title="Insert column left" onClick={() => void g()?.insertColumns(false)}>＋Col</Btn>
              <Btn title="Delete rows" onClick={() => void g()?.deleteRows()}>－Row</Btn>
              <Btn title="Delete columns" onClick={() => void g()?.deleteColumns()}>－Col</Btn>
              <Btn title="Clear contents" onClick={() => void g()?.clearContents()}>Clear</Btn>
            </Group>
            <Group label="Editing">
              <Btn title="AutoSum" onClick={() => void g()?.autoSum()}>Σ</Btn>
              <Btn title="Sort A→Z" onClick={() => void g()?.sortSelection(true)}>A↓</Btn>
              <Btn title="Sort Z→A" onClick={() => void g()?.sortSelection(false)}>Z↓</Btn>
              <Btn title="Find & Replace" onClick={() => setFindOpen((v) => !v)}>🔍</Btn>
            </Group>
            {onOpenPanel && (
              <Group label="AI">
                <Btn title="AI: generate formulas, explain, transform" onClick={() => onOpenPanel("ai")}>✦ AI</Btn>
              </Group>
            )}
          </>
        )}

        {tab === "Insert" && (
          <>
            <Group label="Sheets">
              <Btn title="New sheet" onClick={() => void g()?.addSheet()}>＋ Sheet</Btn>
            </Group>
            <Group label="Cells">
              <Btn title="Insert row above" onClick={() => void g()?.insertRows(false)}>Row above</Btn>
              <Btn title="Insert row below" onClick={() => void g()?.insertRows(true)}>Row below</Btn>
              <Btn title="Insert column left" onClick={() => void g()?.insertColumns(false)}>Col left</Btn>
              <Btn title="Insert column right" onClick={() => void g()?.insertColumns(true)}>Col right</Btn>
            </Group>
            <Group label="Illustrations">
              <Btn title="Chart from the selected range" disabled={!onOpenPanel} onClick={() => onOpenPanel?.("charts")}>Chart</Btn>
              <Btn title="Pivot table — coming soon" disabled>Pivot</Btn>
              <Btn title="Image — coming soon" disabled>Image</Btn>
            </Group>
            {onOpenPanel && (
              <Group label="Forms">
                <Btn title="Public intake form → appends rows" onClick={() => onOpenPanel("forms")}>Form</Btn>
              </Group>
            )}
          </>
        )}

        {tab === "Formulas" && (
          <>
            <Group label="Function Library">
              <Btn title="AutoSum a selected range" onClick={() => void g()?.autoSum()}>Σ AutoSum</Btn>
            </Group>
            <Group label="Defined Names">
              <Btn title="Named ranges — coming soon" disabled>Name Manager</Btn>
            </Group>
            <Group label="Reference">
              <span style={hint}>343 functions available — type “=” in any cell (SUM, VLOOKUP, XLOOKUP, IF, TEXTJOIN…).</span>
            </Group>
          </>
        )}

        {tab === "Data" && (
          <>
            <Group label="Sort & Filter">
              <Btn title="Sort A→Z" onClick={() => void g()?.sortSelection(true)}>Sort A↓</Btn>
              <Btn title="Sort Z→A" onClick={() => void g()?.sortSelection(false)}>Sort Z↓</Btn>
              <Btn title="Filter — coming soon" disabled>Filter</Btn>
            </Group>
            <Group label="Data Tools">
              <Btn title="Find & Replace" onClick={() => setFindOpen((v) => !v)}>Find & Replace</Btn>
              <Btn title="Data validation — coming soon" disabled>Validation</Btn>
              <Btn title="Remove duplicates — coming soon" disabled>Dedupe</Btn>
            </Group>
            {onOpenPanel && (
              <Group label="Connect">
                <Btn title="Live data connections (CRM / REST / CSV)" onClick={() => onOpenPanel("connections")}>🔌 Connections</Btn>
              </Group>
            )}
          </>
        )}

        {tab === "View" && (
          <>
            <Group label="Window">
              <Btn title="Freeze rows above + cols left of the active cell" onClick={() => void g()?.freezeAtActive()}>Freeze Panes</Btn>
              <Btn title="Unfreeze all" onClick={() => void g()?.unfreeze()}>Unfreeze</Btn>
            </Group>
            <Group label="Workbook">
              {onExportXlsx ? <Btn title="Download as .xlsx" onClick={onExportXlsx}>⤓ Download .xlsx</Btn> : <span style={hint}>Sign-in + online required to export.</span>}
            </Group>
          </>
        )}
      </div>

      {findOpen && (
        <div style={findBar}>
          <input aria-label="Find" placeholder="Find" value={find} onChange={(e) => setFind(e.target.value)} style={findInput} />
          <input aria-label="Replace with" placeholder="Replace with" value={replace} onChange={(e) => setReplace(e.target.value)} style={findInput} />
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#5f6368" }}>
            <input type="checkbox" checked={matchCase} onChange={(e) => setMatchCase(e.target.checked)} /> Match case
          </label>
          <Btn title="Replace all in selection (or whole sheet if one cell)" onClick={() => find && void g()?.replaceAll(find, replace, matchCase)}>Replace All</Btn>
          <Btn title="Close" onClick={() => setFindOpen(false)}>✕</Btn>
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={group}>
      <div style={groupBtns}>{children}</div>
      <div style={groupLabel}>{label}</div>
    </div>
  );
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
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        ...btn,
        fontWeight: bold ? 700 : 500,
        fontStyle: italic ? "italic" : "normal",
        textDecoration: underline ? "underline" : "none",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ColorInput({ title, onPick, swatch }: { title: string; onPick: (c: string) => void; swatch: string }) {
  return (
    <label title={title} style={{ ...btn, position: "relative", cursor: "pointer" }}>
      {swatch}
      <input
        type="color"
        onChange={(e) => onPick(e.target.value)}
        style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
      />
    </label>
  );
}

const FONT = "13px -apple-system, system-ui, sans-serif";
const ribbonWrap: React.CSSProperties = { background: "#fff", borderBottom: "1px solid #e1e3e6", font: FONT };
const tabStrip: React.CSSProperties = { display: "flex", gap: 2, padding: "4px 8px 0", borderBottom: "1px solid #f1f3f4" };
const tabBtn: React.CSSProperties = { border: "none", background: "transparent", padding: "6px 14px", borderRadius: "6px 6px 0 0", color: "#5f6368", cursor: "pointer", font: FONT };
const tabBtnActive: React.CSSProperties = { color: "#1a73e8", fontWeight: 600, background: "#f8f9fa" };
const tabBody: React.CSSProperties = { display: "flex", alignItems: "stretch", gap: 4, padding: "6px 8px", minHeight: 64, overflowX: "auto" };
const group: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", padding: "0 8px", borderRight: "1px solid #f1f3f4" };
const groupBtns: React.CSSProperties = { display: "flex", alignItems: "center", gap: 2, flex: 1 };
const groupLabel: React.CSSProperties = { fontSize: 10, color: "#9aa0a6", marginTop: 4 };
const btn: React.CSSProperties = { minWidth: 30, height: 28, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, padding: "0 8px", border: "1px solid transparent", borderRadius: 4, background: "transparent", color: "#202124", font: FONT };
const select: React.CSSProperties = { height: 28, border: "1px solid #e1e3e6", borderRadius: 4, font: FONT, padding: "0 4px" };
const hint: React.CSSProperties = { fontSize: 12, color: "#5f6368", maxWidth: 320, alignSelf: "center" };
const findBar: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderTop: "1px solid #f1f3f4", background: "#f8f9fa" };
const findInput: React.CSSProperties = { height: 26, border: "1px solid #e1e3e6", borderRadius: 4, font: FONT, padding: "0 8px", minWidth: 140 };
