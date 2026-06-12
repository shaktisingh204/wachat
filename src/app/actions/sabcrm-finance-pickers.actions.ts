'use server';

/**
 * SabCRM Finance — shared entity-picker server actions.
 *
 * The doc-surface kit's `EntityPicker`/`AllocationsEditor`/
 * `JournalLinesEditor` fetchers that more than one finance surface
 * needs (the finance-rollout spec §2):
 *
 *   - vendor search + resolve (`/v1/sabcrm/supply/vendors`) for the
 *     purchase-side documents (bills, debit notes, payouts);
 *   - invoice / bill reference search (credit-note & debit-note links,
 *     receipt/payout allocation rows — `openOnly` narrows to documents
 *     that can still receive money);
 *   - quotation / sales-order reference search (SO `quotationRef`,
 *     invoice/proforma "from SO" prefills);
 *   - ledger-account search (chart of accounts) for journal legs and
 *     bill expense lines;
 *   - voucher-book options for the journal-entry form.
 *
 * Party + item + payment-account pickers already live in
 * `sabcrm-finance-invoices.actions.ts` (`searchSabcrmFinanceParties`,
 * `resolveSabcrmFinanceParties`, `searchSabcrmFinanceItems`,
 * `listSabcrmPaymentAccountOptions`) — reuse those, don't duplicate.
 *
 * Every option carries a HUMAN label (doc number / vendor name /
 * account name) — pickers never render raw ObjectIds. Every action runs
 * the same session → project → RBAC `view` → plan gate as its siblings,
 * and engine failures normalise into `{ ok: false, error }`.
 */

import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmFinanceApi,
  sabcrmFinanceAccountsApi,
  sabcrmFinanceBillsApi,
  sabcrmFinanceQuotationsApi,
  sabcrmFinanceSalesOrdersApi,
  sabcrmFinanceVouchersApi,
} from '@/lib/rust-client/sabcrm-finance';
import { sabcrmSupplyVendorsApi } from '@/lib/rust-client/sabcrm-supply';
import type { CrmInvoiceStatus } from '@/lib/rust-client/crm-invoices';
import type { CrmBillStatus } from '@/lib/rust-client/crm-bills';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { DocEntityOption } from '@/app/sabcrm/finance/_components/doc-surface/types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';

interface SessionUser {
  _id: string;
}

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }

  const allowed = await canServer(MODULE_KEY, action, requested);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId: requested } };
}

function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/* ─── Display helpers (server-side; never exported) ───────────── */

/** Picker page size — matches the spec's `limit: 12` convention. */
const PICKER_LIMIT = 12;

function fmtMoney(amount: number, currency: string | undefined): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency ?? 'INR'} ${amount.toFixed(2)}`;
  }
}

function humanStatus(status: string | undefined): string {
  return (status ?? 'draft').replaceAll('_', ' ');
}

/* ─── Vendors (`/v1/sabcrm/supply/vendors`) ───────────────────── */

/**
 * Searches the supply vendors for the purchase-side party picker
 * (bills, debit notes, payouts). `label = displayName ?? name`,
 * `meta = email ?? gstin ?? 'Vendor'`.
 */
export async function searchSabcrmFinanceVendors(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const vendors = await sabcrmSupplyVendorsApi.list(g.ctx.projectId, {
      q: q.trim() || undefined,
      limit: PICKER_LIMIT,
    });
    return {
      ok: true,
      data: vendors
        .filter((v) => v._id)
        .map((v) => ({
          id: String(v._id),
          label: v.displayName || v.name || 'Unnamed vendor',
          meta: v.email || v.gstin || 'Vendor',
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to search vendors.');
  }
}

/**
 * Batch-resolves vendor ids to display options for list-row labels.
 * Unresolvable ids are simply absent — callers render a muted
 * "Unknown vendor", never a raw id.
 */
export async function resolveSabcrmFinanceVendors(
  ids: string[],
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const unique = [...new Set((ids ?? []).filter(Boolean))].slice(0, 200);
  if (unique.length === 0) return { ok: true, data: [] };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const out: DocEntityOption[] = [];
    await Promise.all(
      unique.map(async (id) => {
        try {
          const vendor = await sabcrmSupplyVendorsApi.getById(
            g.ctx.projectId,
            id,
          );
          out.push({
            id,
            label: vendor.displayName || vendor.name || 'Unnamed vendor',
            meta: vendor.email || vendor.gstin || 'Vendor',
          });
        } catch {
          // Vendor gone (or wrong tenant) — leave it unresolved.
        }
      }),
    );
    return { ok: true, data: out };
  } catch (e) {
    return fail(e, 'Failed to resolve vendors.');
  }
}

/* ─── Invoice / bill references (links + allocations) ─────────── */

/** Invoice statuses that can still receive money. */
const OPEN_INVOICE_STATUSES: ReadonlySet<CrmInvoiceStatus> = new Set([
  'sent',
  'partially_paid',
  'overdue',
]);

/**
 * Searches invoices by number for reference pickers (credit-note
 * `linkedInvoiceId`, recurring "invoice to clone") and — with
 * `openOnly` — the payment-receipt AllocationsEditor.
 * `label = invoiceNo`, `meta = "₹balance · status"`.
 */
export async function searchSabcrmFinanceInvoiceRefs(
  q: string,
  opts?: { openOnly?: boolean },
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await sabcrmFinanceApi.listInvoices(g.ctx.projectId, {
      page: 1,
      // openOnly filters client-side (the engine takes one status at a
      // time), so over-fetch to keep a full option list after filtering.
      limit: opts?.openOnly ? 50 : PICKER_LIMIT,
      q: q.trim() || undefined,
    });
    const filtered = opts?.openOnly
      ? docs.filter((d) =>
          OPEN_INVOICE_STATUSES.has((d.status ?? 'draft') as CrmInvoiceStatus),
        )
      : docs;
    return {
      ok: true,
      data: filtered.slice(0, PICKER_LIMIT).map((d) => {
        const total = d.totals?.total ?? 0;
        const balance = d.balance ?? total - (d.amountPaid ?? 0);
        return {
          id: d._id,
          label: d.invoiceNo,
          meta: `${fmtMoney(balance, d.currency)} · ${humanStatus(d.status)}`,
        };
      }),
    };
  } catch (e) {
    return fail(e, 'Failed to search invoices.');
  }
}

/** Bill statuses that can still receive money. */
const OPEN_BILL_STATUSES: ReadonlySet<CrmBillStatus> = new Set([
  'submitted',
  'approved',
  'partially_paid',
  'overdue',
]);

/**
 * Searches bills by number for reference pickers (debit-note
 * `linkedBillId`) and — with `openOnly` — the payout AllocationsEditor.
 * `label = billNo ?? vendorInvoiceNo`, `meta = "₹balance · status"`.
 */
export async function searchSabcrmFinanceBillRefs(
  q: string,
  opts?: { openOnly?: boolean },
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await sabcrmFinanceBillsApi.list(g.ctx.projectId, {
      page: 1,
      limit: opts?.openOnly ? 50 : PICKER_LIMIT,
      q: q.trim() || undefined,
    });
    const filtered = opts?.openOnly
      ? docs.filter((d) =>
          OPEN_BILL_STATUSES.has((d.status ?? 'draft') as CrmBillStatus),
        )
      : docs;
    return {
      ok: true,
      data: filtered.slice(0, PICKER_LIMIT).map((d) => {
        const total = d.totals?.total ?? 0;
        const balance = d.balance ?? total - (d.amountPaid ?? 0);
        return {
          id: d._id,
          label: d.billNo || d.vendorInvoiceNo || 'Unnumbered bill',
          meta: `${fmtMoney(balance, d.currency)} · ${humanStatus(d.status)}`,
        };
      }),
    };
  } catch (e) {
    return fail(e, 'Failed to search bills.');
  }
}

/* ─── Quotation / sales-order references (lineage prefills) ───── */

/**
 * Searches quotations by number for the sales-order `quotationRef`
 * picker. `label = quotationNo`, `meta = "₹total · status"` (totals may
 * be 0 until Rust gap G1 lands — the create handler persists defaults).
 */
export async function searchSabcrmFinanceQuotationRefs(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await sabcrmFinanceQuotationsApi.list(g.ctx.projectId, {
      page: 1,
      limit: PICKER_LIMIT,
      q: q.trim() || undefined,
    });
    return {
      ok: true,
      data: docs.map((d) => ({
        id: d._id,
        label: d.quotationNo,
        meta: `${fmtMoney(d.totals?.total ?? 0, d.currency)} · ${humanStatus(d.status)}`,
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search quotations.');
  }
}

/**
 * Searches sales orders by number for the invoice/proforma "from sales
 * order" pickers. `label = soNo`, `meta = "₹total · status"`.
 */
export async function searchSabcrmFinanceSalesOrderRefs(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await sabcrmFinanceSalesOrdersApi.list(g.ctx.projectId, {
      page: 1,
      limit: PICKER_LIMIT,
      q: q.trim() || undefined,
    });
    return {
      ok: true,
      data: docs.map((d) => ({
        id: d._id,
        label: d.soNo,
        meta: `${fmtMoney(d.totals?.total ?? 0, d.currency)} · ${humanStatus(d.status)}`,
      })),
    };
  } catch (e) {
    return fail(e, 'Failed to search sales orders.');
  }
}

/* ─── Ledger accounts (chart of accounts) ─────────────────────── */

/**
 * Searches the chart of accounts for journal legs (JournalLinesEditor)
 * and bill expense lines. Archived accounts are excluded.
 * `label = name`, `meta = "code · accountType"`.
 */
export async function searchSabcrmFinanceLedgerAccounts(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    // NB: crm-common pagination is 0-indexed — omit `page` for page one
    // (passing 1 would silently skip the first PICKER_LIMIT accounts).
    const res = await sabcrmFinanceAccountsApi.list(g.ctx.projectId, {
      limit: PICKER_LIMIT,
      q: q.trim() || undefined,
    });
    return {
      ok: true,
      data: res.items
        .filter((a) => a._id && a.status !== 'archived')
        .map((a) => ({
          id: a._id,
          label: a.name,
          meta:
            [a.code, a.accountType].filter(Boolean).join(' · ') || undefined,
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to search ledger accounts.');
  }
}

/* ─── Voucher books ───────────────────────────────────────────── */

/**
 * Active voucher books for the journal-entry form's book Select.
 * `label = name`, `meta = type`.
 */
export async function listSabcrmVoucherBookOptions(
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    // NB: crm-common pagination is 0-indexed — omit `page` for page one.
    const res = await sabcrmFinanceVouchersApi.list(g.ctx.projectId, {
      limit: 50,
    });
    return {
      ok: true,
      data: res.items
        .filter(
          (b) => b._id && b.isActive !== false && b.status !== 'archived',
        )
        .map((b) => ({
          id: b._id,
          label: b.name,
          meta: b.type,
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to list voucher books.');
  }
}
