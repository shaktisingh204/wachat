/**
 * SabCRM Finance — document line-item math (pure + isomorphic).
 *
 * The SINGLE source of truth for how a finance document's lines roll up
 * into totals. The doc-surface kit (`src/app/sabcrm/finance/_components/
 * doc-surface/line-items-editor.tsx`) uses it for the live footer, and
 * the invoice server actions re-run it as the authoritative recompute —
 * client-supplied totals are never trusted, and the two sides can never
 * drift because they share this module.
 *
 * Money convention (mirrors `crm_sales_types::line_item`):
 *   - per-line discount % is applied to `qty × rate` → the line's
 *     taxable base;
 *   - per-line tax % is applied to the taxable base;
 *   - `line.total` = taxable + tax;
 *   - `totals.subTotal` = Σ taxable (pre-tax, post-line-discount);
 *   - `totals.total` = subTotal + Σ tax.
 *
 * All outputs are rounded to 2 decimals (half-up via EPSILON nudge) so
 * floating-point dust never reaches the wire or the UI.
 */

/** One editable row, before computation. */
export interface DocLineInput {
  /** Catalog item id (24-char hex) — optional; free-text rows allowed. */
  itemId?: string;
  description?: string;
  hsnSac?: string;
  qty: number;
  unit?: string;
  rate: number;
  /** Per-line discount %, 0–100. */
  discountPct?: number;
  /** Per-line tax %, ≥ 0 (CGST+SGST or IGST combined). */
  taxRatePct?: number;
}

/** A computed row: the input plus its derived money fields. */
export interface DocLineComputed extends DocLineInput {
  /** `qty × rate` before discount. */
  gross: number;
  /** Discount amount (`gross × discountPct / 100`). */
  discount: number;
  /** Taxable base (`gross − discount`). */
  taxable: number;
  /** Tax amount (`taxable × taxRatePct / 100`). */
  tax: number;
  /** `taxable + tax` — the wire `LineItem.total`. */
  total: number;
}

/** Document-level rollup. */
export interface DocTotalsComputed {
  lines: DocLineComputed[];
  /** Σ taxable — pre-tax, post-line-discount. */
  subTotal: number;
  /** Σ per-line discount (informational). */
  discountTotal: number;
  /** Σ per-line tax. */
  taxTotal: number;
  /** subTotal + taxTotal. */
  total: number;
}

/** Round to 2 decimals, guarding against `-0` and FP dust. */
export function round2(n: number): number {
  const r = Math.round((n + Number.EPSILON) * 100) / 100;
  return Object.is(r, -0) ? 0 : r;
}

/** Coerce any user-typed numeric-ish value into a safe finite number ≥ 0. */
export function safeNum(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Compute one line's money fields. */
export function computeDocLine(line: DocLineInput): DocLineComputed {
  const qty = safeNum(line.qty);
  const rate = safeNum(line.rate);
  const discountPct = Math.min(safeNum(line.discountPct), 100);
  const taxRatePct = safeNum(line.taxRatePct);

  const gross = qty * rate;
  const discount = (gross * discountPct) / 100;
  const taxable = gross - discount;
  const tax = (taxable * taxRatePct) / 100;

  return {
    ...line,
    qty,
    rate,
    discountPct: line.discountPct === undefined ? undefined : discountPct,
    taxRatePct: line.taxRatePct === undefined ? undefined : taxRatePct,
    gross: round2(gross),
    discount: round2(discount),
    taxable: round2(taxable),
    tax: round2(tax),
    total: round2(taxable + tax),
  };
}

/** Roll a set of lines up into document totals. */
export function computeDocTotals(lines: DocLineInput[]): DocTotalsComputed {
  const computed = lines.map(computeDocLine);
  const subTotal = round2(computed.reduce((s, l) => s + l.taxable, 0));
  const discountTotal = round2(computed.reduce((s, l) => s + l.discount, 0));
  const taxTotal = round2(computed.reduce((s, l) => s + l.tax, 0));
  return {
    lines: computed,
    subTotal,
    discountTotal,
    taxTotal,
    total: round2(subTotal + taxTotal),
  };
}

/**
 * True when a line is materially blank: no item, no text and no money.
 * `qty` is deliberately NOT consulted — the editor mints fresh rows
 * with `qty: 1` for UX, and a pristine `1 × 0` row carries no value, so
 * it must still count as blank (both for the form's "add at least one
 * line item" guard and for the server's wire filter).
 */
export function isBlankDocLine(line: DocLineInput): boolean {
  return (
    !line.itemId &&
    !(line.description ?? '').trim() &&
    safeNum(line.rate) === 0
  );
}
