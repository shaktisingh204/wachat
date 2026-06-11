/**
 * Per-axis sizing + coordinate math for the grid, sized to handle 1,000,000 rows / 16,384 columns
 * without materializing an entry per line.
 *
 * Model: a uniform `defaultSize` plus a sparse map of per-index overrides (a resized or hidden line;
 * hidden = size 0). Overrides are kept in a sorted array with a running prefix-sum of their *deltas*
 * from default, so `offsetOf` / `indexAt` are O(log k) in the number of overrides (typically a
 * handful) rather than O(index). That is enough for the MVP; the documented scale upgrade is a
 * Fenwick tree over fixed-size chunks, which keeps the same interface.
 */

interface OverrideEntry {
  index: number;
  size: number;
}

export class AxisIndex {
  readonly count: number;
  readonly defaultSize: number;

  /** Overrides sorted ascending by index. */
  private overrides: OverrideEntry[] = [];
  /** prefixDelta[k] = sum of (override[j].size - defaultSize) for j < k. Length = overrides.length+1. */
  private prefixDelta: number[] = [0];

  constructor(count: number, defaultSize: number) {
    this.count = count;
    this.defaultSize = defaultSize;
  }

  /** Pixel size of a single line. */
  sizeOf(index: number): number {
    const o = this.findOverride(index);
    return o >= 0 ? this.overrides[o].size : this.defaultSize;
  }

  /** Set an explicit size (px). `0` hides the line. */
  setSize(index: number, size: number): void {
    const at = this.findOverride(index);
    if (at >= 0) {
      this.overrides[at].size = size;
    } else {
      const insert = this.lowerBound(index);
      this.overrides.splice(insert, 0, { index, size });
    }
    this.rebuildPrefix();
  }

  /** Remove an override, reverting the line to `defaultSize`. */
  resetSize(index: number): void {
    const at = this.findOverride(index);
    if (at >= 0) {
      this.overrides.splice(at, 1);
      this.rebuildPrefix();
    }
  }

  isHidden(index: number): boolean {
    return this.sizeOf(index) === 0;
  }

  /** Pixel offset of the start edge of `index` (offsetOf(0) === 0). Accepts index up to `count`. */
  offsetOf(index: number): number {
    const clamped = Math.max(0, Math.min(index, this.count));
    // Sum of overrides strictly below `clamped`.
    const k = this.lowerBound(clamped); // number of overrides with .index < clamped
    return clamped * this.defaultSize + this.prefixDelta[k];
  }

  /** Total pixel extent of the whole axis. */
  totalExtent(): number {
    return this.offsetOf(this.count);
  }

  /**
   * The index whose span contains pixel `offset`, plus that line's start offset. Clamps into
   * `[0, count-1]`. Skips zero-height (hidden) lines naturally since they occupy no pixels.
   */
  indexAt(offset: number): { index: number; start: number } {
    if (offset <= 0) return { index: 0, start: 0 };
    const total = this.totalExtent();
    if (offset >= total) {
      const last = Math.max(0, this.count - 1);
      return { index: last, start: this.offsetOf(last) };
    }
    // Binary search for the greatest index with offsetOf(index) <= offset.
    let lo = 0;
    let hi = this.count - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.offsetOf(mid) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { index: lo, start: this.offsetOf(lo) };
  }

  /**
   * Inclusive range of indices whose spans intersect the window `[scroll, scroll + viewportPx)`.
   * Used by the renderer to paint only visible lines.
   */
  rangeForViewport(scroll: number, viewportPx: number): { start: number; end: number } {
    const start = this.indexAt(scroll).index;
    const end = this.indexAt(scroll + viewportPx).index;
    return { start, end };
  }

  // --- internals ---

  /** Index into `overrides` for an exact match on line `index`, or -1. */
  private findOverride(index: number): number {
    let lo = 0;
    let hi = this.overrides.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = this.overrides[mid].index;
      if (v === index) return mid;
      if (v < index) lo = mid + 1;
      else hi = mid - 1;
    }
    return -1;
  }

  /** Number of overrides with `.index < index` (insertion point). */
  private lowerBound(index: number): number {
    let lo = 0;
    let hi = this.overrides.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.overrides[mid].index < index) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  private rebuildPrefix(): void {
    this.prefixDelta = new Array(this.overrides.length + 1);
    this.prefixDelta[0] = 0;
    for (let k = 0; k < this.overrides.length; k++) {
      this.prefixDelta[k + 1] = this.prefixDelta[k] + (this.overrides[k].size - this.defaultSize);
    }
  }
}
