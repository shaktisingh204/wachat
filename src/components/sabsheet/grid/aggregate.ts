/**
 * Selection aggregates for the status bar — Excel's Sum / Average / Count / Min / Max readout for the
 * current selection. Works from the displayed cell text (the engine already formatted it); a number
 * parser tolerates thousands separators, a leading currency symbol, percent, and parentheses-negatives.
 */
import type { CellView } from "../../../lib/sabsheet/commands/ops.ts";

export interface Aggregates {
  /** Non-empty cells in the selection. */
  count: number;
  /** Cells whose value parsed as a number. */
  numericCount: number;
  sum: number;
  average: number;
  min: number;
  max: number;
}

/** Parse a displayed cell value to a number, or null if it isn't numeric. */
export function parseNumeric(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const negative = /^\(.*\)$/.test(t);
  const percent = t.endsWith("%");
  // Strip currency symbols, thousands separators, parens, percent, and spaces.
  const cleaned = t.replace(/[(),%\s]/g, "").replace(/^[^\d.\-+]+/, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "+") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  let v = n;
  if (percent) v /= 100;
  if (negative) v = -Math.abs(v);
  return v;
}

/** Compute the status-bar aggregates over a set of (non-empty) cells. */
export function computeAggregates(cells: CellView[]): Aggregates {
  let count = 0;
  let numericCount = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const c of cells) {
    if (!c.text) continue;
    count++;
    const n = parseNumeric(c.text);
    if (n === null) continue;
    numericCount++;
    sum += n;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  return {
    count,
    numericCount,
    sum,
    average: numericCount > 0 ? sum / numericCount : 0,
    min: numericCount > 0 ? min : 0,
    max: numericCount > 0 ? max : 0,
  };
}

/** Compact status-bar label (only shown when ≥2 cells are selected). */
export function aggregateLabel(a: Aggregates): string | null {
  if (a.count < 2) return null;
  const parts = [`Count: ${a.count}`];
  if (a.numericCount > 0) {
    const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
    parts.unshift(`Sum: ${fmt(a.sum)}`, `Avg: ${fmt(a.average)}`);
  }
  return parts.join("   ");
}
