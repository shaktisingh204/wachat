/**
 * Imperative, DPR-aware canvas renderer for one sheet viewport.
 *
 * Two stacked canvases: a content layer (headers, gridlines, cell text) and an overlay layer
 * (selection fill, active-cell border, header highlight). React owns neither — it constructs a
 * `GridRenderer` once and drives it with setters + `draw()`, so painting never goes through
 * reconciliation. Cell addresses are 1-based (engine space); the row/col `AxisIndex` is 0-based, so
 * column `c` maps to axis index `c - 1`.
 */
import { AxisIndex } from "./axis-index.ts";
import { selectionBox, type SelectionState } from "./selection.ts";
import type { CellView } from "../../../lib/sabsheet/commands/ops.ts";

export interface GridTheme {
  rowHeaderWidth: number;
  colHeaderHeight: number;
  gridLine: string;
  headerBg: string;
  headerText: string;
  headerActiveBg: string;
  cellText: string;
  selectionFill: string;
  selectionBorder: string;
  font: string;
  headerFont: string;
}

export const DEFAULT_THEME: GridTheme = {
  rowHeaderWidth: 48,
  colHeaderHeight: 24,
  gridLine: "#e1e3e6",
  headerBg: "#f8f9fa",
  headerText: "#5f6368",
  headerActiveBg: "#d2e3fc",
  cellText: "#202124",
  selectionFill: "rgba(26,115,232,0.10)",
  selectionBorder: "#1a73e8",
  font: "13px -apple-system, system-ui, sans-serif",
  headerFont: "12px -apple-system, system-ui, sans-serif",
};

function colLetters(col: number): string {
  let n = col;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export class GridRenderer {
  private content: CanvasRenderingContext2D;
  private overlay: CanvasRenderingContext2D;
  private theme: GridTheme;
  rows: AxisIndex;
  cols: AxisIndex;

  private cssW = 0;
  private cssH = 0;
  private dpr = 1;

  scrollX = 0;
  scrollY = 0;
  private frozenRows = 0;
  private frozenCols = 0;
  private cells = new Map<string, CellView>();
  private selection: SelectionState | null = null;

  constructor(
    contentCanvas: HTMLCanvasElement,
    overlayCanvas: HTMLCanvasElement,
    rows: AxisIndex,
    cols: AxisIndex,
    theme: GridTheme = DEFAULT_THEME,
  ) {
    const c = contentCanvas.getContext("2d");
    const o = overlayCanvas.getContext("2d");
    if (!c || !o) throw new Error("2d context unavailable");
    this.content = c;
    this.overlay = o;
    this.rows = rows;
    this.cols = cols;
    this.theme = theme;
  }

  /** Size both canvases to a CSS box, scaling the backing store for the device pixel ratio. */
  resize(cssW: number, cssH: number, dpr: number): void {
    this.cssW = cssW;
    this.cssH = cssH;
    this.dpr = dpr;
    for (const ctx of [this.content, this.overlay]) {
      const canvas = ctx.canvas;
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  setScroll(x: number, y: number): void {
    this.scrollX = Math.max(0, x);
    this.scrollY = Math.max(0, y);
  }

  /** CSS pixel width of the viewport (content area = this minus the row header). */
  get viewportWidth(): number {
    return this.cssW;
  }

  /** CSS pixel height of the viewport (content area = this minus the column header). */
  get viewportHeight(): number {
    return this.cssH;
  }

  setCells(views: CellView[]): void {
    this.cells.clear();
    for (const v of views) this.cells.set(`${v.row},${v.col}`, v);
  }

  setSelection(s: SelectionState | null): void {
    this.selection = s;
  }

  /** Set frozen pane counts (rows above / columns left that stay pinned while scrolling). */
  setFrozen(rows: number, cols: number): void {
    this.frozenRows = Math.max(0, rows | 0);
    this.frozenCols = Math.max(0, cols | 0);
  }

  private get frozenW(): number {
    return this.cols.offsetOf(this.frozenCols);
  }
  private get frozenH(): number {
    return this.rows.offsetOf(this.frozenRows);
  }

  /**
   * Pixel rect of a cell. Frozen rows/columns are pinned (they ignore the matching scroll offset), so
   * with no freeze (`frozenRows === frozenCols === 0`) this is identical to the unfrozen formula.
   */
  cellRect(row: number, col: number): { x: number; y: number; w: number; h: number } {
    const fc = col <= this.frozenCols;
    const fr = row <= this.frozenRows;
    const x = this.theme.rowHeaderWidth + this.cols.offsetOf(col - 1) - (fc ? 0 : this.scrollX);
    const y = this.theme.colHeaderHeight + this.rows.offsetOf(row - 1) - (fr ? 0 : this.scrollY);
    return { x, y, w: this.cols.sizeOf(col - 1), h: this.rows.sizeOf(row - 1) };
  }

  private fillHandle: { x: number; y: number; size: number } | null = null;

  /** True when a pointer position (CSS coords) is over the selection's fill handle. */
  isOnFillHandle(px: number, py: number): boolean {
    const h = this.fillHandle;
    if (!h) return false;
    return px >= h.x - 2 && px <= h.x + h.size + 2 && py >= h.y - 2 && py <= h.y + h.size + 2;
  }

  /** Hit-test a pointer to a header: a column header, a row header, the corner, or null (in grid). */
  headerAt(px: number, py: number): { kind: "col" | "row" | "corner"; index: number } | null {
    const t = this.theme;
    const inColStrip = py < t.colHeaderHeight;
    const inRowStrip = px < t.rowHeaderWidth;
    if (inColStrip && inRowStrip) return { kind: "corner", index: 0 };
    if (inColStrip) {
      const dx = px - t.rowHeaderWidth;
      const col = dx < this.frozenW ? this.cols.indexAt(dx).index : this.cols.indexAt(dx + this.scrollX).index;
      return { kind: "col", index: col + 1 };
    }
    if (inRowStrip) {
      const dy = py - t.colHeaderHeight;
      const row = dy < this.frozenH ? this.rows.indexAt(dy).index : this.rows.indexAt(dy + this.scrollY).index;
      return { kind: "row", index: row + 1 };
    }
    return null;
  }

  /** Hit-test a pointer position (CSS coords) to a 1-based cell, or null if over a header. */
  cellAt(px: number, py: number): { row: number; col: number } | null {
    if (px < this.theme.rowHeaderWidth || py < this.theme.colHeaderHeight) return null;
    const dx = px - this.theme.rowHeaderWidth;
    const dy = py - this.theme.colHeaderHeight;
    const col = (dx < this.frozenW ? this.cols.indexAt(dx) : this.cols.indexAt(dx + this.scrollX)).index + 1;
    const row = (dy < this.frozenH ? this.rows.indexAt(dy) : this.rows.indexAt(dy + this.scrollY)).index + 1;
    return { row, col };
  }

  /** Visible 1-based cell range for the *scrollable* (main) pane. Frozen bands are added in draw. */
  visibleRange(): { rowStart: number; rowEnd: number; colStart: number; colEnd: number } {
    const contentW = this.cssW - this.theme.rowHeaderWidth;
    const contentH = this.cssH - this.theme.colHeaderHeight;
    const r = this.rows.rangeForViewport(this.frozenH + this.scrollY, contentH - this.frozenH);
    const c = this.cols.rangeForViewport(this.frozenW + this.scrollX, contentW - this.frozenW);
    return {
      rowStart: Math.max(this.frozenRows, r.start) + 1,
      rowEnd: r.end + 1,
      colStart: Math.max(this.frozenCols, c.start) + 1,
      colEnd: c.end + 1,
    };
  }

  /** Repaint both layers. */
  draw(): void {
    if (this.frozenRows === 0 && this.frozenCols === 0) this.drawContent();
    else this.drawFrozen();
    this.drawOverlay();
  }

  /** Paint cells (gridlines then text, two passes) for a 1-based range. Caller sets any clip. */
  private paintCells(rowStart: number, rowEnd: number, colStart: number, colEnd: number): void {
    const ctx = this.content;
    const t = this.theme;
    // Pass 1 — gridlines (one path, stroked once; kept separate from text so the clip below can't
    // clobber the accumulated path).
    ctx.strokeStyle = t.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        const { x, y, w, h } = this.cellRect(row, col);
        ctx.moveTo(x + w + 0.5, y);
        ctx.lineTo(x + w + 0.5, y + h);
        ctx.moveTo(x, y + h + 0.5);
        ctx.lineTo(x + w, y + h + 0.5);
      }
    }
    ctx.stroke();
    // Pass 2 — text.
    ctx.font = t.font;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = t.cellText;
    for (let row = rowStart; row <= rowEnd; row++) {
      for (let col = colStart; col <= colEnd; col++) {
        const cell = this.cells.get(`${row},${col}`);
        if (!cell || !cell.text) continue;
        const { x, y, w, h } = this.cellRect(row, col);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x + 1, y, w - 3, h);
        ctx.clip();
        ctx.fillText(cell.text, x + 4, y + h / 2);
        ctx.restore();
      }
    }
  }

  private clipPaint(cx: number, cy: number, cw: number, ch: number, rs: number, re: number, cs: number, ce: number): void {
    if (cw <= 0 || ch <= 0) return;
    const ctx = this.content;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, cw, ch);
    ctx.clip();
    this.paintCells(rs, re, cs, ce);
    ctx.restore();
  }

  private drawContent(): void {
    const ctx = this.content;
    const t = this.theme;
    const { rowStart, rowEnd, colStart, colEnd } = this.visibleRange();
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(t.rowHeaderWidth, t.colHeaderHeight, this.cssW, this.cssH);
    this.paintCells(rowStart, rowEnd, colStart, colEnd);
    this.fillHeaderStrips();
    this.paintColHeaders(colStart, colEnd, t.rowHeaderWidth, this.cssW);
    this.paintRowHeaders(rowStart, rowEnd, t.colHeaderHeight, this.cssH);
    this.finishHeaders();
  }

  private drawFrozen(): void {
    const ctx = this.content;
    const t = this.theme;
    const fw = this.frozenW;
    const fh = this.frozenH;
    const px0 = t.rowHeaderWidth + fw;
    const py0 = t.colHeaderHeight + fh;
    const { rowStart, rowEnd, colStart, colEnd } = this.visibleRange();

    ctx.clearRect(0, 0, this.cssW, this.cssH);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(t.rowHeaderWidth, t.colHeaderHeight, this.cssW, this.cssH);

    // Four panes, each clipped so a scrolling pane never paints over a frozen one.
    this.clipPaint(px0, py0, this.cssW - px0, this.cssH - py0, rowStart, rowEnd, colStart, colEnd);
    if (this.frozenRows > 0)
      this.clipPaint(px0, t.colHeaderHeight, this.cssW - px0, fh, 1, this.frozenRows, colStart, colEnd);
    if (this.frozenCols > 0)
      this.clipPaint(t.rowHeaderWidth, py0, fw, this.cssH - py0, rowStart, rowEnd, 1, this.frozenCols);
    if (this.frozenRows > 0 && this.frozenCols > 0)
      this.clipPaint(t.rowHeaderWidth, t.colHeaderHeight, fw, fh, 1, this.frozenRows, 1, this.frozenCols);

    this.fillHeaderStrips();
    if (this.frozenCols > 0) this.paintColHeaders(1, this.frozenCols, t.rowHeaderWidth, px0);
    this.paintColHeaders(colStart, colEnd, px0, this.cssW);
    if (this.frozenRows > 0) this.paintRowHeaders(1, this.frozenRows, t.colHeaderHeight, py0);
    this.paintRowHeaders(rowStart, rowEnd, py0, this.cssH);
    this.finishHeaders();

    // Freeze divider lines (slightly darker than gridlines).
    ctx.strokeStyle = "#bdc1c6";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (this.frozenRows > 0) {
      ctx.moveTo(t.rowHeaderWidth, py0 + 0.5);
      ctx.lineTo(this.cssW, py0 + 0.5);
    }
    if (this.frozenCols > 0) {
      ctx.moveTo(px0 + 0.5, t.colHeaderHeight);
      ctx.lineTo(px0 + 0.5, this.cssH);
    }
    ctx.stroke();
  }

  private fillHeaderStrips(): void {
    const ctx = this.content;
    const t = this.theme;
    ctx.fillStyle = t.headerBg;
    ctx.fillRect(0, 0, this.cssW, t.colHeaderHeight);
    ctx.fillRect(0, 0, t.rowHeaderWidth, this.cssH);
  }

  private paintColHeaders(cs: number, ce: number, clipX0: number, clipX1: number): void {
    const ctx = this.content;
    const t = this.theme;
    const box = this.selection ? selectionBox(this.selection) : null;
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipX0, 0, Math.max(0, clipX1 - clipX0), t.colHeaderHeight);
    ctx.clip();
    ctx.font = t.headerFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let col = cs; col <= ce; col++) {
      const { x, w } = this.cellRect(1, col);
      if (box && col >= box.left && col <= box.right) {
        ctx.fillStyle = t.headerActiveBg;
        ctx.fillRect(x, 0, w, t.colHeaderHeight);
      }
      ctx.fillStyle = t.headerText;
      ctx.fillText(colLetters(col), x + w / 2, t.colHeaderHeight / 2);
    }
    ctx.restore();
  }

  private paintRowHeaders(rs: number, re: number, clipY0: number, clipY1: number): void {
    const ctx = this.content;
    const t = this.theme;
    const box = this.selection ? selectionBox(this.selection) : null;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, clipY0, t.rowHeaderWidth, Math.max(0, clipY1 - clipY0));
    ctx.clip();
    ctx.font = t.headerFont;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let row = rs; row <= re; row++) {
      const { y, h } = this.cellRect(row, 1);
      if (box && row >= box.top && row <= box.bottom) {
        ctx.fillStyle = t.headerActiveBg;
        ctx.fillRect(0, y, t.rowHeaderWidth, h);
      }
      ctx.fillStyle = t.headerText;
      ctx.fillText(String(row), t.rowHeaderWidth / 2, y + h / 2);
    }
    ctx.restore();
  }

  private finishHeaders(): void {
    const ctx = this.content;
    const t = this.theme;
    ctx.fillStyle = t.headerBg;
    ctx.fillRect(0, 0, t.rowHeaderWidth, t.colHeaderHeight);
    ctx.strokeStyle = t.gridLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(t.rowHeaderWidth + 0.5, 0);
    ctx.lineTo(t.rowHeaderWidth + 0.5, this.cssH);
    ctx.moveTo(0, t.colHeaderHeight + 0.5);
    ctx.lineTo(this.cssW, t.colHeaderHeight + 0.5);
    ctx.stroke();
    ctx.textAlign = "left";
  }

  private drawOverlay(): void {
    const ctx = this.overlay;
    const t = this.theme;
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    if (!this.selection) return;

    const box = selectionBox(this.selection);
    const tl = this.cellRect(box.top, box.left);
    const br = this.cellRect(box.bottom, box.right);
    const x = tl.x;
    const y = tl.y;
    const w = br.x + br.w - tl.x;
    const h = br.y + br.h - tl.y;

    // Clip the selection paint to the content area so it doesn't bleed over headers.
    ctx.save();
    ctx.beginPath();
    ctx.rect(t.rowHeaderWidth, t.colHeaderHeight, this.cssW - t.rowHeaderWidth, this.cssH - t.colHeaderHeight);
    ctx.clip();

    ctx.fillStyle = t.selectionFill;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = t.selectionBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    // Active cell gets a crisper inner border.
    const a = this.cellRect(this.selection.active.row, this.selection.active.col);
    ctx.lineWidth = 2;
    ctx.strokeStyle = t.selectionBorder;
    ctx.strokeRect(a.x + 1, a.y + 1, a.w - 2, a.h - 2);

    // Fill handle: a small square at the selection's bottom-right corner.
    const size = 6;
    const hx = x + w - size / 2 - 1;
    const hy = y + h - size / 2 - 1;
    this.fillHandle = { x: hx, y: hy, size };
    ctx.fillStyle = t.selectionBorder;
    ctx.fillRect(hx, hy, size, size);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(hx + 0.5, hy + 0.5, size - 1, size - 1);

    ctx.restore();
  }
}
