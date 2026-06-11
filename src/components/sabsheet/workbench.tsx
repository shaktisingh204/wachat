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
import { Toolbar } from "./chrome/toolbar.tsx";
import { SheetTabs } from "./chrome/sheet-tabs.tsx";
import { exportXlsxAction } from "../../app/actions/sabsheet-ops.actions.ts";
import type { SheetInfo } from "../../lib/sabsheet/engine/protocol.ts";
import type { Command } from "../../lib/sabsheet/commands/ops.ts";

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
  const [activeContent, setActiveContent] = useState("");
  const [draft, setDraft] = useState("");
  const [saveState, setSaveState] = useState<SaveState | null>(null);
  const [online, setOnline] = useState(true);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);

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
      <Toolbar grid={gridRef} onExportXlsx={workbookId && online ? exportXlsx : undefined} />
      <div style={styles.formulaBar}>
        <div style={styles.nameBox} aria-label="Name box">
          {label}
        </div>
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

      <div style={styles.gridWrap}>
        <SheetCanvas
          ref={gridRef}
          name={name}
          workbookId={workbookId}
          seed={seed}
          onSelectionChange={onSelectionChange}
          onSaveStateChange={setSaveState}
          onSheetsChange={onSheetsChange}
        />
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
        <span style={{ marginLeft: "auto" }}>SabSheet v2 · IronCalc engine</span>
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
  gridWrap: { flex: 1, minHeight: 0, position: "relative" },
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
