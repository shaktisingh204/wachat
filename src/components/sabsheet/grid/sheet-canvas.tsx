"use client";

/**
 * `SheetCanvas` — the interactive grid surface. Owns the layered canvases, the imperative
 * `GridRenderer`, and the `CalcEngineClient`, and wires pointer/keyboard interaction + an in-cell
 * editor overlay. React state here is deliberately coarse (selection, editing, status) — per-cell
 * paints go through the renderer, not the React tree.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { AxisIndex } from "./axis-index.ts";
import { GridRenderer, DEFAULT_THEME } from "./grid-renderer.ts";
import {
  singleCell,
  selectCell,
  extendTo,
  move,
  extend,
  selectionBox,
  selectionLabel,
  selectionCount,
  parseRef,
  cellToA1,
  colToLetters,
  type SelectionState,
  type AxisBounds,
} from "./selection.ts";
import { cellsToTsv } from "../clipboard/tsv.ts";
import { computeAggregates, aggregateLabel } from "./aggregate.ts";
import { CalcEngineClient } from "../../../lib/sabsheet/engine/worker-client.ts";
import type { SheetInfo } from "../../../lib/sabsheet/engine/protocol.ts";
import { cmd, cellRange, StylePath, type Command, type CellView } from "../../../lib/sabsheet/commands/ops.ts";
import {
  applyOpsAction,
  getSnapshotAction,
  opsSinceAction,
} from "../../../app/actions/sabsheet-ops.actions.ts";
import { OfflineOutbox, MemoryOutboxStore, type SyncState } from "../../../lib/sabsheet/offline/outbox.ts";
import { IdbOutboxStore, idbAvailable } from "../../../lib/sabsheet/offline/idb-store.ts";
import { RealtimeSync } from "../../../lib/sabsheet/collab/sync.ts";

/** Decode a base64 string to bytes (client-side; no Node Buffer). */
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const MAX_ROW = 1_000_000;
const MAX_COL = 16_384;
const DEFAULT_ROW_H = 24;
const DEFAULT_COL_W = 100;
const BOUNDS: AxisBounds = { maxRow: MAX_ROW, maxCol: MAX_COL };

export interface SheetCanvasProps {
  /** Workbook display name (the engine is created fresh unless `seed` rehydrates it). */
  name: string;
  /**
   * Persistent workbook id. When set, the engine bootstraps from the server snapshot and every edit
   * autosaves through `/v1/sabsheet/ops`. When omitted, the grid is purely in-memory (preview/demo).
   */
  workbookId?: string;
  /** Optional commands applied once on load (demo seeding / fixtures). */
  seed?: Command[];
  /** Notifies the parent (formula bar, status bar) when selection or the active value changes. */
  onSelectionChange?: (label: string, activeContent: string) => void;
  /** Reports sync state to the chrome (offline-aware). */
  onSaveStateChange?: (state: SaveState) => void;
  /** Reports the worksheet list + active index whenever they change (drives the sheet-tab strip). */
  onSheetsChange?: (sheets: SheetInfo[], active: number) => void;
  /** Reports the status-bar aggregate label (Sum/Avg/Count) for the selection, or null. */
  onAggregatesChange?: (label: string | null) => void;
}

/** Cloud-sync status surfaced to the workbench. Offline edits stay safe locally. */
export type SaveState = "saving" | "synced" | "pending" | "offline" | "conflict" | "error";

interface EditState {
  row: number;
  col: number;
  value: string;
}

/** Imperative surface the chrome (formula bar, toolbar, sheet tabs) drives the grid through. */
export interface SheetCanvasHandle {
  /** Commit a value/formula into the current active cell (formula-bar Enter). */
  commitActiveInput(value: string): Promise<void>;
  /** Apply one IronCalc style attribute (path/value) across the current selection. */
  applyStyle(path: string, value: string): Promise<void>;
  undo(): Promise<void>;
  redo(): Promise<void>;
  /** Switch the rendered worksheet (resets selection to A1). */
  setActiveSheet(index: number): Promise<void>;
  /** Append a new worksheet and switch to it. */
  addSheet(): Promise<void>;
  /** Rename a worksheet by index. */
  renameSheet(index: number, name: string): Promise<void>;
  /** Navigate the selection to a name-box ref ("B7" or "A1:C9"); no-op if invalid. */
  goTo(ref: string): void;
  /** Insert `count` rows above (or below) the selection. */
  insertRows(below: boolean, count?: number): Promise<void>;
  /** Insert `count` columns left of (or right of) the selection. */
  insertColumns(right: boolean, count?: number): Promise<void>;
  /** Delete the selected rows / columns. */
  deleteRows(): Promise<void>;
  deleteColumns(): Promise<void>;
  /** Clear the contents of the selection (keep formatting). */
  clearContents(): Promise<void>;
  /** Sort the selection by its first column. */
  sortSelection(ascending: boolean): Promise<void>;
  /** Replace text across the selection. */
  replaceAll(find: string, replace: string, matchCase: boolean): Promise<void>;
  /** Freeze rows above + columns left of the active cell (Excel "Freeze Panes"). */
  freezeAtActive(): Promise<void>;
  /** Remove all frozen panes. */
  unfreeze(): Promise<void>;
  /** AutoSum: place `=SUM(selection)` just below a multi-cell selection. */
  autoSum(): Promise<void>;
  /** Read the current selection's cells + box + active sheet index (for charts, etc.). */
  getSelection(): Promise<{ cells: CellView[]; box: { top: number; left: number; bottom: number; right: number }; sheet: number }>;
}

export const SheetCanvas = forwardRef<SheetCanvasHandle, SheetCanvasProps>(function SheetCanvas(
  { name, workbookId, seed, onSelectionChange, onSaveStateChange, onSheetsChange, onAggregatesChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<GridRenderer | null>(null);
  const engineRef = useRef<CalcEngineClient | null>(null);
  const selectionRef = useRef<SelectionState>(singleCell(1, 1));
  const draggingRef = useRef(false);
  /** When set, the user is dragging the fill handle from this selection box. */
  const fillRef = useRef<SelectionState | null>(null);
  /** Offline-first cloud-save queue (null for the in-memory preview with no workbookId). */
  const outboxRef = useRef<OfflineOutbox | null>(null);
  /** Latest connectivity belief; flipped by the browser online/offline events. */
  const onlineRef = useRef(true);
  /** Active worksheet index (command `sheet`); the grid renders one sheet at a time. */
  const sheetRef = useRef(0);
  /** Frozen pane counts for the active sheet (mirrors the engine; drives band fetching + paint). */
  const frozenRef = useRef({ rows: 0, cols: 0 });

  const [editing, setEditing] = useState<EditState | null>(null);
  const [ready, setReady] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; items: { label: string; run: () => void }[] } | null>(null);

  const rows = useMemo(() => new AxisIndex(MAX_ROW, DEFAULT_ROW_H), []);
  const cols = useMemo(() => new AxisIndex(MAX_COL, DEFAULT_COL_W), []);

  /** Re-read the visible viewport (plus any frozen bands) from the engine and repaint. */
  const refresh = useCallback(async () => {
    const r = rendererRef.current;
    const e = engineRef.current;
    if (!r || !e) return;
    const sheet = sheetRef.current;
    const { rowStart, rowEnd, colStart, colEnd } = r.visibleRange();
    const mw = colEnd - colStart + 1;
    const mh = rowEnd - rowStart + 1;
    const { rows: fr, cols: fc } = frozenRef.current;
    let cells = await e.readViewport(sheet, rowStart, colStart, mw, mh);
    if (fr > 0) cells = cells.concat(await e.readViewport(sheet, 1, colStart, mw, fr)); // frozen rows × main cols
    if (fc > 0) cells = cells.concat(await e.readViewport(sheet, rowStart, 1, fc, mh)); // main rows × frozen cols
    if (fr > 0 && fc > 0) cells = cells.concat(await e.readViewport(sheet, 1, 1, fc, fr)); // corner
    r.setCells(cells);
    r.draw();
  }, []);

  /** Read frozen pane counts for the active sheet from the engine and apply them to the renderer. */
  const syncFrozen = useCallback(async () => {
    const e = engineRef.current;
    const r = rendererRef.current;
    if (!e || !r) return;
    const f = await e.frozen(sheetRef.current);
    frozenRef.current = f;
    r.setFrozen(f.rows, f.cols);
  }, []);

  const emitSelection = useCallback(async () => {
    const sel = selectionRef.current;
    const e = engineRef.current;
    let content = "";
    if (e) {
      try {
        content = await e.content(sheetRef.current, sel.active.row, sel.active.col);
      } catch {
        content = "";
      }
    }
    onSelectionChange?.(selectionLabel(sel), content);

    // Status-bar aggregates for a multi-cell selection (capped so a huge selection stays cheap).
    if (onAggregatesChange) {
      const total = selectionCount(sel);
      if (total < 2 || !e) {
        onAggregatesChange(null);
      } else if (total > 50_000) {
        onAggregatesChange(`Count: ${total} (too large to total)`);
      } else {
        const box = selectionBox(sel);
        try {
          const cells = await e.readViewport(
            sheetRef.current,
            box.top,
            box.left,
            box.right - box.left + 1,
            box.bottom - box.top + 1,
          );
          onAggregatesChange(aggregateLabel(computeAggregates(cells)));
        } catch {
          onAggregatesChange(null);
        }
      }
    }
  }, [onSelectionChange, onAggregatesChange]);

  /**
   * Apply a command batch to the local engine and repaint — this always succeeds, online or off.
   * For persistent workbooks the edit is also handed to the offline outbox, which durably queues it
   * and syncs to the cloud when reachable (and retries automatically on reconnect). Nothing is lost
   * offline; only the cloud round-trip is deferred.
   */
  const applyLocal = useCallback(
    async (commands: Command[]) => {
      const e = engineRef.current;
      if (!e || commands.length === 0) return;
      await e.apply(commands);
      await refresh();
      const box = outboxRef.current;
      if (!box) return; // in-memory preview (no workbookId)
      onSaveStateChange?.("saving");
      const snapshot = await e.toSnapshot();
      await box.record(commands, snapshot);
    },
    [refresh, onSaveStateChange],
  );

  const setSelection = useCallback(
    (s: SelectionState) => {
      selectionRef.current = s;
      rendererRef.current?.setSelection(s);
      rendererRef.current?.draw();
      void emitSelection();
    },
    [emitSelection],
  );

  /** Read the worksheet list from the engine and report it to the chrome. */
  const syncSheets = useCallback(async () => {
    const e = engineRef.current;
    if (!e) return;
    const sheets = await e.sheetList();
    onSheetsChange?.(sheets, sheetRef.current);
  }, [onSheetsChange]);

  /** Switch to another worksheet: reset selection, repaint, re-read the viewport. */
  const switchSheet = useCallback(
    async (index: number) => {
      const e = engineRef.current;
      if (!e) return;
      const count = (await e.sheetList()).length;
      sheetRef.current = Math.max(0, Math.min(index, count - 1));
      setSelection(singleCell(1, 1));
      await syncFrozen();
      await refresh();
      await syncSheets();
    },
    [refresh, setSelection, syncSheets, syncFrozen],
  );

  useImperativeHandle(
    ref,
    () => ({
      async commitActiveInput(value: string) {
        const sel = selectionRef.current;
        await applyLocal([cmd.setCell(sheetRef.current, sel.active.row, sel.active.col, value)]);
        await emitSelection();
      },
      async applyStyle(path: string, value: string) {
        const box = selectionBox(selectionRef.current);
        await applyLocal([
          cmd.setStyle(
            { sheet: sheetRef.current, row: box.top, col: box.left, width: box.right - box.left + 1, height: box.bottom - box.top + 1 },
            path,
            value,
          ),
        ]);
      },
      async undo() {
        const e = engineRef.current;
        if (!e) return;
        await e.undo();
        await refresh();
        await emitSelection();
      },
      async redo() {
        const e = engineRef.current;
        if (!e) return;
        await e.redo();
        await refresh();
        await emitSelection();
      },
      async setActiveSheet(index: number) {
        await switchSheet(index);
      },
      async addSheet() {
        const e = engineRef.current;
        if (!e) return;
        await applyLocal([cmd.newSheet()]);
        const count = (await e.sheetList()).length;
        await switchSheet(count - 1);
      },
      async renameSheet(index: number, newName: string) {
        await applyLocal([{ type: "renameSheet", sheet: index, name: newName }]);
        await syncSheets();
      },
      goTo(refStr: string) {
        const next = parseRef(refStr);
        if (!next) return;
        const clamped: SelectionState = {
          anchor: { row: Math.min(next.anchor.row, MAX_ROW), col: Math.min(next.anchor.col, MAX_COL) },
          active: { row: Math.min(next.active.row, MAX_ROW), col: Math.min(next.active.col, MAX_COL) },
        };
        // Scroll so the active cell is visible (place it near the top-left of the viewport).
        const r = rendererRef.current;
        if (r) {
          r.setScroll(cols.offsetOf(clamped.active.col - 1), rows.offsetOf(clamped.active.row - 1));
        }
        setSelection(clamped);
        void refresh();
      },
      async insertRows(below: boolean, count = 1) {
        const box = selectionBox(selectionRef.current);
        const at = below ? box.bottom + 1 : box.top;
        await applyLocal([cmd.insertRows(sheetRef.current, at, count)]);
      },
      async insertColumns(right: boolean, count = 1) {
        const box = selectionBox(selectionRef.current);
        const at = right ? box.right + 1 : box.left;
        await applyLocal([cmd.insertColumns(sheetRef.current, at, count)]);
      },
      async deleteRows() {
        const box = selectionBox(selectionRef.current);
        await applyLocal([cmd.deleteRows(sheetRef.current, box.top, box.bottom - box.top + 1)]);
      },
      async deleteColumns() {
        const box = selectionBox(selectionRef.current);
        await applyLocal([cmd.deleteColumns(sheetRef.current, box.left, box.right - box.left + 1)]);
      },
      async clearContents() {
        const box = selectionBox(selectionRef.current);
        await applyLocal([
          cmd.clearContents({ sheet: sheetRef.current, row: box.top, col: box.left, width: box.right - box.left + 1, height: box.bottom - box.top + 1 }),
        ]);
      },
      async sortSelection(ascending: boolean) {
        const box = selectionBox(selectionRef.current);
        await applyLocal([
          cmd.sortRange(
            { sheet: sheetRef.current, row: box.top, col: box.left, width: box.right - box.left + 1, height: box.bottom - box.top + 1 },
            0,
            ascending,
            false,
          ),
        ]);
      },
      async replaceAll(find: string, replace: string, matchCase: boolean) {
        const box = selectionBox(selectionRef.current);
        const single = box.top === box.bottom && box.left === box.right;
        // A single-cell selection means "whole used sheet"; approximate with a large window.
        const range = single
          ? { sheet: sheetRef.current, row: 1, col: 1, width: 256, height: 100_000 }
          : { sheet: sheetRef.current, row: box.top, col: box.left, width: box.right - box.left + 1, height: box.bottom - box.top + 1 };
        await applyLocal([cmd.replaceAll(range, find, replace, matchCase)]);
      },
      async freezeAtActive() {
        const a = selectionRef.current.active;
        await applyLocal([
          { type: "setFrozenRows", sheet: sheetRef.current, count: a.row - 1 },
          { type: "setFrozenColumns", sheet: sheetRef.current, count: a.col - 1 },
        ]);
        await syncFrozen();
        await refresh();
      },
      async unfreeze() {
        await applyLocal([
          { type: "setFrozenRows", sheet: sheetRef.current, count: 0 },
          { type: "setFrozenColumns", sheet: sheetRef.current, count: 0 },
        ]);
        await syncFrozen();
        await refresh();
      },
      async autoSum() {
        const box = selectionBox(selectionRef.current);
        if (box.top === box.bottom && box.left === box.right) return; // need a range
        const range = `${colToLetters(box.left)}${box.top}:${colToLetters(box.right)}${box.bottom}`;
        await applyLocal([cmd.setCell(sheetRef.current, box.bottom + 1, box.left, `=SUM(${range})`)]);
        setSelection(singleCell(box.bottom + 1, box.left));
      },
      async getSelection() {
        const box = selectionBox(selectionRef.current);
        const e = engineRef.current;
        const cells = e
          ? await e.readViewport(sheetRef.current, box.top, box.left, box.right - box.left + 1, box.bottom - box.top + 1)
          : [];
        return { cells, box, sheet: sheetRef.current };
      },
    }),
    [applyLocal, refresh, emitSelection, switchSheet, syncSheets, syncFrozen, setSelection, cols, rows],
  );

  // --- lifecycle: build renderer + engine, size to container, seed, first paint ---
  useEffect(() => {
    const content = contentRef.current;
    const overlay = overlayRef.current;
    const container = containerRef.current;
    if (!content || !overlay || !container) return;

    const renderer = new GridRenderer(content, overlay, rows, cols, DEFAULT_THEME);
    rendererRef.current = renderer;
    renderer.setSelection(selectionRef.current);

    const engine = new CalcEngineClient();
    engineRef.current = engine;

    const ro = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      renderer.resize(rect.width, rect.height, window.devicePixelRatio || 1);
      void refresh();
    });
    ro.observe(container);

    // --- offline outbox + connectivity ---
    onlineRef.current = typeof navigator === "undefined" ? true : navigator.onLine;

    // On a genuine multi-writer conflict, the server is authoritative — re-bootstrap from its snapshot.
    const resolveConflict = async () => {
      const box = outboxRef.current;
      if (!workbookId || !box) return;
      try {
        const snap = await getSnapshotAction(workbookId);
        if (snap.snapshotB64) await engine.init(name, b64ToBytes(snap.snapshotB64));
        await box.resolveConflict(snap.seq);
        await refresh();
      } catch {
        /* still offline — stay in conflict until reconnect */
      }
    };

    let outbox: OfflineOutbox | null = null;
    if (workbookId) {
      const store = idbAvailable() ? new IdbOutboxStore() : new MemoryOutboxStore();
      outbox = new OfflineOutbox({
        workbookId,
        store,
        isOnline: () => onlineRef.current,
        flush: async (batch, baseSeq) => {
          const res = await applyOpsAction({ workbookId, baseSeq, commands: batch.commands });
          return { seq: res.seq, rejected: res.rejected };
        },
        onStateChange: (state) => {
          onSaveStateChange?.(state);
          if (state === "conflict") void resolveConflict();
        },
      });
      outboxRef.current = outbox;
    }

    // Inbound realtime sync (other collaborators' edits). Reuses the ordered op log via opsSince;
    // an SSE/WebSocket push can replace the poller later without touching this wiring.
    let sync: RealtimeSync | null = null;
    if (workbookId && outbox) {
      const ob = outbox;
      sync = new RealtimeSync({
        isOnline: () => onlineRef.current,
        hasPending: async () => (await ob.pendingCount()) > 0,
        getSeq: () => ob.currentSeq(),
        setSeq: (s) => ob.setBaseSeq(s),
        fetchSince: async (since) => {
          const { ops } = await opsSinceAction(workbookId, since);
          return ops.map((o) => ({ seq: o.seq, diffs: b64ToBytes(o.diffsB64) }));
        },
        applyRemote: async (diffs) => {
          await engine.applyRemoteDiffs(diffs);
        },
        onApplied: () => {
          void refresh();
          void emitSelection();
        },
      });
    }

    const onOnline = () => {
      onlineRef.current = true;
      void outbox?.flush();
      void sync?.poll();
    };
    const onOffline = () => {
      onlineRef.current = false;
      onSaveStateChange?.("offline");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    let cancelled = false;
    (async () => {
      if (workbookId && outbox) {
        let booted = false;
        if (onlineRef.current) {
          // Try the authoritative server snapshot first.
          try {
            const snap = await getSnapshotAction(workbookId);
            await outbox.setBaseSeq(snap.seq);
            if (snap.snapshotB64) {
              await engine.init(name, b64ToBytes(snap.snapshotB64));
            } else {
              await engine.init(name);
              if (seed && seed.length) await applyLocal(seed);
            }
            booted = true;
            // Drain anything queued during a previous offline session.
            await outbox.flush();
          } catch {
            /* server unreachable — fall back to the local cache below */
          }
        }
        if (!booted) {
          const cached = await outbox.cachedSnapshot();
          if (cached) {
            await engine.init(name, cached.bytes);
            onSaveStateChange?.(onlineRef.current ? "pending" : "offline");
          } else {
            await engine.init(name);
            if (seed && seed.length) await applyLocal(seed);
          }
        }
      } else {
        await engine.init(name);
        if (seed && seed.length) await engine.apply(seed);
      }
      if (cancelled) return;
      const rect = container.getBoundingClientRect();
      renderer.resize(rect.width, rect.height, window.devicePixelRatio || 1);
      setReady(true);
      await syncFrozen();
      await refresh();
      await emitSelection();
      await syncSheets();
      sync?.start(); // begin polling for collaborators' edits
    })();

    return () => {
      cancelled = true;
      ro.disconnect();
      sync?.stop();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      engine.destroy();
      rendererRef.current = null;
      engineRef.current = null;
      outboxRef.current = null;
    };
    // Re-bootstrap when the workbook identity changes; callback identities are intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, workbookId]);

  // --- scrolling ---
  const onWheel = useCallback(
    (ev: React.WheelEvent) => {
      const r = rendererRef.current;
      if (!r) return;
      const maxX = Math.max(0, cols.totalExtent() - r.viewportWidth + DEFAULT_THEME.rowHeaderWidth);
      const maxY = Math.max(0, rows.totalExtent() - r.viewportHeight + DEFAULT_THEME.colHeaderHeight);
      r.setScroll(
        Math.min(Math.max(0, r.scrollX + ev.deltaX), maxX),
        Math.min(Math.max(0, r.scrollY + ev.deltaY), maxY),
      );
      r.draw();
      void refresh();
    },
    [cols, rows, refresh],
  );

  // --- pointer selection ---
  const onPointerDown = useCallback(
    (ev: React.PointerEvent) => {
      const r = rendererRef.current;
      if (!r || editing) return;
      const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
      // Fill-handle drag starts when the pointer lands on the handle square.
      if (r.isOnFillHandle(px, py)) {
        fillRef.current = selectionRef.current;
        return;
      }
      const hit = r.cellAt(px, py);
      if (!hit) return;
      draggingRef.current = true;
      const next = ev.shiftKey
        ? extendTo(selectionRef.current, hit.row, hit.col, BOUNDS)
        : selectCell(hit.row, hit.col, BOUNDS);
      setSelection(next);
    },
    [editing, setSelection],
  );

  const onPointerMove = useCallback(
    (ev: React.PointerEvent) => {
      const r = rendererRef.current;
      if (!r) return;
      const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
      const hit = r.cellAt(ev.clientX - rect.left, ev.clientY - rect.top);
      if (!hit) return;
      if (fillRef.current) {
        // Preview the fill target by extending the selection toward the pointer.
        setSelection(extendTo(fillRef.current, hit.row, hit.col, BOUNDS));
      } else if (draggingRef.current) {
        setSelection(extendTo(selectionRef.current, hit.row, hit.col, BOUNDS));
      }
    },
    [setSelection],
  );

  // Right-click a row/column header → structural-edit menu (uses the engine's tested insert/delete ops).
  const onContextMenu = useCallback(
    (ev: React.MouseEvent) => {
      const r = rendererRef.current;
      if (!r) return;
      const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
      const hit = r.headerAt(ev.clientX - rect.left, ev.clientY - rect.top);
      if (!hit || hit.kind === "corner") return;
      ev.preventDefault();
      const s = sheetRef.current;
      const px = ev.clientX - rect.left;
      const py = ev.clientY - rect.top;
      if (hit.kind === "col") {
        setMenu({
          x: px,
          y: py,
          items: [
            { label: "Insert column left", run: () => void applyLocal([cmd.insertColumns(s, hit.index, 1)]) },
            { label: "Insert column right", run: () => void applyLocal([cmd.insertColumns(s, hit.index + 1, 1)]) },
            { label: "Delete column", run: () => void applyLocal([cmd.deleteColumns(s, hit.index, 1)]) },
          ],
        });
      } else {
        setMenu({
          x: px,
          y: py,
          items: [
            { label: "Insert row above", run: () => void applyLocal([cmd.insertRows(s, hit.index, 1)]) },
            { label: "Insert row below", run: () => void applyLocal([cmd.insertRows(s, hit.index + 1, 1)]) },
            { label: "Delete row", run: () => void applyLocal([cmd.deleteRows(s, hit.index, 1)]) },
          ],
        });
      }
    },
    [applyLocal],
  );

  const onPointerUp = useCallback(async () => {
    draggingRef.current = false;
    const src = fillRef.current;
    fillRef.current = null;
    if (!src) return;
    // Commit the fill: source = the original box; target = the grown box. Fill the dominant axis.
    const srcBox = selectionBox(src);
    const grown = selectionBox(selectionRef.current);
    const sourceRange = {
      sheet: sheetRef.current,
      row: srcBox.top,
      col: srcBox.left,
      width: srcBox.right - srcBox.left + 1,
      height: srcBox.bottom - srcBox.top + 1,
    };
    if (grown.bottom > srcBox.bottom) {
      await applyLocal([{ type: "autoFillRows", source: sourceRange, toRow: grown.bottom }]);
    } else if (grown.right > srcBox.right) {
      await applyLocal([{ type: "autoFillColumns", source: sourceRange, toCol: grown.right }]);
    }
  }, [applyLocal]);

  // --- editing ---
  const beginEdit = useCallback(async (initial?: string) => {
    const e = engineRef.current;
    const sel = selectionRef.current;
    if (!e) return;
    const value = initial ?? (await e.content(sheetRef.current, sel.active.row, sel.active.col));
    setEditing({ row: sel.active.row, col: sel.active.col, value });
  }, []);

  const commitEdit = useCallback(
    async (moveRow: number, moveCol: number) => {
      const ed = editing;
      if (!ed) return;
      await applyLocal([cmd.setCell(sheetRef.current, ed.row, ed.col, ed.value)]);
      setEditing(null);
      setSelection(move(selectionRef.current, moveRow, moveCol, BOUNDS));
    },
    [editing, applyLocal, setSelection],
  );

  // --- clipboard (internal buffer + system clipboard when available) ---
  const clipboardRef = useRef<string>("");

  const copySelection = useCallback(async (): Promise<string> => {
    const e = engineRef.current;
    if (!e) return "";
    const box = selectionBox(selectionRef.current);
    const cells = await e.readViewport(sheetRef.current, box.top, box.left, box.right - box.left + 1, box.bottom - box.top + 1);
    const tsv = cellsToTsv(cells, box);
    clipboardRef.current = tsv;
    try {
      await navigator.clipboard?.writeText(tsv);
    } catch {
      /* clipboard API unavailable (non-secure context) — internal buffer still works */
    }
    return tsv;
  }, []);

  const pasteSelection = useCallback(async () => {
    let text = "";
    try {
      text = (await navigator.clipboard?.readText()) ?? "";
    } catch {
      text = "";
    }
    if (!text) text = clipboardRef.current;
    if (!text) return;
    const sel = selectionRef.current;
    await applyLocal([cmd.pasteCsv(cellRange(sheetRef.current, sel.active.row, sel.active.col), text)]);
  }, [applyLocal]);

  const onKeyDown = useCallback(
    async (ev: React.KeyboardEvent) => {
      if (editing) return; // editor textarea handles its own keys
      const sel = selectionRef.current;
      const k = ev.key;
      const mod = ev.metaKey || ev.ctrlKey;

      if (mod && (k === "z" || k === "Z")) {
        ev.preventDefault();
        const e = engineRef.current;
        if (e) {
          if (ev.shiftKey) await e.redo();
          else await e.undo();
          await refresh();
          await emitSelection();
        }
        return;
      }
      if (mod && (k === "y" || k === "Y")) {
        ev.preventDefault();
        const e = engineRef.current;
        if (e) {
          await e.redo();
          await refresh();
          await emitSelection();
        }
        return;
      }
      if (mod && (k === "c" || k === "C")) {
        ev.preventDefault();
        await copySelection();
        return;
      }
      if (mod && (k === "x" || k === "X")) {
        ev.preventDefault();
        await copySelection();
        const box = selectionBox(sel);
        await applyLocal([
          cmd.clearContents({ sheet: sheetRef.current, row: box.top, col: box.left, width: box.right - box.left + 1, height: box.bottom - box.top + 1 }),
        ]);
        return;
      }
      if (mod && (k === "v" || k === "V")) {
        ev.preventDefault();
        await pasteSelection();
        return;
      }
      // Formatting shortcuts (apply across the selection).
      if (mod && (k === "b" || k === "i" || k === "u" || k === "B" || k === "I" || k === "U")) {
        ev.preventDefault();
        const box = selectionBox(sel);
        const path = k.toLowerCase() === "b" ? StylePath.bold : k.toLowerCase() === "i" ? StylePath.italic : StylePath.underline;
        await applyLocal([
          cmd.setStyle(
            { sheet: sheetRef.current, row: box.top, col: box.left, width: box.right - box.left + 1, height: box.bottom - box.top + 1 },
            path,
            "true",
          ),
        ]);
        return;
      }
      // Ctrl/Cmd+S forces a sync flush rather than the browser save dialog.
      if (mod && (k === "s" || k === "S")) {
        ev.preventDefault();
        onSaveStateChange?.("saving");
        await outboxRef.current?.flush();
        return;
      }
      // Ctrl/Cmd+Home jumps to A1.
      if (mod && k === "Home") {
        ev.preventDefault();
        rendererRef.current?.setScroll(0, 0);
        setSelection(singleCell(1, 1));
        await refresh();
        return;
      }
      if (k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight") {
        ev.preventDefault();
        const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k]!;
        setSelection(ev.shiftKey ? extend(sel, d[0], d[1], BOUNDS) : move(sel, d[0], d[1], BOUNDS));
        return;
      }
      if (k === "Enter") {
        ev.preventDefault();
        await beginEdit();
        return;
      }
      if (k === "F2") {
        ev.preventDefault();
        await beginEdit();
        return;
      }
      if (k === "Tab") {
        ev.preventDefault();
        setSelection(move(sel, 0, ev.shiftKey ? -1 : 1, BOUNDS));
        return;
      }
      if (k === "Delete" || k === "Backspace") {
        ev.preventDefault();
        await applyLocal([
          cmd.clearContents({ sheet: sheetRef.current, row: sel.active.row, col: sel.active.col, width: 1, height: 1 }),
        ]);
        return;
      }
      // A printable character starts an edit pre-filled with it (Excel behavior).
      if (k.length === 1 && !ev.metaKey && !ev.ctrlKey) {
        ev.preventDefault();
        await beginEdit(k);
      }
    },
    [editing, beginEdit, applyLocal, setSelection, refresh, emitSelection, copySelection, pasteSelection, onSaveStateChange],
  );

  // Position the editor textarea over the active cell.
  const editorStyle = useMemo((): React.CSSProperties | null => {
    const r = rendererRef.current;
    if (!editing || !r) return null;
    const rect = r.cellRect(editing.row, editing.col);
    return {
      position: "absolute",
      left: rect.x,
      top: rect.y,
      width: rect.w,
      height: rect.h,
      font: DEFAULT_THEME.font,
      padding: "0 3px",
      border: `2px solid ${DEFAULT_THEME.selectionBorder}`,
      outline: "none",
      resize: "none",
      boxSizing: "border-box",
      zIndex: 5,
    };
  }, [editing]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      onPointerDown={(e) => {
        setMenu(null);
        onPointerDown(e);
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
      style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", outline: "none", userSelect: "none" }}
      aria-label={`Spreadsheet ${name}, active cell ${cellToA1(selectionRef.current.active)}`}
    >
      <canvas ref={contentRef} style={{ position: "absolute", inset: 0 }} />
      <canvas ref={overlayRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
      {menu && (
        <ul
          role="menu"
          style={{
            position: "absolute",
            left: menu.x,
            top: menu.y,
            zIndex: 10,
            margin: 0,
            padding: "4px 0",
            listStyle: "none",
            minWidth: 168,
            background: "#fff",
            border: "1px solid #e1e3e6",
            borderRadius: 6,
            boxShadow: "0 4px 16px rgba(0,0,0,0.16)",
            font: DEFAULT_THEME.font,
          }}
        >
          {menu.items.map((it) => (
            <li
              key={it.label}
              role="menuitem"
              tabIndex={0}
              onClick={() => {
                it.run();
                setMenu(null);
              }}
              style={{ padding: "6px 14px", cursor: "pointer", color: "#202124" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f3f4")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {it.label}
            </li>
          ))}
        </ul>
      )}
      {editing && editorStyle && (
        <textarea
          autoFocus
          value={editing.value}
          style={editorStyle}
          onChange={(e) => setEditing({ ...editing, value: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void commitEdit(1, 0);
            } else if (e.key === "Tab") {
              e.preventDefault();
              void commitEdit(0, e.shiftKey ? -1 : 1);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(null);
            }
          }}
        />
      )}
      {!ready && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#5f6368", font: DEFAULT_THEME.font }}>
          Loading engine…
        </div>
      )}
    </div>
  );
});
