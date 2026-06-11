"use client";

/**
 * Printable render of a SabSheet workbook's active sheet.
 *
 * Self-contained and dependency-free: spins up a `CalcEngineClient`, bootstraps from the server
 * snapshot (decode base64 → init; init fresh when empty), reads a generous window of the active sheet,
 * trims trailing all-empty rows/cols to the used range, and lays the cells out in a plain HTML
 * `<table>`. Printing is the browser's own `window.print()` → "Save as PDF" — no server Chromium.
 *
 * Page-setup controls (orientation, gridlines, row/column headers) live in a non-printing toolbar; an
 * injected `@media print` stylesheet hides that toolbar, sizes the table, and drives `@page` margins.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { getSnapshotAction } from "@/app/actions/sabsheet-ops.actions";
import { CalcEngineClient } from "@/lib/sabsheet/engine/worker-client";
import type { CellView } from "@/lib/sabsheet/commands/ops";
import { colToLetters } from "@/components/sabsheet/grid/selection";

/** Same decode the grid uses: base64 → bytes. */
function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/** How much of the sheet we scan before trimming to the used range. */
const SCAN_ROWS = 200;
const SCAN_COLS = 40;

type Orientation = "portrait" | "landscape";

interface PrintGrid {
  /** Trimmed used-range bounds (1-based, inclusive). 0 rows/cols ⇒ empty sheet. */
  rows: number;
  cols: number;
  /** `text[r][c]` for 1-based r∈[1..rows], c∈[1..cols]; "" when blank. */
  text: string[][];
}

const EMPTY_GRID: PrintGrid = { rows: 0, cols: 0, text: [] };

/** Build a trimmed used-range grid from a flat viewport read. */
function buildGrid(cells: CellView[]): PrintGrid {
  let maxRow = 0;
  let maxCol = 0;
  for (const c of cells) {
    if (c.text === "") continue;
    if (c.row > maxRow) maxRow = c.row;
    if (c.col > maxCol) maxCol = c.col;
  }
  if (maxRow === 0 || maxCol === 0) return EMPTY_GRID;

  // text[r][c], 1-based; index 0 is unused padding so callers can use natural coords.
  const text: string[][] = Array.from({ length: maxRow + 1 }, () =>
    Array.from({ length: maxCol + 1 }, () => ""),
  );
  for (const c of cells) {
    if (c.row <= maxRow && c.col <= maxCol) text[c.row][c.col] = c.text;
  }
  return { rows: maxRow, cols: maxCol, text };
}

export function PrintView({
  workbookId,
  title,
  sheet = 0,
}: {
  workbookId: string;
  title: string;
  sheet?: number;
}) {
  const engineRef = useRef<CalcEngineClient | null>(null);
  const [grid, setGrid] = useState<PrintGrid | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Page-setup state.
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [showGridlines, setShowGridlines] = useState(true);
  const [showHeaders, setShowHeaders] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const engine = new CalcEngineClient();
    engineRef.current = engine;

    (async () => {
      try {
        const snap = await getSnapshotAction(workbookId);
        if (snap.snapshotB64) await engine.init(title, b64ToBytes(snap.snapshotB64));
        else await engine.init(title);

        const cells = await engine.readViewport(sheet, 1, 1, SCAN_COLS, SCAN_ROWS);
        if (cancelled) return;
        setGrid(buildGrid(cells));
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load workbook for printing.");
        setGrid(EMPTY_GRID);
      }
    })();

    return () => {
      cancelled = true;
      engine.destroy();
      engineRef.current = null;
    };
  }, [workbookId, title, sheet]);

  // `@page size` follows the orientation toggle; the rest is static.
  const pageStyle = useMemo(
    () => `
      @page { size: A4 ${orientation}; margin: 12mm; }
      @media print {
        html, body { background: #fff !important; }
        .sabsheet-print-toolbar { display: none !important; }
        .sabsheet-print-surface { box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
        .sabsheet-print-table { width: 100% !important; }
      }
    `,
    [orientation],
  );

  const colHeaders = useMemo(() => {
    if (!grid) return [];
    return Array.from({ length: grid.cols }, (_, i) => colToLetters(i + 1));
  }, [grid]);

  const ready = grid !== null;
  const isEmpty = ready && grid!.rows === 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f1f3f5",
        color: "#1a1a1a",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* eslint-disable-next-line react/no-danger -- static, app-authored print CSS */}
      <style dangerouslySetInnerHTML={{ __html: pageStyle }} />

      {/* Non-printing page-setup toolbar. */}
      <div
        className="sabsheet-print-toolbar"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 16,
          padding: "12px 20px",
          background: "#fff",
          borderBottom: "1px solid #dee2e6",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}
      >
        <strong style={{ fontSize: 14, marginRight: "auto" }}>
          {title}
          <span style={{ color: "#868e96", fontWeight: 400 }}> — Print preview</span>
        </strong>

        <label style={labelStyle}>
          Orientation
          <select
            value={orientation}
            onChange={(e) => setOrientation(e.target.value as Orientation)}
            style={selectStyle}
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
        </label>

        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={showGridlines}
            onChange={(e) => setShowGridlines(e.target.checked)}
          />
          Gridlines
        </label>

        <label style={checkboxLabelStyle}>
          <input
            type="checkbox"
            checked={showHeaders}
            onChange={(e) => setShowHeaders(e.target.checked)}
          />
          Row/column headers
        </label>

        <button
          type="button"
          onClick={() => window.print()}
          disabled={!ready}
          style={{
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 600,
            color: "#fff",
            background: ready ? "#1971c2" : "#adb5bd",
            border: "none",
            borderRadius: 6,
            cursor: ready ? "pointer" : "default",
          }}
        >
          Print / Save as PDF
        </button>
      </div>

      {/* The printable surface. */}
      <div style={{ display: "flex", justifyContent: "center", padding: "24px 16px" }}>
        <div
          className="sabsheet-print-surface"
          style={{
            background: "#fff",
            padding: 24,
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
            maxWidth: "100%",
            overflowX: "auto",
          }}
        >
          {error && (
            <p style={{ color: "#c92a2a", fontSize: 13 }}>{error}</p>
          )}

          {!ready && !error && (
            <p style={{ color: "#868e96", fontSize: 13 }}>Loading workbook…</p>
          )}

          {ready && isEmpty && (
            <p style={{ color: "#868e96", fontSize: 13 }}>This sheet is empty — nothing to print.</p>
          )}

          {ready && !isEmpty && (
            <table
              className="sabsheet-print-table"
              style={{
                borderCollapse: "collapse",
                fontSize: 12,
                lineHeight: 1.3,
                color: "#1a1a1a",
              }}
            >
              {showHeaders && (
                <thead>
                  <tr>
                    <th style={cornerHeaderStyle(showGridlines)} />
                    {colHeaders.map((letter) => (
                      <th key={letter} style={colHeaderStyle(showGridlines)}>
                        {letter}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {Array.from({ length: grid!.rows }, (_, ri) => {
                  const row = ri + 1;
                  return (
                    <tr key={row}>
                      {showHeaders && <th style={rowHeaderStyle(showGridlines)}>{row}</th>}
                      {Array.from({ length: grid!.cols }, (_, ci) => {
                        const col = ci + 1;
                        return (
                          <td key={col} style={cellStyle(showGridlines)}>
                            {grid!.text[row]?.[col] ?? ""}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// --- inline style helpers (kept here so the file stays self-contained) ---

const labelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "#495057",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12,
  color: "#495057",
  cursor: "pointer",
};

const selectStyle: React.CSSProperties = {
  fontSize: 12,
  padding: "4px 6px",
  border: "1px solid #ced4da",
  borderRadius: 4,
  background: "#fff",
};

const border = "1px solid #ced4da";
const headerBg = "#f1f3f5";

function cellStyle(gridlines: boolean): React.CSSProperties {
  return {
    border: gridlines ? border : "1px solid transparent",
    padding: "3px 6px",
    minWidth: 56,
    maxWidth: 240,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };
}

function colHeaderStyle(gridlines: boolean): React.CSSProperties {
  return {
    border: gridlines ? border : "1px solid transparent",
    padding: "3px 6px",
    background: headerBg,
    fontWeight: 600,
    textAlign: "center",
    color: "#495057",
  };
}

function rowHeaderStyle(gridlines: boolean): React.CSSProperties {
  return {
    border: gridlines ? border : "1px solid transparent",
    padding: "3px 8px",
    background: headerBg,
    fontWeight: 600,
    textAlign: "right",
    color: "#495057",
    whiteSpace: "nowrap",
  };
}

function cornerHeaderStyle(gridlines: boolean): React.CSSProperties {
  return {
    border: gridlines ? border : "1px solid transparent",
    background: headerBg,
    minWidth: 32,
  };
}
