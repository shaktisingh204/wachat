/**
 * Convert-with-prefill helper for CRM_REBUILD_PLAN §5.8.
 *
 * Every chain transition (Lead→Deal, Quote→Invoice, PO→GRN, etc.) opens
 * the target form pre-filled with parent data via two conventions:
 *
 *   - The target route accepts `?fromKind=<parentKind>&fromId=<parentId>`
 *     so the server component can hydrate the parent doc and seed the form.
 *   - Any number of extra prefill fields (customer, currency, branch, etc.)
 *     are passed as additional query params for the form to consume.
 *
 * This helper produces the target URL — keeping the 13+ chain transitions
 * to a single shared implementation.
 */
import type { LineageKind } from '@/lib/definitions';

export interface ConvertWithPrefillInput {
  /** Parent doc's kind (e.g. "lead", "deal", "quotation"). */
  fromKind: LineageKind | string;
  /** Parent doc's _id (24-char hex). */
  fromId: string;
  /** Optional extra prefill fields. Falsy values are dropped. */
  extras?: Record<string, string | number | boolean | undefined | null>;
}

/**
 * Build the query string portion of a chain-transition URL — `?fromKind=…&fromId=…&…`.
 *
 * Use this when you already have the route path and just need to append
 * the prefill params; otherwise prefer `buildConvertUrl()`.
 */
export function buildConvertQuery(input: ConvertWithPrefillInput): string {
  const qs = new URLSearchParams();
  qs.set('fromKind', String(input.fromKind));
  qs.set('fromId', input.fromId);
  if (input.extras) {
    for (const [key, raw] of Object.entries(input.extras)) {
      if (raw === undefined || raw === null) continue;
      const v = String(raw).trim();
      if (v.length === 0) continue;
      qs.set(key, v);
    }
  }
  return `?${qs.toString()}`;
}

/**
 * Map of "convert to" canonical routes per target kind. Reuse this so
 * every chain transition lands on the same path no matter which page
 * surfaces the action.
 *
 * Extend as new chain destinations ship.
 */
export const CONVERT_TARGET_ROUTES: Record<string, string> = {
  deal: '/dashboard/crm/sales-crm/deals/new',
  quotation: '/dashboard/crm/sales/quotations/new',
  proforma: '/dashboard/crm/sales/proforma/new',
  salesOrder: '/dashboard/crm/sales/orders/new',
  invoice: '/dashboard/crm/sales/invoices/new',
  deliveryChallan: '/dashboard/crm/sales/delivery/new',
  receipt: '/dashboard/crm/sales/receipts/new',
  creditNote: '/dashboard/crm/sales/credit-notes/new',
  contract: '/dashboard/crm/sales/contracts/new',
  purchaseOrder: '/dashboard/crm/purchases/orders/new',
  grn: '/dashboard/crm/purchases/grn/new',
  bill: '/dashboard/crm/purchases/expenses/new',
  payout: '/dashboard/crm/purchases/payouts/new',
};

export interface BuildConvertUrlInput extends ConvertWithPrefillInput {
  /** Target entity kind. Looked up in CONVERT_TARGET_ROUTES. */
  toKind: keyof typeof CONVERT_TARGET_ROUTES | string;
  /** Override the route if the target is non-canonical. */
  routeOverride?: string;
}

/**
 * Build the full URL for a chain-transition CTA — `<targetRoute>?fromKind=…&fromId=…&…`.
 *
 * Throws if `toKind` is not a registered target and no `routeOverride` is given.
 */
export function buildConvertUrl(input: BuildConvertUrlInput): string {
  const route =
    input.routeOverride ??
    CONVERT_TARGET_ROUTES[input.toKind as string] ??
    undefined;
  if (!route) {
    throw new Error(
      `buildConvertUrl: unknown convert target "${input.toKind}". Pass routeOverride or register the kind in CONVERT_TARGET_ROUTES.`,
    );
  }
  const query = buildConvertQuery({
    fromKind: input.fromKind,
    fromId: input.fromId,
    extras: input.extras,
  });
  return `${route}${query}`;
}

/**
 * Server-side: read `searchParams` for `fromKind` + `fromId` and return a
 * narrow object the page can pass to `getXxxById()` to hydrate prefill data.
 *
 * Returns `null` when either param is missing or `fromId` is not a 24-char
 * hex string. Callers fall back to "blank form" in that case.
 */
export function readConvertParams(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
): { fromKind: string; fromId: string } | null {
  const get = (key: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) {
      return searchParams.get(key) ?? undefined;
    }
    const raw = searchParams[key];
    if (Array.isArray(raw)) return raw[0];
    return raw;
  };
  const fromKind = get('fromKind')?.trim();
  const fromId = get('fromId')?.trim();
  if (!fromKind || !fromId) return null;
  if (!/^[0-9a-fA-F]{24}$/.test(fromId)) return null;
  return { fromKind, fromId };
}
