/**
 * SabCRM Finance — quotation → CPQ-pricing line mapper (PURE, client-safe).
 *
 * Bridges the doc-surface form's `DocLineDraft[]` to the CPQ pricing engine's
 * `QuoteLineInput[]` (the arg shape `computeQuotePricingTw` / the pure
 * `priceWaterfall` accept). It is the SINGLE place the two shapes meet, so the
 * quotation form's live preview and the server recompute can never drift on
 * how a row is interpreted.
 *
 * Kept I/O-free + free of `'use client'` so it is unit-testable under
 * `tsx --test` AND importable from both the client form and any server caller.
 *
 * `DocLineDraft extends DocLineInput` and `QuoteLineInput extends DocLineInput`
 * (both add only display sugar — `rowId`/`itemLabel`), so the conversion is
 * mostly a passthrough; the value-add here is (a) dropping blank rows via the
 * shared `isBlankDocLine` guard so an empty trailing row never prices, and
 * (b) carrying the picked-item label across for the waterfall trace.
 */

import { isBlankDocLine } from '@/lib/sabcrm/finance-doc-math';
import type { DocLineDraft } from '../_components/doc-surface';
import type {
  DiscountApprovalDecision,
  PricedTotals,
  PricingRules,
  QuoteLineInput,
} from '@/lib/sabcrm/pricing';

/**
 * Client-safe twin of `QuoteForPricing` (which lives in the `'server-only'`
 * `pricing.server.ts` and so can't be imported here). Structurally identical to
 * the action's arg, so a value of this type is accepted by `computeQuotePricingTw`
 * / `requestDiscountApprovalTw` without a cast.
 */
export interface QuoteForPricing {
  lines: QuoteLineInput[];
  priceBookId?: string;
  rules?: PricingRules;
}

/**
 * Client-safe twin of the action's `QuotePricingResult` (also defined in the
 * `'server-only'` `pricing.server.ts`). Identical shape, composed from the pure
 * `pricing.ts` base types, so the client preview can type the action's `data`
 * without importing server-only code.
 */
export interface QuotePricingResult extends PricedTotals {
  currency: string;
  priceBookId: string | null;
  approval: DiscountApprovalDecision;
}

/** One draft row → a CPQ pricing line (label preserved for the trace). */
export function docLineToQuoteLine(line: DocLineDraft): QuoteLineInput {
  return {
    itemId: line.itemId || undefined,
    description: line.description,
    hsnSac: line.hsnSac,
    qty: line.qty,
    unit: line.unit,
    rate: line.rate,
    discountPct: line.discountPct,
    taxRatePct: line.taxRatePct,
    itemLabel: line.itemLabel ?? undefined,
  };
}

/**
 * Map the form's draft lines to the `QuoteForPricing.lines` shape, dropping
 * blank rows (the trailing empty editor row, removed rows, etc.) so the priced
 * total reflects only real items — exactly the rows the submit handler persists
 * (`values.lines.filter((l) => !isBlankDocLine(l))`).
 */
export function docLinesToQuoteLines(lines: DocLineDraft[]): QuoteLineInput[] {
  return (lines ?? []).filter((l) => !isBlankDocLine(l)).map(docLineToQuoteLine);
}

/** Build the full {@link QuoteForPricing} arg from the form's draft lines. */
export function buildQuoteForPricing(lines: DocLineDraft[]): QuoteForPricing {
  return { lines: docLinesToQuoteLines(lines) };
}

/** True when there is at least one priceable (non-blank) row. */
export function hasPriceableLines(lines: DocLineDraft[]): boolean {
  return (lines ?? []).some((l) => !isBlankDocLine(l));
}
