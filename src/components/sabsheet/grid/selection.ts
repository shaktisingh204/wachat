/**
 * Selection model + A1-notation helpers for the grid.
 *
 * Row/column indices are **1-based** to match the engine (`Command` / IronCalc `Area`): A1 is
 * `{ row: 1, col: 1 }`. The grid never converts between bases at the engine boundary.
 */

export interface CellAddr {
  row: number;
  col: number;
}

/** A normalized rectangular range (top ≤ bottom, left ≤ right), 1-based inclusive. */
export interface RangeBox {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface SelectionState {
  /** The cell the keyboard acts from (the bold one). */
  active: CellAddr;
  /** The fixed corner while extending a selection. */
  anchor: CellAddr;
}

export interface AxisBounds {
  maxRow: number;
  maxCol: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));

export function singleCell(row: number, col: number): SelectionState {
  return { active: { row, col }, anchor: { row, col } };
}

/** The normalized box spanned by anchor→active. */
export function selectionBox(s: SelectionState): RangeBox {
  return {
    top: Math.min(s.anchor.row, s.active.row),
    bottom: Math.max(s.anchor.row, s.active.row),
    left: Math.min(s.anchor.col, s.active.col),
    right: Math.max(s.anchor.col, s.active.col),
  };
}

export function isSingleCell(s: SelectionState): boolean {
  return s.active.row === s.anchor.row && s.active.col === s.anchor.col;
}

/** Move the active cell by a delta, collapsing any range (plain arrow keys). */
export function move(s: SelectionState, dr: number, dc: number, b: AxisBounds): SelectionState {
  const row = clamp(s.active.row + dr, 1, b.maxRow);
  const col = clamp(s.active.col + dc, 1, b.maxCol);
  return singleCell(row, col);
}

/** Extend the selection by moving the active corner, keeping the anchor (Shift+arrows). */
export function extend(s: SelectionState, dr: number, dc: number, b: AxisBounds): SelectionState {
  return {
    anchor: s.anchor,
    active: {
      row: clamp(s.active.row + dr, 1, b.maxRow),
      col: clamp(s.active.col + dc, 1, b.maxCol),
    },
  };
}

/** Set the active cell directly (a click), collapsing the selection. */
export function selectCell(row: number, col: number, b: AxisBounds): SelectionState {
  return singleCell(clamp(row, 1, b.maxRow), clamp(col, 1, b.maxCol));
}

/** Extend selection to a cell (Shift+click / drag), keeping the anchor. */
export function extendTo(s: SelectionState, row: number, col: number, b: AxisBounds): SelectionState {
  return {
    anchor: s.anchor,
    active: { row: clamp(row, 1, b.maxRow), col: clamp(col, 1, b.maxCol) },
  };
}

// --- A1 notation ---

/** 1 → "A", 26 → "Z", 27 → "AA", 16384 → "XFD". */
export function colToLetters(col: number): string {
  let n = col;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** "A" → 1, "AA" → 27. Case-insensitive; returns 0 for empty/invalid. */
export function lettersToCol(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    const code = ch.charCodeAt(0);
    if (code < 65 || code > 90) return 0;
    n = n * 26 + (code - 64);
  }
  return n;
}

/** `{row:1,col:1}` → "A1". */
export function cellToA1(addr: CellAddr): string {
  return `${colToLetters(addr.col)}${addr.row}`;
}

/** "B7" → `{row:7,col:2}`; null if not a plain cell ref. */
export function a1ToCell(a1: string): CellAddr | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(a1.trim());
  if (!m) return null;
  const col = lettersToCol(m[1]);
  const row = parseInt(m[2], 10);
  if (col < 1 || row < 1) return null;
  return { row, col };
}

/** Parse a name-box entry ("B7" or "A1:C9") into a selection, or null if not a valid ref. */
export function parseRef(ref: string): SelectionState | null {
  const parts = ref.trim().split(":");
  if (parts.length === 1) {
    const c = a1ToCell(parts[0]);
    return c ? singleCell(c.row, c.col) : null;
  }
  if (parts.length === 2) {
    const a = a1ToCell(parts[0]);
    const b = a1ToCell(parts[1]);
    if (!a || !b) return null;
    return { anchor: a, active: b };
  }
  return null;
}

/** Name-box / status label for a selection ("B7" or "A1:C9"). */
export function selectionLabel(s: SelectionState): string {
  if (isSingleCell(s)) return cellToA1(s.active);
  const box = selectionBox(s);
  return `${colToLetters(box.left)}${box.top}:${colToLetters(box.right)}${box.bottom}`;
}

/** Cell count in a selection box (for the status bar). */
export function selectionCount(s: SelectionState): number {
  const b = selectionBox(s);
  return (b.bottom - b.top + 1) * (b.right - b.left + 1);
}
