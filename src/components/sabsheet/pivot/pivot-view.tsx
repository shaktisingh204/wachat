"use client";

/**
 * SabSheet pivot tables — render.
 *
 * Renders a `PivotResult` as an HTML cross-tab: row keys down the left, col keys
 * across the top, a totals row + totals column, and the grand total in the corner.
 * Pure presentation (no data fetching); styled with inline styles matching
 * `chrome/ribbon.tsx`.
 */
import * as React from "react";

import type { PivotResult } from "./pivot-compute.ts";

export interface PivotViewProps {
  result: PivotResult;
  /** Format a numeric cell — defaults to integer-or-2dp. */
  format?: (n: number) => string;
}

function defaultFormat(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

export function PivotView({ result, format = defaultFormat }: PivotViewProps) {
  const { rowKeys, colKeys, matrix, rowTotals, colTotals, grandTotal } = result;

  if (rowKeys.length === 0) {
    return <div style={emptyStyle}>No data to pivot. Select a range with a header row and at least one data row.</div>;
  }

  // A single empty col key (colField === null) reads better as one "Value" column.
  const showColHeaderRow = colKeys.some((k) => k.trim() !== "") || colKeys.length > 1;
  const displayColKeys = colKeys.map((k, i) =>
    k.trim() === "" ? (colKeys.length === 1 ? "Value" : `(blank ${i + 1})`) : k,
  );

  return (
    <div style={scrollWrap}>
      <table style={table}>
        <thead>
          {showColHeaderRow ? (
            <tr>
              <th style={cornerTh} scope="col" />
              {displayColKeys.map((k, c) => (
                <th key={`ch-${c}`} style={colTh} scope="col">
                  {k}
                </th>
              ))}
              <th style={totalTh} scope="col">
                Total
              </th>
            </tr>
          ) : (
            <tr>
              <th style={cornerTh} scope="col" />
              <th style={totalTh} scope="col">
                Total
              </th>
            </tr>
          )}
        </thead>
        <tbody>
          {rowKeys.map((rk, r) => (
            <tr key={`r-${r}`}>
              <th style={rowTh} scope="row">
                {rk.trim() === "" ? "(blank)" : rk}
              </th>
              {showColHeaderRow
                ? matrix[r].map((v, c) => (
                    <td key={`v-${r}-${c}`} style={numTd}>
                      {format(v)}
                    </td>
                  ))
                : (
                  <td style={numTd}>{format(rowTotals[r])}</td>
                )}
              {showColHeaderRow ? (
                <td style={rowTotalTd}>{format(rowTotals[r])}</td>
              ) : null}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th style={footTh} scope="row">
              Total
            </th>
            {showColHeaderRow
              ? colTotals.map((v, c) => (
                  <td key={`ct-${c}`} style={colTotalTd}>
                    {format(v)}
                  </td>
                ))
              : null}
            <td style={grandTd}>{format(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default PivotView;

/* ---- styles (mirroring chrome/ribbon.tsx) ------------------------------- */

const FONT = "13px -apple-system, system-ui, sans-serif";

const scrollWrap: React.CSSProperties = {
  overflow: "auto",
  border: "1px solid #e1e3e6",
  borderRadius: 6,
  background: "#fff",
};

const table: React.CSSProperties = {
  borderCollapse: "collapse",
  font: FONT,
  width: "100%",
  fontVariantNumeric: "tabular-nums",
};

const baseCell: React.CSSProperties = {
  border: "1px solid #e1e3e6",
  padding: "4px 10px",
  whiteSpace: "nowrap",
};

const cornerTh: React.CSSProperties = {
  ...baseCell,
  background: "#f8f9fa",
};

const colTh: React.CSSProperties = {
  ...baseCell,
  background: "#f8f9fa",
  color: "#5f6368",
  fontWeight: 600,
  textAlign: "center",
};

const rowTh: React.CSSProperties = {
  ...baseCell,
  background: "#f8f9fa",
  color: "#202124",
  fontWeight: 600,
  textAlign: "left",
};

const numTd: React.CSSProperties = {
  ...baseCell,
  textAlign: "right",
  color: "#202124",
  fontVariantNumeric: "tabular-nums",
};

const totalTh: React.CSSProperties = {
  ...baseCell,
  background: "#eef2fb",
  color: "#1a73e8",
  fontWeight: 600,
  textAlign: "center",
};

const rowTotalTd: React.CSSProperties = {
  ...baseCell,
  background: "#f4f7fe",
  textAlign: "right",
  fontWeight: 600,
  color: "#1a73e8",
  fontVariantNumeric: "tabular-nums",
};

const colTotalTd: React.CSSProperties = {
  ...baseCell,
  background: "#f4f7fe",
  textAlign: "right",
  fontWeight: 600,
  color: "#1a73e8",
  fontVariantNumeric: "tabular-nums",
};

const footTh: React.CSSProperties = {
  ...baseCell,
  background: "#eef2fb",
  color: "#1a73e8",
  fontWeight: 600,
  textAlign: "left",
};

const grandTd: React.CSSProperties = {
  ...baseCell,
  background: "#e3ecfc",
  textAlign: "right",
  fontWeight: 700,
  color: "#174ea6",
  fontVariantNumeric: "tabular-nums",
};

const emptyStyle: React.CSSProperties = {
  font: FONT,
  color: "#9aa0a6",
  padding: "16px 12px",
  textAlign: "center",
};
