"use client";

/**
 * Minimal SabSheet v2 workbench: name box + formula bar, the canvas grid, and a status bar.
 *
 * This is the P2 grid MVP frame. The full 20ui chrome (menubar, toolbar, sheet tabs, context menus)
 * is the P5 build; here the frame is intentionally lightweight so the grid + engine can be exercised
 * end-to-end. The grid surface and the formula bar share one engine via the `SheetCanvasHandle`.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { SheetCanvas, type SheetCanvasHandle, type SaveState } from "./grid/sheet-canvas.tsx";
import { Ribbon, type SheetPanel } from "./chrome/ribbon.tsx";
import { SheetTabs } from "./chrome/sheet-tabs.tsx";
import { AiPanel } from "./chrome/ai-panel.tsx";
import { ConnectionsPanel } from "./chrome/connections-panel.tsx";
import { FormsPanel } from "./chrome/forms-panel.tsx";
import { ChartPanel } from "./charts/chart-panel.tsx";
import { PivotPanel } from "./pivot/pivot-panel.tsx";
import { CFormatPanel } from "./chrome/cformat-panel.tsx";
import { ValidationPanel } from "./chrome/validation-panel.tsx";
import { FilterPanel } from "./chrome/filter-panel.tsx";
import type { CFRule } from "../../lib/sabsheet/cformat/types.ts";
import type { DataValidationRule } from "../../lib/sabsheet/validation/types.ts";
import { exportXlsxAction } from "../../app/actions/sabsheet-ops.actions.ts";
import type { SheetInfo } from "../../lib/sabsheet/engine/protocol.ts";
import type { Command, CellView } from "../../lib/sabsheet/commands/ops.ts";

const SAVE_LABEL: Record<SaveState, string> = {
  saving: "Saving…",
  synced: "All changes saved",
  pending: "Saving…",
  offline: "Offline — saved on this device",
  conflict: "Syncing latest…",
  error: "Save failed — will retry",
};

export interface WorkbenchProps {
  name: string;
  workbookId?: string;
  seed?: Command[];
}

export function Workbench({ name, workbookId, seed }: WorkbenchProps) {
  const gridRef = useRef<SheetCanvasHandle>(null);
  const [label, setLabel] = useState("A1");
  const [nameBox, setNameBox] = useState("A1");
  const [activeContent, setActiveContent] = useState("");
  const [draft, setDraft] = useState("");
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const [online, setOnline] = useState(true);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [aggregates, setAggregates] = useState<string | null>(null);
  const [panel, setPanel] = useState<SheetPanel | null>(null);
  const [chartSel, setChartSel] = useState<{ cells: CellView[]; box: { top: number; left: number; bottom: number; right: number }; sheet: number } | null>(null);

  const openPanel = useCallback(async (p: SheetPanel) => {
    if (p === "charts" || p === "pivot" || p === "cformat" || p === "validation" || p === "filter") {
      const sel = await gridRef.current?.getSelection();
      setChartSel(sel ?? null);
    }
    setPanel(p);
  }, []);
  const onRulesChange = useCallback((rules: CFRule[]) => {
    void gridRef.current?.setConditionalFormats(rules);
  }, []);
  const onValidationChange = useCallback((rules: DataValidationRule[]) => {
    void gridRef.current?.setDataValidations(rules);
  }, []);
  const closePanel = useCallback(() => setPanel(null), []);
  const print = useCallback(() => {
    if (workbookId) window.open(`/dashboard/sabsheet/v2/${workbookId}/print?sheet=${activeSheet}`, "_blank");
  }, [workbookId, activeSheet]);

  const onSheetsChange = useCallback((list: SheetInfo[], active: number) => {
    setSheets(list);
    setActiveSheet(active);
  }, []);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const onSelectionChange = useCallback((nextLabel: string, content: string) => {
    setLabel(nextLabel);
    setNameBox(nextLabel);
    setActiveContent(content);
    setDraft(content);
  }, []);

  const commit = useCallback(async () => {
    await gridRef.current?.commitActiveInput(draft);
  }, [draft]);

  const exportXlsx = useCallback(async () => {
    if (!workbookId) return;
    const { xlsxB64 } = await exportXlsxAction(workbookId);
    const bytes = Uint8Array.from(atob(xlsxB64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [workbookId, name]);

  return (
    <div style={styles.root}>
      {/* xlsx export needs the server, so it's hidden offline (the grid keeps working). */}
      <Ribbon
        grid={gridRef}
        onExportXlsx={workbookId && online ? exportXlsx : undefined}
        onOpenPanel={workbookId ? (p) => void openPanel(p) : undefined}
        onPrint={workbookId ? print : undefined}
      />
      <div style={styles.formulaBar}>
        <input
          aria-label="Name box — type a cell or range to go to"
          style={styles.nameBox}
          value={nameBox}
          onChange={(e) => setNameBox(e.target.value)}
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              gridRef.current?.goTo(nameBox);
            } else if (e.key === "Escape") {
              setNameBox(label);
            }
          }}
        />
        <div style={styles.fx} aria-hidden>
          fx
        </div>
        <input
          aria-label="Formula or value"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            } else if (e.key === "Escape") {
              setDraft(activeContent);
            }
          }}
          style={styles.formulaInput}
          placeholder="Enter a value or =formula"
        />
      </div>

      <div style={styles.gridRow}>
        <div style={styles.gridWrap}>
          <SheetCanvas
            ref={gridRef}
            name={name}
            workbookId={workbookId}
            seed={seed}
            onSelectionChange={onSelectionChange}
            onSaveStateChange={setSaveState}
            onSheetsChange={onSheetsChange}
            onAggregatesChange={setAggregates}
          />
        </div>
        {panel === "ai" && <AiPanel grid={gridRef} activeCellContent={activeContent} onClose={closePanel} />}
        {panel === "connections" && workbookId && <ConnectionsPanel workbookId={workbookId} onClose={closePanel} />}
        {panel === "forms" && workbookId && <FormsPanel workbookId={workbookId} onClose={closePanel} />}
        {panel === "charts" && workbookId && chartSel && (
          <ChartPanel
            cells={chartSel.cells}
            box={chartSel.box}
            workbookId={workbookId}
            sheetId={String(chartSel.sheet)}
            onClose={closePanel}
          />
        )}
        {panel === "pivot" && workbookId && chartSel && (
          <PivotPanel
            cells={chartSel.cells}
            box={chartSel.box}
            workbookId={workbookId}
            sheetId={String(chartSel.sheet)}
            onClose={closePanel}
          />
        )}
        {panel === "cformat" && workbookId && chartSel && (
          <CFormatPanel
            workbookId={workbookId}
            sheet={chartSel.sheet}
            box={chartSel.box}
            onClose={closePanel}
            onRulesChange={onRulesChange}
          />
        )}
        {panel === "validation" && workbookId && chartSel && (
          <ValidationPanel
            workbookId={workbookId}
            sheet={chartSel.sheet}
            box={chartSel.box}
            onClose={closePanel}
            onRulesChange={onValidationChange}
          />
        )}
        {panel === "filter" && chartSel && (
          <FilterPanel
            cells={chartSel.cells}
            box={chartSel.box}
            onApply={(hidden) => void gridRef.current?.applyRowFilter(hidden)}
            onClear={() => void gridRef.current?.clearRowFilter()}
            onClose={closePanel}
          />
        )}
      </div>

      {sheets.length > 0 && <SheetTabs sheets={sheets} active={activeSheet} grid={gridRef} />}

      <div style={styles.statusBar}>
        <span>{name}</span>
        {!online && (
          <span style={{ color: "#b06000" }} title="You're offline. Edits are saved on this device and sync when you reconnect.">
            ● Offline
          </span>
        )}
        {saveState && workbookId && (
          <span aria-live="polite">{SAVE_LABEL[saveState]}</span>
        )}
        {aggregates && <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>{aggregates}</span>}
        <span style={{ marginLeft: aggregates ? 16 : "auto" }}>SabSheet v2 · IronCalc engine</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: "flex", flexDirection: "column", height: "100%", width: "100%", background: "#fff" },
  formulaBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    height: 32,
    padding: "0 8px",
    borderBottom: "1px solid #e1e3e6",
    font: "13px -apple-system, system-ui, sans-serif",
  },
  nameBox: {
    minWidth: 72,
    height: 22,
    display: "flex",
    alignItems: "center",
    padding: "0 8px",
    border: "1px solid #e1e3e6",
    borderRadius: 4,
    color: "#202124",
  },
  fx: { color: "#5f6368", fontStyle: "italic", width: 18, textAlign: "center" },
  formulaInput: {
    flex: 1,
    height: 24,
    border: "none",
    outline: "none",
    font: "13px -apple-system, system-ui, sans-serif",
  },
  gridRow: { flex: 1, minHeight: 0, display: "flex" },
  gridWrap: { flex: 1, minWidth: 0, minHeight: 0, position: "relative" },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    height: 24,
    padding: "0 12px",
    borderTop: "1px solid #e1e3e6",
    background: "#f8f9fa",
    color: "#5f6368",
    font: "12px -apple-system, system-ui, sans-serif",
  },
};
