import 'server-only';

/**
 * Convert-with-prefill — shared helper for `?fromKind=&fromId=` flows.
 *
 * Several CRM `new` pages support a "convert from X" entry path that
 * passes `?fromKind=…&fromId=…` in the URL. Each page used to inline
 * its own parent-fetch + null-guard + try/catch + projection block; this
 * module collapses the fetch + permission + 404 handling into one call:
 *
 *     const parent = await getCrmEntityForPrefill(fromKind, fromId);
 *
 * The caller still owns the projection from parent doc → form `initial`
 * shape (see the per-page mappers below the dispatch table). That keeps
 * the helper agnostic of every downstream form's exact prop shape and
 * avoids a leaky "one true seed" abstraction.
 *
 * Behaviour:
 *   - Returns `null` if either param is missing/blank or the parent
 *     entity can't be resolved.
 *   - Each underlying `getX` action enforces its own RBAC + tenant
 *     filter; we don't add another permission check here.
 *   - Errors (404, RBAC denied, transient Rust hiccup) are swallowed so
 *     a stale id can never 500 the new-page route — the form just opens
 *     in blank-create mode, exactly like the no-query case.
 *
 * Supported `fromKind` values (all enforced by the dispatch table):
 *   - `'invoice'`        → `getInvoice` → `CrmInvoiceDoc`
 *   - `'quotation'`      → `getQuotation` → `CrmQuotationDoc`
 *     (alias: `'quote'`)
 *   - `'salesOrder'`     → `getSalesOrder` → `CrmSalesOrderDoc`
 *   - `'bill'`           → `getBill` → `CrmBillDoc`
 *   - `'purchaseOrder'`  → `getPurchaseOrder` → `CrmPurchaseOrderDoc`
 *   - `'bom'`            → `getCrmBomById` → `WithId<CrmBomDoc>`
 *   - `'deal'`           → `getDeal` → `CrmDealDoc`
 *   - `'lead'`           → `getLead` → `CrmLeadDoc`
 *   - `'rfq'`            → `getRfq` → `CrmRfqDoc`
 *
 * Anything else (or an empty string) resolves to `null`.
 */

import { getInvoice } from '@/app/actions/crm/invoices.actions';
import { getQuotation } from '@/app/actions/crm/quotations.actions';
import { getSalesOrder } from '@/app/actions/crm/sales-orders.actions';
import { getBill } from '@/app/actions/crm/bills.actions';
import { getPurchaseOrder } from '@/app/actions/crm/purchase-orders.actions';
import { getDeal } from '@/app/actions/crm/deals.actions';
import { getLead } from '@/app/actions/crm/leads.actions';
import { getRfq } from '@/app/actions/crm/rfqs.actions';
import { getCrmBomById } from '@/app/actions/crm-bom.actions';

/** Canonical `fromKind` values recognised by the helper. */
export type PrefillSource =
  | 'invoice'
  | 'quote'
  | 'quotation'
  | 'salesOrder'
  | 'bill'
  | 'purchaseOrder'
  | 'bom'
  | 'deal'
  | 'lead'
  | 'rfq';

/** Dispatch table — each entry is `(id) => Promise<doc | null>`. */
const RESOLVERS: Record<PrefillSource, (id: string) => Promise<unknown | null>> = {
  invoice: async (id) => {
    try {
      const { invoice } = await getInvoice(id);
      return invoice ?? null;
    } catch {
      return null;
    }
  },
  quote: async (id) => {
    try {
      const { quotation } = await getQuotation(id);
      return quotation ?? null;
    } catch {
      return null;
    }
  },
  quotation: async (id) => {
    try {
      const { quotation } = await getQuotation(id);
      return quotation ?? null;
    } catch {
      return null;
    }
  },
  salesOrder: async (id) => {
    try {
      const { order } = await getSalesOrder(id);
      return order ?? null;
    } catch {
      return null;
    }
  },
  bill: async (id) => {
    try {
      const { bill } = await getBill(id);
      return bill ?? null;
    } catch {
      return null;
    }
  },
  purchaseOrder: async (id) => {
    try {
      const { order } = await getPurchaseOrder(id);
      return order ?? null;
    } catch {
      return null;
    }
  },
  bom: async (id) => {
    try {
      return (await getCrmBomById(id)) ?? null;
    } catch {
      return null;
    }
  },
  deal: async (id) => {
    try {
      const { deal } = await getDeal(id);
      return deal ?? null;
    } catch {
      return null;
    }
  },
  lead: async (id) => {
    try {
      const { lead } = await getLead(id);
      return lead ?? null;
    } catch {
      return null;
    }
  },
  rfq: async (id) => {
    try {
      const { rfq } = await getRfq(id);
      return rfq ?? null;
    } catch {
      return null;
    }
  },
};

function normaliseKind(raw: string | undefined): PrefillSource | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return (trimmed in RESOLVERS ? (trimmed as PrefillSource) : null);
}

/**
 * Resolve the parent entity referenced by `?fromKind=&fromId=` for use
 * as a prefill source. Returns `null` for any of:
 *   - empty/missing params
 *   - unrecognised `fromKind`
 *   - parent not found / RBAC denied / fetch error
 *
 * Callers narrow the `unknown` return to the parent's doc type at the
 * use site (see the per-page mappers in each new-page route).
 */
export async function getCrmEntityForPrefill<T = unknown>(
  fromKind: string | undefined,
  fromId: string | undefined,
): Promise<T | null> {
  const kind = normaliseKind(fromKind);
  if (!kind) return null;

  const id = (fromId ?? '').trim();
  if (!id) return null;

  const resolver = RESOLVERS[kind];
  const doc = await resolver(id);
  return (doc as T | null) ?? null;
}
