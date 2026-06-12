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
import { SharePanel } from "./chrome/share-panel.tsx";
import { SheetIcon } from "./chrome/sheet-icon.tsx";
import { FormulaAssist } from "./formula/formula-assist.tsx";
import { FunctionBrowser } from "./formula/function-browser.tsx";
import { matchFunctionPrefix, filterFunctions, activeCall, acceptCompletion } from "./formula/assist.ts";
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

  // ── Formula assist (autocomplete + signature help) ────────────────────────
  const formulaRef = useRef<HTMLInputElement>(null);
  const [fnNames, setFnNames] = useState<string[]>([]);
  const [caret, setCaret] = useState(0);
  const [assistIdx, setAssistIdx] = useState(0);
  const [assistDismissed, setAssistDismissed] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);

  const loadFnNames = useCallback(async () => {
    if (fnNames.length) return;
    try {
      const names = (await gridRef.current?.functionCatalog()) ?? [];
      setFnNames(names);
    } catch {
      /* engine not ready yet — retried on next focus */
    }
  }, [fnNames.length]);

  const prefixMatch = assistDismissed ? null : matchFunctionPrefix(draft, caret);
  const assistList = prefixMatch ? filterFunctions(fnNames, prefixMatch.prefix) : [];
  const callCtx = assistList.length === 0 ? activeCall(draft, caret) : null;

  const acceptFn = useCallback(
    (name: string) => {
      if (!prefixMatch) return;
      const r = acceptCompletion(draft, caret, prefixMatch.start, name);
      setDraft(r.draft);
      setCaret(r.caret);
      setAssistIdx(0);
      requestAnimationFrame(() => {
        formulaRef.current?.focus();
        formulaRef.current?.setSelectionRange(r.caret, r.caret);
      });
    },
    [draft, caret, prefixMatch],
  );

  const insertFromBrowser = useCallback((name: string) => {
    setBrowserOpen(false);
    setDraft((d) => {
      const base = d.startsWith("=") ? d : "=";
      const next = `${base}${name}(`;
      requestAnimationFrame(() => {
        formulaRef.current?.focus();
        formulaRef.current?.setSelectionRange(next.length, next.length);
        setCaret(next.length);
      });
      return next;
    });
  }, []);

  const openBrowser = useCallback(async () => {
    await loadFnNames();
    setBrowserOpen(true);
  }, [loadFnNames]);

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
    if (workbookId) window.open(`/dashboard/sabsheet/${workbookId}/print?sheet=${activeSheet}`, "_blank");
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
      <style>{WORKBENCH_CSS}</style>
      <div className="sbsw-title">
        <SheetIcon size={28} />
        <span className="sbsw-name" title={name}>{name}</span>
        {!online && (
          <span className="sbsw-chip" title="You're offline. Edits are saved on this device and sync when you reconnect.">
            ☁ Offline
          </span>
        )}
        {saveState && workbookId && (
          <span className="sbsw-save" aria-live="polite">{SAVE_LABEL[saveState]}</span>
        )}
        {workbookId && (
          <button className="sbsw-share" onClick={() => void openPanel("share")} title="Share with collaborators">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .04.49L8.91 7.56a3 3 0 1 0 0 4.88l6.13 3.07A3 3 0 1 0 18 14c-.79 0-1.5.3-2.04.8l-6.13-3.07a3.03 3.03 0 0 0 0-.98l6.13-3.07c.54.5 1.25.8 2.04.8Z" />
            </svg>
            Share
          </button>
        )}
      </div>
      {/* xlsx export needs the server, so it's hidden offline (the grid keeps working). */}
      <Ribbon
        grid={gridRef}
        onExportXlsx={workbookId && online ? exportXlsx : undefined}
        onOpenPanel={workbookId ? (p) => void openPanel(p) : undefined}
        onPrint={workbookId ? print : undefined}
        onInsertFunction={() => void openBrowser()}
      />
      <div className="sbsw-fbar">
        <input
          aria-label="Name box — type a cell or range to go to"
          className="sbsw-namebox"
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
        <span className="sbsw-fdiv" aria-hidden />
        <span className="sbsw-fx" aria-hidden>fx</span>
        <input
          ref={formulaRef}
          aria-label="Formula or value"
          value={draft}
          onFocus={() => void loadFnNames()}
          onChange={(e) => {
            setDraft(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
            setAssistIdx(0);
            setAssistDismissed(false);
          }}
          onSelect={(e) => setCaret((e.target as HTMLInputElement).selectionStart ?? 0)}
          onKeyDown={(e) => {
            if (assistList.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setAssistIdx((i) => (i + 1) % assistList.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setAssistIdx((i) => (i - 1 + assistList.length) % assistList.length);
                return;
              }
              if (e.key === "Tab" || e.key === "Enter") {
                e.preventDefault();
                acceptFn(assistList[Math.min(assistIdx, assistList.length - 1)]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setAssistDismissed(true);
                return;
              }
            }
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            } else if (e.key === "Escape") {
              setDraft(activeContent);
            }
          }}
          className="sbsw-finput"
          placeholder="Enter a value or =formula"
        />
      </div>
      <FormulaAssist list={assistList} selected={assistIdx} onPick={acceptFn} call={callCtx} />
      {browserOpen && (
        <FunctionBrowser
          names={fnNames}
          onInsert={insertFromBrowser}
          onClose={() => setBrowserOpen(false)}
        />
      )}

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
        {panel === "share" && workbookId && <SharePanel workbookId={workbookId} onClose={closePanel} />}
      </div>

      {sheets.length > 0 && <SheetTabs sheets={sheets} active={activeSheet} grid={gridRef} />}

      <div className="sbsw-status">
        {aggregates && <span style={{ fontVariantNumeric: "tabular-nums" }}>{aggregates}</span>}
        <span style={{ marginLeft: "auto" }}>SabSheet · IronCalc engine</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: "flex", flexDirection: "column", height: "100%", width: "100%", background: "#fff" },
  gridRow: { flex: 1, minHeight: 0, display: "flex" },
  gridWrap: { flex: 1, minWidth: 0, minHeight: 0, position: "relative" },
};

const WORKBENCH_CSS = `
.sbsw-title { display: flex; align-items: center; gap: 10px; padding: 10px 16px 2px; background: #fff; }
.sbsw-name {
  font: 500 18px -apple-system, system-ui, sans-serif; color: #1f1f1f; letter-spacing: -0.1px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40vw;
}
.sbsw-save { font-size: 12px; color: #5f6368; }
.sbsw-chip {
  font-size: 12px; color: #5f6368; background: #f1f3f4; border-radius: 12px; padding: 3px 10px; flex: none;
}
.sbsw-share {
  margin-left: auto; display: inline-flex; align-items: center; gap: 7px; flex: none;
  height: 36px; padding: 0 20px; border: none; border-radius: 18px;
  background: #c2e7ff; color: #001d35; font: 600 13.5px -apple-system, system-ui, sans-serif; cursor: pointer;
  transition: box-shadow 120ms ease, transform 160ms cubic-bezier(.23,1,.32,1);
}
@media (hover: hover) and (pointer: fine) { .sbsw-share:hover { box-shadow: 0 1px 3px rgba(0,0,0,.22); } }
.sbsw-share:active { transform: scale(.97); }
.sbsw-share:focus-visible { outline: 2px solid #1a73e8; outline-offset: 2px; }
.sbsw-fbar {
  display: flex; align-items: center; height: 36px; padding: 0 12px;
  border-top: 1px solid #eef1f4; border-bottom: 1px solid #e1e3e6; background: #fff;
  font: 13px -apple-system, system-ui, sans-serif;
}
.sbsw-namebox {
  width: 90px; flex: none; height: 26px; border: none; border-radius: 6px; padding: 0 8px;
  font: 13px -apple-system, system-ui, sans-serif; color: #1f1f1f; background: transparent;
}
@media (hover: hover) and (pointer: fine) { .sbsw-namebox:hover { background: #f1f3f4; } }
.sbsw-namebox:focus { outline: 2px solid #1a73e8; outline-offset: -1px; background: #fff; }
.sbsw-fdiv { width: 1px; height: 18px; background: #e1e3e6; margin: 0 10px; flex: none; }
.sbsw-fx { color: #5f6368; font: italic 600 13px Georgia, "Times New Roman", serif; width: 22px; text-align: center; flex: none; }
.sbsw-finput {
  flex: 1; height: 28px; border: none; outline: none; border-radius: 6px; padding: 0 8px;
  font: 13px -apple-system, system-ui, sans-serif; color: #1f1f1f;
}
.sbsw-finput:focus { background: #f8fbff; }
.sbsw-status {
  display: flex; align-items: center; gap: 16px; height: 26px; padding: 0 14px;
  border-top: 1px solid #e1e3e6; background: #f9fbfd; color: #5f6368;
  font: 12px -apple-system, system-ui, sans-serif;
}
@media (prefers-reduced-motion: reduce) { .sbsw-share { transition: none; } }
`;
