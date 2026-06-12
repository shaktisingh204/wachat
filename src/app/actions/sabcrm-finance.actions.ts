'use server';

/**
 * SabCRM Finance — invoice server actions.
 *
 * Thin, gated wrappers over the project-scoped re-mount of the legacy
 * `crm-invoices` Rust engine ({@link sabcrmFinanceApi} in
 * `@/lib/rust-client/sabcrm-finance`, base `/v1/sabcrm/finance/invoices`).
 * This is the proving vertical for exposing legacy `/v1/crm/*` crates as
 * SabCRM suite surfaces: same crate, same `crm_invoices` collection, but
 * tenant-scoped by `projectId` instead of `userId`.
 *
 * Every action follows the SAME pipeline as the sibling
 * `sabcrm-views.actions.ts`:
 *
 *   1. resolve the cached session (fail closed if unauthenticated)
 *   2. resolve the active project id (explicit param or the user's first),
 *      rejecting a client-supplied projectId the caller is not a member of
 *   3. RBAC check via `canServer('sabcrm', action, projectId)`
 *   4. plan check via {@link sabcrmPlanFeature}
 *   5. call the Rust engine and return a typed {@link ActionResult}
 *
 * The Rust engine may be DOWN at dev time. Every `RustApiError` / thrown
 * value is normalised into `{ ok: false, error }` so the UI degrades
 * gracefully.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmFinanceApi,
  sabcrmFinanceQuotationsApi,
  sabcrmFinanceSalesOrdersApi,
  sabcrmFinanceCreditNotesApi,
  sabcrmFinanceDebitNotesApi,
  sabcrmFinancePaymentReceiptsApi,
  sabcrmFinanceBillsApi,
  sabcrmFinanceProformaInvoicesApi,
  sabcrmFinancePaymentAccountsApi,
  sabcrmFinanceBankTransactionsApi,
  sabcrmFinanceRecurringInvoicesApi,
  sabcrmFinanceExpensesApi,
  sabcrmFinancePayoutsApi,
  sabcrmFinanceVouchersApi,
  sabcrmFinancePettyCashApi,
  sabcrmFinanceBudgetsApi,
  sabcrmFinanceReconciliationApi,
  sabcrmFinanceAccountsApi,
  sabcrmFinanceAccountGroupsApi,
  sabcrmFinanceJournalEntriesApi,
  sabcrmFinanceTdsApi,
} from '@/lib/rust-client/sabcrm-finance';
import type {
  SabcrmInvoiceDoc,
  SabcrmInvoiceListParams,
  SabcrmInvoiceUpdateInput,
  SabcrmQuotationDoc,
  SabcrmQuotationListParams,
  SabcrmSalesOrderDoc,
  SabcrmSalesOrderListParams,
  SabcrmSalesOrderCreateInput,
  SabcrmSalesOrderUpdateInput,
  SabcrmCreditNoteDoc,
  SabcrmCreditNoteListParams,
  SabcrmCreditNoteUpdateInput,
  SabcrmDebitNoteDoc,
  SabcrmDebitNoteListParams,
  SabcrmDebitNoteUpdateInput,
  SabcrmPaymentReceiptDoc,
  SabcrmPaymentReceiptListParams,
  SabcrmPaymentReceiptUpdateInput,
  SabcrmBillDoc,
  SabcrmBillListParams,
  SabcrmProformaInvoiceDoc,
  SabcrmProformaListParams,
  SabcrmProformaUpdateInput,
  SabcrmPaymentAccountDoc,
  SabcrmPaymentAccountListParams,
  SabcrmPaymentAccountUpdateInput,
  SabcrmBankTransactionDoc,
  SabcrmBankTransactionListParams,
  SabcrmBankTransactionCreateInput,
  SabcrmRecurringInvoiceDoc,
  SabcrmRecurringInvoiceListParams,
  SabcrmRecurringInvoiceCreateInput,
  SabcrmRecurringInvoiceUpdateInput,
  SabcrmExpenseClaimDoc,
  SabcrmExpenseClaimListParams,
  SabcrmExpenseClaimUpdateInput,
  SabcrmPayoutDoc,
  SabcrmPayoutListParams,
  SabcrmPayoutCreateInput,
  SabcrmPayoutUpdateInput,
  SabcrmVoucherBookDoc,
  SabcrmVoucherBookListParams,
  SabcrmVoucherBookCreateInput,
  SabcrmPettyCashFloatDoc,
  SabcrmPettyCashListParams,
  SabcrmBudgetDoc,
  SabcrmBudgetListParams,
  SabcrmReconciliationDoc,
  SabcrmReconciliationListParams,
  SabcrmReconciliationCreateInput,
  SabcrmChartOfAccountDoc,
  SabcrmChartOfAccountListParams,
  SabcrmChartOfAccountCreateInput,
  SabcrmAccountGroupDoc,
  SabcrmAccountGroupListParams,
  SabcrmJournalEntryDoc,
  SabcrmJournalEntryListParams,
  SabcrmJournalEntryCreateInput,
  SabcrmTdsRecordDoc,
  SabcrmTdsListParams,
  SabcrmTdsCreateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmInvoiceFormInput,
  SabcrmInvoicePatchInput,
  SabcrmFinanceDocFormInput,
  SabcrmFinanceDocPatchInput,
  SabcrmPaymentAccountFormInput,
  SabcrmPaymentAccountPatchInput,
  SabcrmBankTransactionFormInput,
  SabcrmRecurringInvoiceFormInput,
  SabcrmVoucherBookFormInput,
  SabcrmPettyCashFormInput,
  SabcrmBudgetFormInput,
  SabcrmReconciliationFormInput,
  SabcrmChartOfAccountFormInput,
  SabcrmJournalEntryFormInput,
  SabcrmTdsFormInput,
} from './sabcrm-finance.actions.types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** RBAC module key for SabCRM (see `src/lib/sabcrm/rbac-keys.ts`). */
const MODULE_KEY = 'sabcrm';

/** Path revalidated after mutations so the Finance UI re-fetches. */
const FINANCE_INVOICES_PATH = '/sabcrm/finance/invoices';

/** Minimal shape of the session user we narrow to (mirrors sibling actions). */
interface SessionUser {
  _id: string;
}

// ---------------------------------------------------------------------------
// Gate
// ---------------------------------------------------------------------------

interface GateContext {
  userId: string;
  projectId: string;
}

type GateResult =
  | { ok: true; ctx: GateContext }
  | { ok: false; error: string };

/**
 * Runs the full session → project → RBAC → plan pipeline. Mirrors the `gate`
 * helper in `sabcrm-views.actions.ts` verbatim, including the cross-tenant
 * defense against a client-supplied `explicitProjectId`.
 */
async function gate(
  action: PermissionAction,
  explicitProjectId?: string,
): Promise<GateResult> {
  // 1. session
  const session = await getCachedSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const userId = (session.user as SessionUser)._id;
  if (!userId) return { ok: false, error: 'Not authenticated.' };

  // 2. active project — only accept a projectId that belongs to THIS user.
  const myProjects = await getCachedProjects();
  const myProjectIds = new Set(myProjects.map((p) => String(p._id)));
  const firstProjectId = myProjects[0]?._id;
  const requested =
    explicitProjectId ?? (firstProjectId ? String(firstProjectId) : undefined);
  if (!requested) return { ok: false, error: 'No active project.' };
  if (!myProjectIds.has(requested)) {
    return { ok: false, error: 'Permission denied.' };
  }
  const projectId = requested;

  // 3. RBAC
  const allowed = await canServer(MODULE_KEY, action, projectId);
  if (!allowed) return { ok: false, error: 'Permission denied.' };

  // 4. plan
  if (!sabcrmPlanFeature.defaultEnabled) {
    return { ok: false, error: 'Your plan does not include SabCRM.' };
  }

  return { ok: true, ctx: { userId, projectId } };
}

/** Normalises a thrown value (incl. {@link RustApiError}) into an error result. */
function fail<T>(e: unknown, fallback: string): ActionResult<T> {
  if (e instanceof RustApiError) {
    return { ok: false, error: e.message || fallback };
  }
  return { ok: false, error: e instanceof Error ? e.message : fallback };
}

/** Coerce a `YYYY-MM-DD` / ISO date string into a full RFC3339 instant. */
function toIso(raw: string): string | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ---------------------------------------------------------------------------
// Invoice CRUD — via the Rust engine (project-scoped mount)
// ---------------------------------------------------------------------------

/** Lists the project's invoices through the Rust engine. */
export async function listSabcrmInvoices(
  params?: SabcrmInvoiceListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmInvoiceDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmFinanceApi.listInvoices(g.ctx.projectId, params);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list invoices.');
  }
}

/** Fetches a single invoice (404 ⇒ `{ ok: false }`). */
export async function getSabcrmInvoice(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmInvoiceDoc>> {
  if (!id) return { ok: false, error: 'Invoice id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmFinanceApi.getInvoice(g.ctx.projectId, id);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load invoice.');
  }
}

/**
 * Creates an invoice from the small "New invoice" dialog payload. The
 * form's `amount` is expanded into a single line item + totals; a chosen
 * non-`draft` status is applied with a follow-up PATCH (the Rust create
 * path always starts documents in `draft`).
 */
export async function createSabcrmInvoice(
  input: SabcrmInvoiceFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmInvoiceDoc>> {
  if (!input?.invoiceNo?.trim()) {
    return { ok: false, error: 'An invoice number is required.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid invoice date is required.' };
  const dueIso = input.dueDate ? toIso(input.dueDate) : dateIso;
  if (!dueIso) return { ok: false, error: 'The due date is invalid.' };
  // A REAL picked party is required — placeholder ids are never minted
  // for invoices (they'd render as meaningless ObjectIds forever).
  if (!input.clientId || !ObjectId.isValid(input.clientId)) {
    return { ok: false, error: 'Pick a customer for this invoice.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceApi.createInvoice(g.ctx.projectId, {
      invoiceNo: input.invoiceNo.trim(),
      date: dateIso,
      dueDate: dueIso,
      clientId: input.clientId,
      currency: input.currency.trim().toUpperCase(),
      items: [{ qty: 1, rate: amount, total: amount }],
      totals: { subTotal: amount, total: amount },
    });

    // The engine always creates in `draft`; apply a chosen status after.
    let result = created;
    if (input.status && input.status !== 'draft') {
      result = await sabcrmFinanceApi.updateInvoice(
        g.ctx.projectId,
        created._id,
        { status: input.status },
      );
    }

    revalidatePath(FINANCE_INVOICES_PATH);
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to create invoice.');
  }
}

/** Partial-updates an invoice (number, dates, amount, status, …). */
export async function updateSabcrmInvoice(
  id: string,
  patch: SabcrmInvoicePatchInput,
  projectId?: string,
): Promise<ActionResult<SabcrmInvoiceDoc>> {
  if (!id) return { ok: false, error: 'Invoice id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmInvoiceUpdateInput = {};
  if (patch.invoiceNo !== undefined) wire.invoiceNo = patch.invoiceNo.trim();
  if (patch.currency !== undefined) {
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (patch.status !== undefined) wire.status = patch.status;
  if (patch.date !== undefined) {
    const iso = toIso(patch.date);
    if (!iso) return { ok: false, error: 'The invoice date is invalid.' };
    wire.date = iso;
  }
  if (patch.dueDate !== undefined) {
    const iso = toIso(patch.dueDate);
    if (!iso) return { ok: false, error: 'The due date is invalid.' };
    wire.dueDate = iso;
  }
  if (patch.amount !== undefined) {
    const amount = Number(patch.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return { ok: false, error: 'Amount must be a non-negative number.' };
    }
    wire.items = [{ qty: 1, rate: amount, total: amount }];
    wire.totals = { subTotal: amount, total: amount };
  }
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmFinanceApi.updateInvoice(g.ctx.projectId, id, wire);
    revalidatePath(FINANCE_INVOICES_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update invoice.');
  }
}

/** Hard-deletes an invoice by id. */
export async function deleteSabcrmInvoice(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Invoice id is required.' };

  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmFinanceApi.deleteInvoice(g.ctx.projectId, id);
    revalidatePath(FINANCE_INVOICES_PATH);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete invoice.');
  }
}

// ---------------------------------------------------------------------------
// Finance tranche 1 — remaining document crates, same gate recipe
// ---------------------------------------------------------------------------
//
// Each group below mirrors the invoice actions verbatim: gate → Rust call →
// normalised ActionResult, with `revalidatePath` on the entity's page after
// every mutation. Create dialogs are deliberately small (number, amount,
// currency, date, status) — the actions expand them into the entity's full
// Rust create DTO, minting placeholder party ids where the dialog has no
// picker yet (same proving-vertical convention as invoices).

/* ─── Quotations ──────────────────────────────────────────────── */

const FINANCE_QUOTATIONS_PATH = '/sabcrm/finance/quotations';

/** Adds `days` to an ISO instant (used for quotation validity windows). */
function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** Lists the project's quotations through the Rust engine. */
export async function listSabcrmQuotations(
  params?: SabcrmQuotationListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmQuotationDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceQuotationsApi.list(g.ctx.projectId, params);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list quotations.');
  }
}

/** Fetches a single quotation (404 ⇒ `{ ok: false }`). */
export async function getSabcrmQuotation(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmQuotationDoc>> {
  if (!id) return { ok: false, error: 'Quotation id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceQuotationsApi.getById(g.ctx.projectId, id);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to load quotation.');
  }
}

/**
 * Creates a quotation from the small "New quotation" dialog payload.
 * `amount` expands into a single line item; `validUntil` defaults to
 * `date + 30 days`. Non-`draft` statuses are applied with a follow-up
 * PATCH (the Rust create path always starts documents in `draft`).
 */
export async function createSabcrmQuotation(
  input: SabcrmFinanceDocFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmQuotationDoc>> {
  if (!input?.number?.trim()) {
    return { ok: false, error: 'A quotation number is required.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid date is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceQuotationsApi.create(g.ctx.projectId, {
      quotationNo: input.number.trim(),
      date: dateIso,
      validUntil: addDaysIso(dateIso, 30),
      clientId:
        input.partyId && ObjectId.isValid(input.partyId)
          ? input.partyId
          : new ObjectId().toHexString(),
      currency: input.currency.trim().toUpperCase(),
      items: [{ qty: 1, rate: amount, total: amount }],
    });
    let result = created;
    if (input.status && input.status !== 'draft') {
      result = await sabcrmFinanceQuotationsApi.update(
        g.ctx.projectId,
        created._id,
        { status: input.status },
      );
    }
    revalidatePath(FINANCE_QUOTATIONS_PATH);
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to create quotation.');
  }
}

/** Status-level patch (workflow transitions). */
export async function updateSabcrmQuotation(
  id: string,
  patch: SabcrmFinanceDocPatchInput,
  projectId?: string,
): Promise<ActionResult<SabcrmQuotationDoc>> {
  if (!id) return { ok: false, error: 'Quotation id is required.' };
  if (!patch?.status) return { ok: false, error: 'Nothing to update.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceQuotationsApi.update(g.ctx.projectId, id, {
      status: patch.status,
    });
    revalidatePath(FINANCE_QUOTATIONS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update quotation.');
  }
}

/** Hard-deletes a quotation by id. */
export async function deleteSabcrmQuotation(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Quotation id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceQuotationsApi.delete(g.ctx.projectId, id);
    revalidatePath(FINANCE_QUOTATIONS_PATH);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete quotation.');
  }
}

/* ─── Sales orders ────────────────────────────────────────────── */

const FINANCE_SALES_ORDERS_PATH = '/sabcrm/finance/sales-orders';

const SALES_ORDER_STATUSES = new Set([
  'open',
  'partial',
  'fulfilled',
  'closed',
  'cancelled',
]);

/** Lists the project's sales orders through the Rust engine. */
export async function listSabcrmSalesOrders(
  params?: SabcrmSalesOrderListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmSalesOrderDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceSalesOrdersApi.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list sales orders.');
  }
}

/**
 * Creates a sales order from the dialog payload. Unlike the other doc
 * crates, the Rust create DTO accepts `status` directly — no follow-up
 * PATCH needed.
 */
export async function createSabcrmSalesOrder(
  input: SabcrmFinanceDocFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmSalesOrderDoc>> {
  if (!input?.number?.trim()) {
    return { ok: false, error: 'A sales order number is required.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid date is required.' };
  if (input.status && !SALES_ORDER_STATUSES.has(input.status)) {
    return { ok: false, error: 'Invalid sales order status.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const data = await sabcrmFinanceSalesOrdersApi.create(g.ctx.projectId, {
      soNo: input.number.trim(),
      date: dateIso,
      clientId:
        input.partyId && ObjectId.isValid(input.partyId)
          ? input.partyId
          : new ObjectId().toHexString(),
      currency: input.currency.trim().toUpperCase(),
      items: [{ qty: 1, rate: amount, total: amount }],
      totals: { subTotal: amount, total: amount },
      status: input.status as SabcrmSalesOrderCreateInput['status'],
    });
    revalidatePath(FINANCE_SALES_ORDERS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to create sales order.');
  }
}

/** Status-level patch (workflow transitions). */
export async function updateSabcrmSalesOrder(
  id: string,
  patch: SabcrmFinanceDocPatchInput,
  projectId?: string,
): Promise<ActionResult<SabcrmSalesOrderDoc>> {
  if (!id) return { ok: false, error: 'Sales order id is required.' };
  if (!patch?.status) return { ok: false, error: 'Nothing to update.' };
  if (!SALES_ORDER_STATUSES.has(patch.status)) {
    return { ok: false, error: 'Invalid sales order status.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceSalesOrdersApi.update(g.ctx.projectId, id, {
      status: patch.status as SabcrmSalesOrderUpdateInput['status'],
    });
    revalidatePath(FINANCE_SALES_ORDERS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update sales order.');
  }
}

/** Hard-deletes a sales order by id. */
export async function deleteSabcrmSalesOrder(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Sales order id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceSalesOrdersApi.delete(g.ctx.projectId, id);
    revalidatePath(FINANCE_SALES_ORDERS_PATH);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete sales order.');
  }
}

/* ─── Credit notes ────────────────────────────────────────────── */

const FINANCE_CREDIT_NOTES_PATH = '/sabcrm/finance/credit-notes';

/** Lists the project's credit notes through the Rust engine. */
export async function listSabcrmCreditNotes(
  params?: SabcrmCreditNoteListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmCreditNoteDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceCreditNotesApi.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list credit notes.');
  }
}

/**
 * Creates a credit note from the dialog payload. `reason` defaults to
 * `other` and `refundMode` to `credit` (the dialog doesn't ask yet);
 * non-`draft` statuses are applied with a follow-up PATCH.
 */
export async function createSabcrmCreditNote(
  input: SabcrmFinanceDocFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmCreditNoteDoc>> {
  if (!input?.number?.trim()) {
    return { ok: false, error: 'A credit note number is required.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid date is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceCreditNotesApi.create(g.ctx.projectId, {
      cnNo: input.number.trim(),
      date: dateIso,
      clientId:
        input.partyId && ObjectId.isValid(input.partyId)
          ? input.partyId
          : new ObjectId().toHexString(),
      reason: 'other',
      currency: input.currency.trim().toUpperCase(),
      items: [{ qty: 1, rate: amount, total: amount }],
      totals: { subTotal: amount, total: amount },
      refundMode: 'credit',
    });
    let result = created;
    if (input.status && input.status !== 'draft') {
      result = await sabcrmFinanceCreditNotesApi.update(
        g.ctx.projectId,
        created._id,
        { status: input.status as SabcrmCreditNoteUpdateInput['status'] },
      );
    }
    revalidatePath(FINANCE_CREDIT_NOTES_PATH);
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to create credit note.');
  }
}

/** Status-level patch (workflow transitions). */
export async function updateSabcrmCreditNote(
  id: string,
  patch: SabcrmFinanceDocPatchInput,
  projectId?: string,
): Promise<ActionResult<SabcrmCreditNoteDoc>> {
  if (!id) return { ok: false, error: 'Credit note id is required.' };
  if (!patch?.status) return { ok: false, error: 'Nothing to update.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceCreditNotesApi.update(g.ctx.projectId, id, {
      status: patch.status as SabcrmCreditNoteUpdateInput['status'],
    });
    revalidatePath(FINANCE_CREDIT_NOTES_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update credit note.');
  }
}

/** Hard-deletes a credit note by id. */
export async function deleteSabcrmCreditNote(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Credit note id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceCreditNotesApi.delete(g.ctx.projectId, id);
    revalidatePath(FINANCE_CREDIT_NOTES_PATH);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete credit note.');
  }
}

/* ─── Debit notes ─────────────────────────────────────────────── */

const FINANCE_DEBIT_NOTES_PATH = '/sabcrm/finance/debit-notes';

/** Lists the project's debit notes through the Rust engine. */
export async function listSabcrmDebitNotes(
  params?: SabcrmDebitNoteListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmDebitNoteDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceDebitNotesApi.list(g.ctx.projectId, params);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list debit notes.');
  }
}

/**
 * Creates a debit note (vendor side) from the dialog payload. `reason`
 * defaults to `other` and `refundMode` to `credit`; non-`draft` statuses
 * are applied with a follow-up PATCH.
 */
export async function createSabcrmDebitNote(
  input: SabcrmFinanceDocFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmDebitNoteDoc>> {
  if (!input?.number?.trim()) {
    return { ok: false, error: 'A debit note number is required.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid date is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceDebitNotesApi.create(g.ctx.projectId, {
      dnNo: input.number.trim(),
      date: dateIso,
      vendorId:
        input.partyId && ObjectId.isValid(input.partyId)
          ? input.partyId
          : new ObjectId().toHexString(),
      reason: 'other',
      currency: input.currency.trim().toUpperCase(),
      items: [{ qty: 1, rate: amount, total: amount }],
      totals: { subTotal: amount, total: amount },
      refundMode: 'credit',
    });
    let result = created;
    if (input.status && input.status !== 'draft') {
      result = await sabcrmFinanceDebitNotesApi.update(
        g.ctx.projectId,
        created._id,
        { status: input.status as SabcrmDebitNoteUpdateInput['status'] },
      );
    }
    revalidatePath(FINANCE_DEBIT_NOTES_PATH);
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to create debit note.');
  }
}

/** Status-level patch (workflow transitions). */
export async function updateSabcrmDebitNote(
  id: string,
  patch: SabcrmFinanceDocPatchInput,
  projectId?: string,
): Promise<ActionResult<SabcrmDebitNoteDoc>> {
  if (!id) return { ok: false, error: 'Debit note id is required.' };
  if (!patch?.status) return { ok: false, error: 'Nothing to update.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceDebitNotesApi.update(g.ctx.projectId, id, {
      status: patch.status as SabcrmDebitNoteUpdateInput['status'],
    });
    revalidatePath(FINANCE_DEBIT_NOTES_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update debit note.');
  }
}

/** Hard-deletes a debit note by id. */
export async function deleteSabcrmDebitNote(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Debit note id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceDebitNotesApi.delete(g.ctx.projectId, id);
    revalidatePath(FINANCE_DEBIT_NOTES_PATH);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete debit note.');
  }
}

/* ─── Payment receipts ────────────────────────────────────────── */

const FINANCE_PAYMENT_RECEIPTS_PATH = '/sabcrm/finance/payment-receipts';

/** Lists the project's payment receipts through the Rust engine. */
export async function listSabcrmPaymentReceipts(
  params?: SabcrmPaymentReceiptListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentReceiptDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinancePaymentReceiptsApi.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list payment receipts.');
  }
}

/**
 * Creates a payment receipt from the dialog payload. `mode` defaults to
 * `cash` and the required `bankAccountId` is minted as a placeholder
 * (the dialog has no account picker yet). Non-`received` statuses are
 * applied with a follow-up PATCH.
 */
export async function createSabcrmPaymentReceipt(
  input: SabcrmFinanceDocFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentReceiptDoc>> {
  if (!input?.number?.trim()) {
    return { ok: false, error: 'A receipt number is required.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid date is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinancePaymentReceiptsApi.create(
      g.ctx.projectId,
      {
        receiptNo: input.number.trim(),
        date: dateIso,
        clientId:
          input.partyId && ObjectId.isValid(input.partyId)
            ? input.partyId
            : new ObjectId().toHexString(),
        mode: 'cash',
        bankAccountId: new ObjectId().toHexString(),
        amount,
        currency: input.currency.trim().toUpperCase(),
      },
    );
    let result = created;
    if (input.status && input.status !== 'received') {
      result = await sabcrmFinancePaymentReceiptsApi.update(
        g.ctx.projectId,
        created._id,
        { status: input.status as SabcrmPaymentReceiptUpdateInput['status'] },
      );
    }
    revalidatePath(FINANCE_PAYMENT_RECEIPTS_PATH);
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to create payment receipt.');
  }
}

/** Status-level patch (workflow transitions). */
export async function updateSabcrmPaymentReceipt(
  id: string,
  patch: SabcrmFinanceDocPatchInput,
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentReceiptDoc>> {
  if (!id) return { ok: false, error: 'Receipt id is required.' };
  if (!patch?.status) return { ok: false, error: 'Nothing to update.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinancePaymentReceiptsApi.update(
      g.ctx.projectId,
      id,
      { status: patch.status as SabcrmPaymentReceiptUpdateInput['status'] },
    );
    revalidatePath(FINANCE_PAYMENT_RECEIPTS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update payment receipt.');
  }
}

/** Hard-deletes a payment receipt by id. */
export async function deleteSabcrmPaymentReceipt(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Receipt id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinancePaymentReceiptsApi.delete(
      g.ctx.projectId,
      id,
    );
    revalidatePath(FINANCE_PAYMENT_RECEIPTS_PATH);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete payment receipt.');
  }
}

/* ─── Bills ───────────────────────────────────────────────────── */

const FINANCE_BILLS_PATH = '/sabcrm/finance/bills';

/** Lists the project's vendor bills through the Rust engine. */
export async function listSabcrmBills(
  params?: SabcrmBillListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmBillDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceBillsApi.list(g.ctx.projectId, params);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list bills.');
  }
}

/**
 * Creates a vendor bill from the dialog payload. The required `vendorId`
 * is minted as a placeholder when absent; non-`draft` statuses are
 * applied with a follow-up PATCH.
 */
export async function createSabcrmBill(
  input: SabcrmFinanceDocFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmBillDoc>> {
  if (!input?.number?.trim()) {
    return { ok: false, error: 'A bill number is required.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid date is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceBillsApi.create(g.ctx.projectId, {
      billNo: input.number.trim(),
      billDate: dateIso,
      vendorId:
        input.partyId && ObjectId.isValid(input.partyId)
          ? input.partyId
          : new ObjectId().toHexString(),
      items: [{ qty: 1, rate: amount, total: amount }],
      currency: input.currency.trim().toUpperCase(),
      totals: { subTotal: amount, total: amount },
    });
    let result = created;
    if (input.status && input.status !== 'draft') {
      result = await sabcrmFinanceBillsApi.update(
        g.ctx.projectId,
        created._id,
        { status: input.status },
      );
    }
    revalidatePath(FINANCE_BILLS_PATH);
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to create bill.');
  }
}

/** Status-level patch (workflow transitions). */
export async function updateSabcrmBill(
  id: string,
  patch: SabcrmFinanceDocPatchInput,
  projectId?: string,
): Promise<ActionResult<SabcrmBillDoc>> {
  if (!id) return { ok: false, error: 'Bill id is required.' };
  if (!patch?.status) return { ok: false, error: 'Nothing to update.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceBillsApi.update(g.ctx.projectId, id, {
      status: patch.status,
    });
    revalidatePath(FINANCE_BILLS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update bill.');
  }
}

/** Hard-deletes a bill by id. */
export async function deleteSabcrmBill(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Bill id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceBillsApi.delete(g.ctx.projectId, id);
    revalidatePath(FINANCE_BILLS_PATH);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete bill.');
  }
}

/* ─── Proforma invoices ───────────────────────────────────────── */

const FINANCE_PROFORMA_PATH = '/sabcrm/finance/proforma-invoices';

/**
 * Lists the project's proforma invoices. NB: crm-common-style crate —
 * the Rust list response is `{ items, page, limit, hasMore }`; this
 * action unwraps to the plain array for page-component parity.
 */
export async function listSabcrmProformaInvoices(
  params?: SabcrmProformaListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmProformaInvoiceDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceProformaInvoicesApi.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list proforma invoices.');
  }
}

/**
 * Creates a proforma invoice from the dialog payload. `amount` expands
 * into a single line item (totals are derived server-side). Non-`Draft`
 * statuses (TitleCase vocabulary) are applied with a follow-up PATCH.
 */
export async function createSabcrmProformaInvoice(
  input: SabcrmFinanceDocFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmProformaInvoiceDoc>> {
  if (!input?.number?.trim()) {
    return { ok: false, error: 'A proforma number is required.' };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid date is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceProformaInvoicesApi.create(
      g.ctx.projectId,
      {
        proformaNumber: input.number.trim(),
        proformaDate: dateIso,
        currency: input.currency?.trim()
          ? input.currency.trim().toUpperCase()
          : undefined,
        lineItems: [
          { description: 'Item', quantity: 1, rate: amount, amount },
        ],
      },
    );
    let result = created.entity;
    if (input.status && input.status !== 'Draft') {
      result = await sabcrmFinanceProformaInvoicesApi.update(
        g.ctx.projectId,
        created.id,
        { status: input.status as SabcrmProformaUpdateInput['status'] },
      );
    }
    revalidatePath(FINANCE_PROFORMA_PATH);
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to create proforma invoice.');
  }
}

/** Status-level patch (workflow transitions, TitleCase vocabulary). */
export async function updateSabcrmProformaInvoice(
  id: string,
  patch: SabcrmFinanceDocPatchInput,
  projectId?: string,
): Promise<ActionResult<SabcrmProformaInvoiceDoc>> {
  if (!id) return { ok: false, error: 'Proforma id is required.' };
  if (!patch?.status) return { ok: false, error: 'Nothing to update.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceProformaInvoicesApi.update(
      g.ctx.projectId,
      id,
      { status: patch.status as SabcrmProformaUpdateInput['status'] },
    );
    revalidatePath(FINANCE_PROFORMA_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update proforma invoice.');
  }
}

/** Archives a proforma invoice (crm-common-style soft delete). */
export async function deleteSabcrmProformaInvoice(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Proforma id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceProformaInvoicesApi.delete(
      g.ctx.projectId,
      id,
    );
    revalidatePath(FINANCE_PROFORMA_PATH);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete proforma invoice.');
  }
}

/* ─── Payment accounts ────────────────────────────────────────── */

const FINANCE_PAYMENT_ACCOUNTS_PATH = '/sabcrm/finance/payment-accounts';

/**
 * Lists the project's payment accounts. NB: crm-common-style crate —
 * the Rust list response is `{ items, page, limit, hasMore }`; this
 * action unwraps to the plain array for page-component parity.
 */
export async function listSabcrmPaymentAccounts(
  params?: SabcrmPaymentAccountListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentAccountDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinancePaymentAccountsApi.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list payment accounts.');
  }
}

/** Creates a payment account from the "New account" dialog payload. */
export async function createSabcrmPaymentAccount(
  input: SabcrmPaymentAccountFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentAccountDoc>> {
  if (!input?.accountName?.trim()) {
    return { ok: false, error: 'An account name is required.' };
  }
  if (!input.accountType?.trim()) {
    return { ok: false, error: 'An account type is required.' };
  }
  const openingBalance =
    input.openingBalance === undefined ? 0 : Number(input.openingBalance);
  if (!Number.isFinite(openingBalance)) {
    return { ok: false, error: 'Opening balance must be a number.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinancePaymentAccountsApi.create(
      g.ctx.projectId,
      {
        accountName: input.accountName.trim(),
        accountType: input.accountType.trim(),
        openingBalance,
        currency: input.currency?.trim()
          ? input.currency.trim().toUpperCase()
          : undefined,
      },
    );
    revalidatePath(FINANCE_PAYMENT_ACCOUNTS_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create payment account.');
  }
}

/** Partial-updates a payment account (name, type, status, balance). */
export async function updateSabcrmPaymentAccount(
  id: string,
  patch: SabcrmPaymentAccountPatchInput,
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentAccountDoc>> {
  if (!id) return { ok: false, error: 'Account id is required.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmPaymentAccountUpdateInput = {};
  if (patch.accountName !== undefined) {
    wire.accountName = patch.accountName.trim();
  }
  if (patch.accountType !== undefined) {
    wire.accountType = patch.accountType.trim();
  }
  if (patch.status !== undefined) {
    wire.status = patch.status as SabcrmPaymentAccountUpdateInput['status'];
  }
  if (patch.openingBalance !== undefined) {
    const v = Number(patch.openingBalance);
    if (!Number.isFinite(v)) {
      return { ok: false, error: 'Opening balance must be a number.' };
    }
    wire.openingBalance = v;
  }
  if (patch.currency !== undefined) {
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmFinancePaymentAccountsApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(FINANCE_PAYMENT_ACCOUNTS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update payment account.');
  }
}

/** Archives a payment account (crm-common-style soft delete). */
export async function deleteSabcrmPaymentAccount(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Account id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinancePaymentAccountsApi.delete(
      g.ctx.projectId,
      id,
    );
    revalidatePath(FINANCE_PAYMENT_ACCOUNTS_PATH);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete payment account.');
  }
}

// ---------------------------------------------------------------------------
// Finance tranche 2 — banking/ledger crates, same gate recipe
// ---------------------------------------------------------------------------
//
// Same pipeline as tranche 1: gate → Rust call → normalised ActionResult,
// with `revalidatePath` after every mutation. All eight entities are
// crm-common-style (list `{ items, … }` unwrapped here; create
// `{ id, entity }`; delete = archive `{ deleted }`) EXCEPT payouts
// (bare-array list, entity create, HARD delete `{ ok }`).

/* ─── Bank transactions ───────────────────────────────────────── */

const FINANCE_BANK_TRANSACTIONS_PATH = '/sabcrm/finance/bank-transactions';

const BANK_TX_TYPES = new Set(['debit', 'credit']);

/** Lists the project's bank transactions through the Rust engine. */
export async function listSabcrmBankTransactions(
  params?: SabcrmBankTransactionListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmBankTransactionDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceBankTransactionsApi.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list bank transactions.');
  }
}

/**
 * Creates a bank transaction from the dialog payload. `amount` is stored
 * positive; the sign is conveyed by `type` (`debit` | `credit`). The
 * required `accountId` is minted as a placeholder when absent (the
 * dialog has no account picker yet — proving-vertical convention).
 */
export async function createSabcrmBankTransaction(
  input: SabcrmBankTransactionFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmBankTransactionDoc>> {
  const amount = Number(input?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Amount must be a positive number.' };
  }
  const kind = input.type?.trim().toLowerCase();
  if (!BANK_TX_TYPES.has(kind)) {
    return { ok: false, error: 'Type must be debit or credit.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid date is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const wire: SabcrmBankTransactionCreateInput = {
      accountId:
        input.accountId && ObjectId.isValid(input.accountId)
          ? input.accountId
          : new ObjectId().toHexString(),
      transactionDate: dateIso,
      amount,
      type: kind as SabcrmBankTransactionCreateInput['type'],
      description: input.description?.trim() || undefined,
      referenceNumber: input.referenceNumber?.trim() || undefined,
    };
    const created = await sabcrmFinanceBankTransactionsApi.create(
      g.ctx.projectId,
      wire,
    );
    revalidatePath(FINANCE_BANK_TRANSACTIONS_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create bank transaction.');
  }
}

/** Archives a bank transaction (crm-common-style soft delete). */
export async function deleteSabcrmBankTransaction(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Transaction id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceBankTransactionsApi.delete(
      g.ctx.projectId,
      id,
    );
    revalidatePath(FINANCE_BANK_TRANSACTIONS_PATH);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete bank transaction.');
  }
}

/* ─── Recurring invoices ──────────────────────────────────────── */

const FINANCE_RECURRING_INVOICES_PATH = '/sabcrm/finance/recurring-invoices';

const RECURRING_STATUSES = new Set([
  'active',
  'paused',
  'stopped',
  'completed',
]);

/** Lists the project's recurring-invoice schedules. */
export async function listSabcrmRecurringInvoices(
  params?: SabcrmRecurringInvoiceListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmRecurringInvoiceDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceRecurringInvoicesApi.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list recurring invoices.');
  }
}

/**
 * Creates a recurring-invoice schedule. `nextRunAt` seeds from
 * `startDate` server-side; the required `customerId` is minted as a
 * placeholder when absent (no customer picker yet).
 */
export async function createSabcrmRecurringInvoice(
  input: SabcrmRecurringInvoiceFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRecurringInvoiceDoc>> {
  const startIso = input?.startDate ? toIso(input.startDate) : null;
  if (!startIso) return { ok: false, error: 'A valid start date is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const wire: SabcrmRecurringInvoiceCreateInput = {
      title: input.title?.trim() || undefined,
      customerId:
        input.customerId && ObjectId.isValid(input.customerId)
          ? input.customerId
          : new ObjectId().toHexString(),
      frequency: input.frequency as SabcrmRecurringInvoiceCreateInput['frequency'],
      startDate: startIso,
    };
    const created = await sabcrmFinanceRecurringInvoicesApi.create(
      g.ctx.projectId,
      wire,
    );
    revalidatePath(FINANCE_RECURRING_INVOICES_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create recurring invoice.');
  }
}

/** Status-level patch — drives the pause/resume toggle on the page. */
export async function updateSabcrmRecurringInvoice(
  id: string,
  patch: SabcrmFinanceDocPatchInput,
  projectId?: string,
): Promise<ActionResult<SabcrmRecurringInvoiceDoc>> {
  if (!id) return { ok: false, error: 'Schedule id is required.' };
  if (!patch?.status) return { ok: false, error: 'Nothing to update.' };
  if (!RECURRING_STATUSES.has(patch.status)) {
    return { ok: false, error: 'Invalid schedule status.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceRecurringInvoicesApi.update(
      g.ctx.projectId,
      id,
      { status: patch.status as SabcrmRecurringInvoiceUpdateInput['status'] },
    );
    revalidatePath(FINANCE_RECURRING_INVOICES_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update recurring invoice.');
  }
}

/** Archives a recurring-invoice schedule (crm-common-style soft delete). */
export async function deleteSabcrmRecurringInvoice(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Schedule id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceRecurringInvoicesApi.delete(
      g.ctx.projectId,
      id,
    );
    revalidatePath(FINANCE_RECURRING_INVOICES_PATH);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete recurring invoice.');
  }
}

/* ─── Expenses (expense claims) ───────────────────────────────── */

const FINANCE_EXPENSES_PATH = '/sabcrm/finance/expenses';

/** Lists the project's expense claims through the Rust engine. */
export async function listSabcrmExpenses(
  params?: SabcrmExpenseClaimListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmExpenseClaimDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceExpensesApi.list(g.ctx.projectId, params);
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list expenses.');
  }
}

/**
 * Creates an expense claim from the generic finance-doc dialog payload.
 * `number` overrides the auto-generated `EC-YYYYMM-NNNN` claim number
 * when supplied; `partyId` doubles as the employee reference (a
 * placeholder is stamped when absent). NB: snake_case wire body.
 */
export async function createSabcrmExpense(
  input: SabcrmFinanceDocFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmExpenseClaimDoc>> {
  const amount = Number(input?.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid date is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceExpensesApi.create(g.ctx.projectId, {
      employee_id:
        input.partyId && ObjectId.isValid(input.partyId)
          ? input.partyId
          : new ObjectId().toHexString(),
      claim_number: input.number?.trim() || undefined,
      amount,
      currency: input.currency?.trim()
        ? input.currency.trim().toUpperCase()
        : undefined,
      expense_date: dateIso,
      status: input.status as SabcrmExpenseClaimDoc['status'] | undefined,
    });
    revalidatePath(FINANCE_EXPENSES_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create expense.');
  }
}

/** Status-level patch (approval workflow transitions). */
export async function updateSabcrmExpense(
  id: string,
  patch: SabcrmFinanceDocPatchInput,
  projectId?: string,
): Promise<ActionResult<SabcrmExpenseClaimDoc>> {
  if (!id) return { ok: false, error: 'Expense id is required.' };
  if (!patch?.status) return { ok: false, error: 'Nothing to update.' };
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinanceExpensesApi.update(g.ctx.projectId, id, {
      status: patch.status as SabcrmExpenseClaimUpdateInput['status'],
    });
    revalidatePath(FINANCE_EXPENSES_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update expense.');
  }
}

/** Archives an expense claim (crm-common-style soft delete). */
export async function deleteSabcrmExpense(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Expense id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceExpensesApi.delete(g.ctx.projectId, id);
    revalidatePath(FINANCE_EXPENSES_PATH);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete expense.');
  }
}

/* ─── Payouts ─────────────────────────────────────────────────── */

const FINANCE_PAYOUTS_PATH = '/sabcrm/finance/payouts';

const PAYOUT_STATUSES = new Set(['sent', 'cleared', 'failed']);

/** Lists the project's payouts. NB: payout style — bare-array response. */
export async function listSabcrmPayouts(
  params?: SabcrmPayoutListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmPayoutDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinancePayoutsApi.list(g.ctx.projectId, params);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to list payouts.');
  }
}

/**
 * Creates a payout from the generic finance-doc dialog payload. `mode`
 * defaults to `cash`; the required `vendorId` / `bankAccountId` are
 * minted as placeholders when the dialog has no pickers. The Rust create
 * path always starts payouts in `sent`; a different chosen status is
 * applied with a follow-up PATCH.
 */
export async function createSabcrmPayout(
  input: SabcrmFinanceDocFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmPayoutDoc>> {
  if (!input?.number?.trim()) {
    return { ok: false, error: 'A payout number is required.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, error: 'Amount must be a non-negative number.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid date is required.' };
  if (input.status && !PAYOUT_STATUSES.has(input.status)) {
    return { ok: false, error: 'Invalid payout status.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const wire: SabcrmPayoutCreateInput = {
      paymentNo: input.number.trim(),
      date: dateIso,
      vendorId:
        input.partyId && ObjectId.isValid(input.partyId)
          ? input.partyId
          : new ObjectId().toHexString(),
      mode: 'cash',
      bankAccountId: new ObjectId().toHexString(),
      amount,
      currency: input.currency.trim().toUpperCase(),
    };
    const created = await sabcrmFinancePayoutsApi.create(
      g.ctx.projectId,
      wire,
    );
    let result = created;
    if (input.status && input.status !== 'sent') {
      result = await sabcrmFinancePayoutsApi.update(
        g.ctx.projectId,
        created.identity?.id ?? created._id,
        { status: input.status as SabcrmPayoutUpdateInput['status'] },
      );
    }
    revalidatePath(FINANCE_PAYOUTS_PATH);
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to create payout.');
  }
}

/** Status-level patch (workflow transitions). */
export async function updateSabcrmPayout(
  id: string,
  patch: SabcrmFinanceDocPatchInput,
  projectId?: string,
): Promise<ActionResult<SabcrmPayoutDoc>> {
  if (!id) return { ok: false, error: 'Payout id is required.' };
  if (!patch?.status) return { ok: false, error: 'Nothing to update.' };
  if (!PAYOUT_STATUSES.has(patch.status)) {
    return { ok: false, error: 'Invalid payout status.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const data = await sabcrmFinancePayoutsApi.update(g.ctx.projectId, id, {
      status: patch.status as SabcrmPayoutUpdateInput['status'],
    });
    revalidatePath(FINANCE_PAYOUTS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update payout.');
  }
}

/** Hard-deletes a payout by id (payout-style — NOT an archive). */
export async function deleteSabcrmPayout(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Payout id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinancePayoutsApi.delete(g.ctx.projectId, id);
    revalidatePath(FINANCE_PAYOUTS_PATH);
    return { ok: true, data: { ok: res.ok } };
  } catch (e) {
    return fail(e, 'Failed to delete payout.');
  }
}

/* ─── Voucher books ───────────────────────────────────────────── */

const FINANCE_VOUCHERS_PATH = '/sabcrm/finance/vouchers';

/** Lists the project's voucher books (numbering series). */
export async function listSabcrmVoucherBooks(
  params?: SabcrmVoucherBookListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmVoucherBookDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceVouchersApi.list(g.ctx.projectId, params);
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list voucher books.');
  }
}

/** Creates a voucher book from the "New voucher book" dialog payload. */
export async function createSabcrmVoucherBook(
  input: SabcrmVoucherBookFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmVoucherBookDoc>> {
  if (!input?.name?.trim()) {
    return { ok: false, error: 'A book name is required.' };
  }
  if (!input.type?.trim()) {
    return { ok: false, error: 'A voucher type is required.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const wire: SabcrmVoucherBookCreateInput = {
      name: input.name.trim(),
      type: input.type.trim(),
      prefix: input.prefix?.trim() || undefined,
      startingNumber:
        input.startingNumber !== undefined &&
        Number.isFinite(Number(input.startingNumber))
          ? Number(input.startingNumber)
          : undefined,
    };
    const created = await sabcrmFinanceVouchersApi.create(
      g.ctx.projectId,
      wire,
    );
    revalidatePath(FINANCE_VOUCHERS_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create voucher book.');
  }
}

/** Archives a voucher book (crm-common-style soft delete). */
export async function deleteSabcrmVoucherBook(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Book id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceVouchersApi.delete(g.ctx.projectId, id);
    revalidatePath(FINANCE_VOUCHERS_PATH);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete voucher book.');
  }
}

/* ─── Petty cash floats ───────────────────────────────────────── */

const FINANCE_PETTY_CASH_PATH = '/sabcrm/finance/petty-cash';

/** Lists the project's petty cash floats. */
export async function listSabcrmPettyCashFloats(
  params?: SabcrmPettyCashListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmPettyCashFloatDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinancePettyCashApi.list(g.ctx.projectId, params);
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list petty cash floats.');
  }
}

/** Creates a petty cash float from the dialog payload. */
export async function createSabcrmPettyCashFloat(
  input: SabcrmPettyCashFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmPettyCashFloatDoc>> {
  const openingBalance = Number(input?.openingBalance);
  if (!Number.isFinite(openingBalance) || openingBalance < 0) {
    return { ok: false, error: 'Opening balance must be a non-negative number.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinancePettyCashApi.create(g.ctx.projectId, {
      branchName: input.branchName?.trim() || undefined,
      custodianName: input.custodianName?.trim() || undefined,
      openingBalance,
      currency: input.currency?.trim()
        ? input.currency.trim().toUpperCase()
        : undefined,
    });
    revalidatePath(FINANCE_PETTY_CASH_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create petty cash float.');
  }
}

/** Archives a petty cash float (crm-common-style soft delete). */
export async function deleteSabcrmPettyCashFloat(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Float id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinancePettyCashApi.delete(g.ctx.projectId, id);
    revalidatePath(FINANCE_PETTY_CASH_PATH);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete petty cash float.');
  }
}

/* ─── Budgets ─────────────────────────────────────────────────── */

const FINANCE_BUDGETS_PATH = '/sabcrm/finance/budgets';

/** Lists the project's budgets. */
export async function listSabcrmBudgets(
  params?: SabcrmBudgetListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmBudgetDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceBudgetsApi.list(g.ctx.projectId, params);
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list budgets.');
  }
}

/** Creates a budget from the "New budget" dialog payload. */
export async function createSabcrmBudget(
  input: SabcrmBudgetFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmBudgetDoc>> {
  if (!input?.budgetHead?.trim()) {
    return { ok: false, error: 'A budget head is required.' };
  }
  if (!input.period?.trim()) {
    return { ok: false, error: 'A period is required.' };
  }
  const plannedAmount = Number(input.plannedAmount);
  if (!Number.isFinite(plannedAmount) || plannedAmount < 0) {
    return { ok: false, error: 'Planned amount must be a non-negative number.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceBudgetsApi.create(g.ctx.projectId, {
      budgetHead: input.budgetHead.trim(),
      period: input.period.trim(),
      department: input.department?.trim() || undefined,
      plannedAmount,
      currency: input.currency?.trim()
        ? input.currency.trim().toUpperCase()
        : undefined,
    });
    revalidatePath(FINANCE_BUDGETS_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create budget.');
  }
}

/** Archives a budget (crm-common-style soft delete). */
export async function deleteSabcrmBudget(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Budget id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceBudgetsApi.delete(g.ctx.projectId, id);
    revalidatePath(FINANCE_BUDGETS_PATH);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete budget.');
  }
}

/* ─── Reconciliation ──────────────────────────────────────────── */

const FINANCE_RECONCILIATION_PATH = '/sabcrm/finance/reconciliation';

/**
 * Lists the project's reconciliation runs. Read-heavy surface — the
 * page lists sessions; statement-line matching flows are a follow-up.
 */
export async function listSabcrmReconciliations(
  params?: SabcrmReconciliationListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmReconciliationDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceReconciliationApi.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list reconciliation runs.');
  }
}

/**
 * Starts a reconciliation run for a `[periodStart, periodEnd]` window.
 * The required `accountId` is minted as a placeholder when absent (no
 * account picker yet).
 */
export async function createSabcrmReconciliation(
  input: SabcrmReconciliationFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmReconciliationDoc>> {
  const startIso = input?.periodStart ? toIso(input.periodStart) : null;
  if (!startIso) return { ok: false, error: 'A valid period start is required.' };
  const endIso = input.periodEnd ? toIso(input.periodEnd) : null;
  if (!endIso) return { ok: false, error: 'A valid period end is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const wire: SabcrmReconciliationCreateInput = {
      accountId:
        input.accountId && ObjectId.isValid(input.accountId)
          ? input.accountId
          : new ObjectId().toHexString(),
      periodStart: startIso,
      periodEnd: endIso,
      openingBalance:
        input.openingBalance !== undefined &&
        Number.isFinite(Number(input.openingBalance))
          ? Number(input.openingBalance)
          : undefined,
      closingBalance:
        input.closingBalance !== undefined &&
        Number.isFinite(Number(input.closingBalance))
          ? Number(input.closingBalance)
          : undefined,
      notes: input.notes?.trim() || undefined,
    };
    const created = await sabcrmFinanceReconciliationApi.create(
      g.ctx.projectId,
      wire,
    );
    revalidatePath(FINANCE_RECONCILIATION_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to start reconciliation run.');
  }
}

/** Archives a reconciliation run (crm-common-style soft delete). */
export async function deleteSabcrmReconciliation(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Run id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceReconciliationApi.delete(
      g.ctx.projectId,
      id,
    );
    revalidatePath(FINANCE_RECONCILIATION_PATH);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete reconciliation run.');
  }
}

/* ═══════════════════════════════════════════════════════════════════
 * Finance tranche 3 — accounting/compliance entities (chart of
 * accounts, account groups, journal entries, TDS records). Same gated
 * pipeline; crates re-mounted at `/v1/sabcrm/finance/*`.
 * ═══════════════════════════════════════════════════════════════════ */

/* ─── Chart of accounts ───────────────────────────────────────── */

const FINANCE_ACCOUNTS_PATH = '/sabcrm/finance/accounts';

const ACCOUNT_TYPES = new Set([
  'asset',
  'liability',
  'income',
  'expense',
  'equity',
]);

/** Lists the project's chart-of-account ledger heads. */
export async function listSabcrmChartOfAccounts(
  params?: SabcrmChartOfAccountListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmChartOfAccountDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceAccountsApi.list(g.ctx.projectId, params);
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list accounts.');
  }
}

/** Creates a ledger account from the "New account" dialog payload. */
export async function createSabcrmChartOfAccount(
  input: SabcrmChartOfAccountFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmChartOfAccountDoc>> {
  if (!input?.name?.trim()) {
    return { ok: false, error: 'An account name is required.' };
  }
  const accountType = input.accountType?.trim().toLowerCase();
  if (!accountType || !ACCOUNT_TYPES.has(accountType)) {
    return {
      ok: false,
      error:
        'Account type must be asset, liability, income, expense or equity.',
    };
  }
  const openingBalance =
    input.openingBalance !== undefined ? Number(input.openingBalance) : 0;
  if (!Number.isFinite(openingBalance)) {
    return { ok: false, error: 'Opening balance must be a number.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const wire: SabcrmChartOfAccountCreateInput = {
      name: input.name.trim(),
      accountType:
        accountType as SabcrmChartOfAccountCreateInput['accountType'],
      code: input.code?.trim() || undefined,
      openingBalance,
      currency: input.currency?.trim()
        ? input.currency.trim().toUpperCase()
        : undefined,
    };
    const created = await sabcrmFinanceAccountsApi.create(
      g.ctx.projectId,
      wire,
    );
    revalidatePath(FINANCE_ACCOUNTS_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create account.');
  }
}

/** Archives a ledger account (crm-common-style soft delete). */
export async function deleteSabcrmChartOfAccount(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Account id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceAccountsApi.delete(g.ctx.projectId, id);
    revalidatePath(FINANCE_ACCOUNTS_PATH);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete account.');
  }
}

/* ─── Account groups ──────────────────────────────────────────── */

/** Lists the project's account groups (read-only support surface). */
export async function listSabcrmAccountGroups(
  params?: SabcrmAccountGroupListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmAccountGroupDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceAccountGroupsApi.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list account groups.');
  }
}

/* ─── Journal entries (voucher entries) ───────────────────────── */

const FINANCE_JOURNAL_ENTRIES_PATH = '/sabcrm/finance/journal-entries';

/** Lists the project's journal (voucher) entries. */
export async function listSabcrmJournalEntries(
  params?: SabcrmJournalEntryListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmJournalEntryDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceJournalEntriesApi.list(
      g.ctx.projectId,
      params,
    );
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list journal entries.');
  }
}

/**
 * Creates a balanced 2-line journal entry (one debit line, one credit
 * line, same amount). `voucherBookId` is required by the Rust DTO, so
 * the action finds the project's first `journal`-type voucher book and
 * creates a default "Journal" book when none exists yet.
 */
export async function createSabcrmJournalEntry(
  input: SabcrmJournalEntryFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmJournalEntryDoc>> {
  if (!input?.debitAccountId || !ObjectId.isValid(input.debitAccountId)) {
    return { ok: false, error: 'A debit account is required.' };
  }
  if (!input.creditAccountId || !ObjectId.isValid(input.creditAccountId)) {
    return { ok: false, error: 'A credit account is required.' };
  }
  if (input.debitAccountId === input.creditAccountId) {
    return {
      ok: false,
      error: 'Debit and credit accounts must be different.',
    };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Amount must be a positive number.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid entry date is required.' };

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    // Resolve (or seed) the default journal voucher book.
    const books = await sabcrmFinanceVouchersApi.list(g.ctx.projectId, {
      type: 'journal',
      limit: 1,
    });
    let bookId = books.items[0]?._id;
    if (!bookId) {
      const created = await sabcrmFinanceVouchersApi.create(g.ctx.projectId, {
        name: 'Journal',
        type: 'journal',
        prefix: 'JV-',
      });
      bookId = created.id;
    }

    const status =
      input.status === 'draft' || input.status === 'posted'
        ? input.status
        : 'posted';
    const wire: SabcrmJournalEntryCreateInput = {
      voucherBookId: bookId,
      voucherNumber:
        input.voucherNumber?.trim() || `JV-${Date.now().toString(36).toUpperCase()}`,
      date: dateIso,
      narration: input.narration?.trim() || undefined,
      debitEntries: [{ accountId: input.debitAccountId, amount }],
      creditEntries: [{ accountId: input.creditAccountId, amount }],
      status,
    };
    const created = await sabcrmFinanceJournalEntriesApi.create(
      g.ctx.projectId,
      wire,
    );
    revalidatePath(FINANCE_JOURNAL_ENTRIES_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create journal entry.');
  }
}

/** Archives a journal entry (crm-common-style soft delete). */
export async function deleteSabcrmJournalEntry(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Entry id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceJournalEntriesApi.delete(
      g.ctx.projectId,
      id,
    );
    revalidatePath(FINANCE_JOURNAL_ENTRIES_PATH);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete journal entry.');
  }
}

/* ─── TDS records ─────────────────────────────────────────────── */

const FINANCE_TDS_PATH = '/sabcrm/finance/tds';

const TDS_QUARTERS = new Set(['Q1', 'Q2', 'Q3', 'Q4']);
const TDS_STATUSES = new Set(['pending', 'deposited', 'filed']);

/** Lists the project's TDS deduction records. */
export async function listSabcrmTdsRecords(
  params?: SabcrmTdsListParams,
  projectId?: string,
): Promise<ActionResult<SabcrmTdsRecordDoc[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceTdsApi.list(g.ctx.projectId, params);
    return { ok: true, data: res.items };
  } catch (e) {
    return fail(e, 'Failed to list TDS records.');
  }
}

/** Creates a TDS record from the "New TDS record" dialog payload. */
export async function createSabcrmTdsRecord(
  input: SabcrmTdsFormInput,
  projectId?: string,
): Promise<ActionResult<SabcrmTdsRecordDoc>> {
  if (!input?.employeeName?.trim()) {
    return { ok: false, error: 'A deductee name is required.' };
  }
  if (!input.financialYear?.trim()) {
    return { ok: false, error: 'A financial year is required.' };
  }
  const quarter = input.quarter?.trim().toUpperCase();
  if (!quarter || !TDS_QUARTERS.has(quarter)) {
    return { ok: false, error: 'Quarter must be Q1, Q2, Q3 or Q4.' };
  }
  const tdsAmount = Number(input.tdsAmount);
  if (!Number.isFinite(tdsAmount) || tdsAmount < 0) {
    return { ok: false, error: 'TDS amount must be a non-negative number.' };
  }
  const grossAmount =
    input.grossAmount !== undefined ? Number(input.grossAmount) : 0;
  if (!Number.isFinite(grossAmount) || grossAmount < 0) {
    return {
      ok: false,
      error: 'Gross amount must be a non-negative number.',
    };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const wire: SabcrmTdsCreateInput = {
      employeeName: input.employeeName.trim(),
      financialYear: input.financialYear.trim(),
      quarter,
      tdsAmount,
      grossAmount,
      certificateNumber: input.certificateNumber?.trim() || undefined,
      depositChallanNumber: input.depositChallanNumber?.trim() || undefined,
      status:
        input.status && TDS_STATUSES.has(input.status)
          ? input.status
          : undefined,
    };
    const created = await sabcrmFinanceTdsApi.create(g.ctx.projectId, wire);
    revalidatePath(FINANCE_TDS_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create TDS record.');
  }
}

/** Archives a TDS record (crm-common-style soft delete). */
export async function deleteSabcrmTdsRecord(
  id: string,
  projectId?: string,
): Promise<ActionResult<{ ok: boolean }>> {
  if (!id) return { ok: false, error: 'Record id is required.' };
  const g = await gate('delete', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinanceTdsApi.delete(g.ctx.projectId, id);
    revalidatePath(FINANCE_TDS_PATH);
    return { ok: true, data: { ok: res.deleted } };
  } catch (e) {
    return fail(e, 'Failed to delete TDS record.');
  }
}
