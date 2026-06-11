/**
 * Pure conditional-formatting evaluation: given viewport cells + rules, return a new cell list with
 * `fill`/`color` overridden on matching cells. Applied in the grid's refresh path before paint.
 */
import type { CellView } from "../commands/ops.ts";
import { parseNumeric } from "../../../components/sabsheet/grid/aggregate.ts";
import type { CFRule, CFRange } from "./types.ts";

function inRange(row: number, col: number, r: CFRange): boolean {
  return row >= r.top && row <= r.bottom && col >= r.left && col <= r.right;
}

function matchesBoolean(rule: CFRule, text: string): boolean {
  const n = parseNumeric(text);
  const a = rule.value1 !== undefined ? parseNumeric(rule.value1) : null;
  const b = rule.value2 !== undefined ? parseNumeric(rule.value2) : null;
  switch (rule.operator) {
    case "greaterThan":
      return n !== null && a !== null && n > a;
    case "lessThan":
      return n !== null && a !== null && n < a;
    case "between":
      return n !== null && a !== null && b !== null && n >= Math.min(a, b) && n <= Math.max(a, b);
    case "equalTo":
      return n !== null && a !== null ? n === a : text === (rule.value1 ?? "");
    case "notEqualTo":
      return n !== null && a !== null ? n !== a : text !== (rule.value1 ?? "");
    case "textContains":
      return !!rule.value1 && text.toLowerCase().includes(rule.value1.toLowerCase());
    default:
      return false;
  }
}

/** Linear-interpolate two CSS hex colors (#rrggbb) by t∈[0,1]. */
export function lerpColor(lo: string, hi: string, t: number): string {
  const parse = (h: string): [number, number, number] => {
    const s = h.replace("#", "").padEnd(6, "0");
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  };
  const [r1, g1, b1] = parse(lo);
  const [r2, g2, b2] = parse(hi);
  const tt = Math.max(0, Math.min(1, t));
  const m = (x: number, y: number) => Math.round(x + (y - x) * tt);
  const hx = (v: number) => v.toString(16).padStart(2, "0");
  return `#${hx(m(r1, r2))}${hx(m(g1, g2))}${hx(m(b1, b2))}`;
}

/** Returns a NEW cell array with CF formats applied. Input cells are not mutated. */
export function applyConditionalFormats(cells: CellView[], rules: CFRule[]): CellView[] {
  if (rules.length === 0) return cells;

  // Precompute numeric min/max per color-scale rule over the supplied cells.
  const scaleStats = new Map<string, { min: number; max: number }>();
  for (const rule of rules) {
    if (rule.operator !== "colorScale2") continue;
    let min = Infinity;
    let max = -Infinity;
    for (const c of cells) {
      if (!inRange(c.row, c.col, rule.range)) continue;
      const n = parseNumeric(c.text);
      if (n === null) continue;
      if (n < min) min = n;
      if (n > max) max = n;
    }
    if (min !== Infinity) scaleStats.set(rule.id, { min, max });
  }

  return cells.map((cell) => {
    let next = cell;
    // Later rules win (Excel evaluates by priority; here last-defined overrides).
    for (const rule of rules) {
      if (!inRange(cell.row, cell.col, rule.range)) continue;
      if (rule.operator === "colorScale2") {
        const stats = scaleStats.get(rule.id);
        const n = parseNumeric(cell.text);
        if (!stats || n === null || !rule.minColor || !rule.maxColor) continue;
        const t = stats.max === stats.min ? 0.5 : (n - stats.min) / (stats.max - stats.min);
        next = { ...next, fill: lerpColor(rule.minColor, rule.maxColor, t) };
      } else if (matchesBoolean(rule, cell.text)) {
        next = { ...next, fill: rule.format?.fill ?? next.fill, color: rule.format?.color ?? next.color };
      }
    }
    return next;
  });
}
