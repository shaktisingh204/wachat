/**
 * Quote builder — versioned with redlining and expiration support.
 *
 * Quotes are immutable once `sent` — making changes creates a new version
 * with `previousVersionId` linking back to the original.
 */
import type {
  Quote,
  QuoteLineItem,
  QuoteRedline,
  QuoteStatus,
} from './types';

function randomId(prefix: string): string {
  const rnd = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}${rnd}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Compute totals over a list of line items. Discount is applied per-line, then
 * tax is applied to the discounted unit total.
 */
export function computeQuoteTotals(items: QuoteLineItem[]): {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
} {
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;

  for (const item of items) {
    const lineSubtotal = item.quantity * item.unitPrice;
    const lineDiscount = lineSubtotal * ((item.discountPct ?? 0) / 100);
    const discounted = lineSubtotal - lineDiscount;
    const lineTax = discounted * ((item.taxPct ?? 0) / 100);

    subtotal += lineSubtotal;
    discountTotal += lineDiscount;
    taxTotal += lineTax;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return {
    subtotal: round2(subtotal),
    discountTotal: round2(discountTotal),
    taxTotal: round2(taxTotal),
    total: round2(subtotal - discountTotal + taxTotal),
  };
}

export interface CreateQuoteInput {
  customerId: string;
  dealId?: string;
  number?: string;
  currency: string;
  lineItems: Omit<QuoteLineItem, 'id'>[];
  notes?: string;
  validUntil?: string;
  expiresAt?: string;
}

export function createQuote(input: CreateQuoteInput): Quote {
  const lineItems: QuoteLineItem[] = input.lineItems.map(li => ({
    id: randomId('qli'),
    ...li,
  }));
  const totals = computeQuoteTotals(lineItems);
  return {
    id: randomId('quote'),
    dealId: input.dealId,
    number: input.number ?? `Q-${Date.now().toString(36).toUpperCase()}`,
    version: 1,
    customerId: input.customerId,
    status: 'draft',
    currency: input.currency,
    lineItems,
    notes: input.notes,
    validUntil: input.validUntil,
    expiresAt: input.expiresAt,
    redlines: [],
    createdAt: nowIso(),
    ...totals,
  };
}

export interface ReviseQuoteOptions {
  authorId: string;
  lineItems?: QuoteLineItem[];
  notes?: string;
  validUntil?: string;
  expiresAt?: string;
}

/**
 * Revise a quote — produces a *new* quote (`version + 1`) with
 * `previousVersionId` pointing at the prior id. The prior quote is *not*
 * mutated by this function; callers persist both.
 */
export function reviseQuote(prior: Quote, opts: ReviseQuoteOptions): Quote {
  const lineItems = opts.lineItems
    ? opts.lineItems.map(li => ({ ...li, id: li.id || randomId('qli') }))
    : prior.lineItems;
  const totals = computeQuoteTotals(lineItems);
  const redlines = diffQuote(prior, { ...prior, lineItems, notes: opts.notes ?? prior.notes }, opts.authorId);
  return {
    ...prior,
    id: randomId('quote'),
    version: prior.version + 1,
    previousVersionId: prior.id,
    status: 'draft',
    lineItems,
    notes: opts.notes ?? prior.notes,
    validUntil: opts.validUntil ?? prior.validUntil,
    expiresAt: opts.expiresAt ?? prior.expiresAt,
    redlines: [...(prior.redlines ?? []), ...redlines],
    updatedAt: nowIso(),
    ...totals,
  };
}

/**
 * Compute redline entries between two quotes. Used internally by `reviseQuote`
 * but exposed for ad-hoc diffing in UIs.
 */
export function diffQuote(
  before: Quote,
  after: Quote,
  authorId: string,
): QuoteRedline[] {
  const at = nowIso();
  const redlines: QuoteRedline[] = [];

  if (before.notes !== after.notes) {
    redlines.push({
      authorId,
      fieldPath: 'notes',
      before: before.notes,
      after: after.notes,
      at,
    });
  }

  // Compare line items by id; track adds, removes, modifies.
  const beforeMap = new Map(before.lineItems.map(li => [li.id, li]));
  const afterMap = new Map(after.lineItems.map(li => [li.id, li]));

  for (const [id, b] of beforeMap) {
    const a = afterMap.get(id);
    if (!a) {
      redlines.push({
        authorId,
        fieldPath: `lineItems.${id}`,
        before: b,
        after: null,
        at,
        comment: 'removed',
      });
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      redlines.push({
        authorId,
        fieldPath: `lineItems.${id}`,
        before: b,
        after: a,
        at,
      });
    }
  }
  for (const [id, a] of afterMap) {
    if (!beforeMap.has(id)) {
      redlines.push({
        authorId,
        fieldPath: `lineItems.${id}`,
        before: null,
        after: a,
        at,
        comment: 'added',
      });
    }
  }

  return redlines;
}

export function transitionQuote(q: Quote, status: QuoteStatus): Quote {
  return { ...q, status, updatedAt: nowIso() };
}

/**
 * Returns true if the quote has an `expiresAt` in the past.
 */
export function isQuoteExpired(q: Quote, now: Date = new Date()): boolean {
  if (!q.expiresAt) return false;
  return new Date(q.expiresAt).getTime() <= now.getTime();
}

/**
 * Apply expiration — flips `status` to `expired` if the quote's expiration
 * has passed and it is still in a non-terminal state.
 */
export function applyExpiration(q: Quote, now: Date = new Date()): Quote {
  if (!isQuoteExpired(q, now)) return q;
  if (q.status === 'accepted' || q.status === 'declined' || q.status === 'expired') return q;
  return { ...q, status: 'expired', updatedAt: nowIso() };
}
