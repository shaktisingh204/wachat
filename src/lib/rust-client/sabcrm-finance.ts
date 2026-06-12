import 'server-only';

/**
 * SabCRM Finance client — wraps the Rust `/v1/sabcrm/finance/invoices`
 * surface (crate `crm-invoices`, `project_router` mount in `sabnode-api`).
 *
 * This is the project-scoped re-mount of the legacy `crm-invoices` engine:
 * same handlers, same `crm_invoices` Mongo collection, but every request
 * must carry the active SabCRM `projectId` (query string for
 * GET/PATCH/DELETE, body for POST) — the Rust side rejects requests
 * without it. Membership of the project is validated by the gated server
 * actions in `src/app/actions/sabcrm-finance.actions.ts` BEFORE calling
 * this client; never call it with an unvalidated projectId.
 *
 * Wire shapes are identical to the legacy mount, so the document/input
 * types are re-used from `./crm-invoices` (all camelCase, mirroring the
 * `serde(rename_all = "camelCase")` Rust DTOs).
 *
 * NB: `rustFetch` throws on non-2xx — wrap calls in `try/catch` and
 * surface `RustApiError.code` for friendly UI messages.
 */
import { rustFetch } from './fetcher';
import type {
  CrmInvoiceCreateInput,
  CrmInvoiceDoc,
  CrmInvoiceListParams,
  CrmInvoiceUpdateInput,
} from './crm-invoices';
import type {
  CrmQuotationCreateInput,
  CrmQuotationDoc,
  CrmQuotationListParams,
  CrmQuotationUpdateInput,
} from './crm-quotations';
import type {
  CrmSalesOrderCreateInput,
  CrmSalesOrderDoc,
  CrmSalesOrderListParams,
  CrmSalesOrderUpdateInput,
} from './crm-sales-orders';
import type {
  CrmCreditNoteCreateInput,
  CrmCreditNoteDoc,
  CrmCreditNoteListParams,
  CrmCreditNoteUpdateInput,
} from './crm-credit-notes';
import type {
  CrmDebitNoteCreateInput,
  CrmDebitNoteDoc,
  CrmDebitNoteListParams,
  CrmDebitNoteUpdateInput,
} from './crm-debit-notes';
import type {
  CrmPaymentReceiptCreateInput,
  CrmPaymentReceiptDoc,
  CrmPaymentReceiptListParams,
  CrmPaymentReceiptUpdateInput,
} from './crm-payment-receipts';
import type {
  CrmBillCreateInput,
  CrmBillDoc,
  CrmBillListParams,
  CrmBillUpdateInput,
} from './crm-bills';
import type {
  CrmProformaCreateInput,
  CrmProformaInvoiceDoc,
  CrmProformaListParams,
  CrmProformaListResponse,
  CrmProformaUpdateInput,
} from './crm-proforma-invoices';
import type {
  CrmPaymentAccountCreateInput,
  CrmPaymentAccountDoc,
  CrmPaymentAccountListParams,
  CrmPaymentAccountListResponse,
  CrmPaymentAccountUpdateInput,
} from './crm-payment-accounts';
import type {
  CrmBankTransactionCreateInput,
  CrmBankTransactionDoc,
  CrmBankTransactionListParams,
  CrmBankTransactionListResponse,
  CrmBankTransactionUpdateInput,
} from './crm-bank-transactions';
import type {
  CrmRecurringInvoiceCreateInput,
  CrmRecurringInvoiceDoc,
  CrmRecurringInvoiceListParams,
  CrmRecurringInvoiceListResponse,
  CrmRecurringInvoiceUpdateInput,
} from './crm-recurring-invoices';
import type {
  CrmExpenseClaimCreateInput,
  CrmExpenseClaimDoc,
  CrmExpenseClaimListParams,
  CrmExpenseClaimListResponse,
  CrmExpenseClaimUpdateInput,
} from './crm-expense-claims';
import type {
  CrmPayoutCreateInput,
  CrmPayoutDoc,
  CrmPayoutListParams,
  CrmPayoutUpdateInput,
} from './crm-payouts';
import type {
  CrmVoucherBookCreateInput,
  CrmVoucherBookDoc,
  CrmVoucherBookListParams,
  CrmVoucherBookListResponse,
  CrmVoucherBookUpdateInput,
} from './crm-vouchers';
import type {
  CrmPettyCashCreateInput,
  CrmPettyCashFloatDoc,
  CrmPettyCashListParams,
  CrmPettyCashListResponse,
  CrmPettyCashUpdateInput,
} from './crm-petty-cash';
import type {
  CrmBudgetCreateInput,
  CrmBudgetDoc,
  CrmBudgetListParams,
  CrmBudgetListResponse,
  CrmBudgetUpdateInput,
} from './crm-budgets';
import type {
  CrmReconciliationCreateInput,
  CrmReconciliationDoc,
  CrmReconciliationListParams,
  CrmReconciliationListResponse,
  CrmReconciliationUpdateInput,
} from './crm-reconciliation';

/* ─── Wire types (aliased from the legacy client; same Rust DTOs) ── */

/** A full invoice document as returned by the Rust engine. */
export type SabcrmInvoiceDoc = CrmInvoiceDoc;

/** List filters (`q`, `clientId`, `status`, `month`/`year`, paging). */
export type SabcrmInvoiceListParams = CrmInvoiceListParams;

/**
 * `POST` body sans `projectId` — the client injects the validated
 * project scope itself so callers can't smuggle a different tenant in.
 */
export type SabcrmInvoiceCreateInput = Omit<CrmInvoiceCreateInput, 'projectId'>;

/** `PATCH` body — partial update, plus the workflow `status`. */
export type SabcrmInvoiceUpdateInput = CrmInvoiceUpdateInput;

/* ─── Client ──────────────────────────────────────────────────── */

const BASE = '/v1/sabcrm/finance/invoices';

/** Encode query params, dropping undefined/empty values. */
function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const sabcrmFinanceApi = {
  /** `GET /v1/sabcrm/finance/invoices` — project-scoped paginated list. */
  listInvoices: (
    projectId: string,
    params?: SabcrmInvoiceListParams,
  ): Promise<SabcrmInvoiceDoc[]> =>
    rustFetch<SabcrmInvoiceDoc[]>(
      `${BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        clientId: params?.clientId,
        status: params?.status ? String(params.status) : undefined,
        month: params?.month,
        year: params?.year,
      })}`,
    ),

  /** `GET /v1/sabcrm/finance/invoices/{id}` — single invoice (404 ⇒ throws). */
  getInvoice: (projectId: string, id: string): Promise<SabcrmInvoiceDoc> =>
    rustFetch<SabcrmInvoiceDoc>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),

  /** `POST /v1/sabcrm/finance/invoices` — create under the project scope. */
  createInvoice: (
    projectId: string,
    input: SabcrmInvoiceCreateInput,
  ): Promise<SabcrmInvoiceDoc> =>
    rustFetch<SabcrmInvoiceDoc>(BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),

  /** `PATCH /v1/sabcrm/finance/invoices/{id}` — partial update. */
  updateInvoice: (
    projectId: string,
    id: string,
    patch: SabcrmInvoiceUpdateInput,
  ): Promise<SabcrmInvoiceDoc> =>
    rustFetch<SabcrmInvoiceDoc>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),

  /** `DELETE /v1/sabcrm/finance/invoices/{id}` — hard delete. */
  deleteInvoice: (
    projectId: string,
    id: string,
  ): Promise<{ ok: boolean; deleted?: boolean }> =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `${BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ═══════════════════════════════════════════════════════════════════
 * Finance tranche 1 — the remaining document crates re-mounted under
 * `/v1/sabcrm/finance/*` (each crate's `project_router`). Same recipe
 * as invoices: wire shapes aliased from the legacy clients, `projectId`
 * injected by this module (query for GET/PATCH/DELETE, body for POST).
 * ═══════════════════════════════════════════════════════════════════ */

/* ─── Quotations (`crm-quotations`) ───────────────────────────── */

export type SabcrmQuotationDoc = CrmQuotationDoc;
export type SabcrmQuotationListParams = CrmQuotationListParams;
export type SabcrmQuotationCreateInput = Omit<
  CrmQuotationCreateInput,
  'projectId'
>;
export type SabcrmQuotationUpdateInput = CrmQuotationUpdateInput;

const QUOTATIONS_BASE = '/v1/sabcrm/finance/quotations';

export const sabcrmFinanceQuotationsApi = {
  list: (
    projectId: string,
    params?: SabcrmQuotationListParams,
  ): Promise<SabcrmQuotationDoc[]> =>
    rustFetch<SabcrmQuotationDoc[]>(
      `${QUOTATIONS_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        clientId: params?.clientId,
        status: params?.status ? String(params.status) : undefined,
      })}`,
    ),
  getById: (projectId: string, id: string): Promise<SabcrmQuotationDoc> =>
    rustFetch<SabcrmQuotationDoc>(
      `${QUOTATIONS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  create: (
    projectId: string,
    input: SabcrmQuotationCreateInput,
  ): Promise<SabcrmQuotationDoc> =>
    rustFetch<SabcrmQuotationDoc>(QUOTATIONS_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmQuotationUpdateInput,
  ): Promise<SabcrmQuotationDoc> =>
    rustFetch<SabcrmQuotationDoc>(
      `${QUOTATIONS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (
    projectId: string,
    id: string,
  ): Promise<{ ok: boolean; deleted?: boolean }> =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `${QUOTATIONS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ─── Sales orders (`crm-sales-orders`) ───────────────────────── */

export type SabcrmSalesOrderDoc = CrmSalesOrderDoc;
export type SabcrmSalesOrderListParams = CrmSalesOrderListParams;
export type SabcrmSalesOrderCreateInput = Omit<
  CrmSalesOrderCreateInput,
  'projectId'
>;
export type SabcrmSalesOrderUpdateInput = CrmSalesOrderUpdateInput;

const SALES_ORDERS_BASE = '/v1/sabcrm/finance/sales-orders';

export const sabcrmFinanceSalesOrdersApi = {
  list: (
    projectId: string,
    params?: SabcrmSalesOrderListParams,
  ): Promise<SabcrmSalesOrderDoc[]> =>
    rustFetch<SabcrmSalesOrderDoc[]>(
      `${SALES_ORDERS_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        clientId: params?.clientId,
        status: params?.status ? String(params.status) : undefined,
      })}`,
    ),
  getById: (projectId: string, id: string): Promise<SabcrmSalesOrderDoc> =>
    rustFetch<SabcrmSalesOrderDoc>(
      `${SALES_ORDERS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  create: (
    projectId: string,
    input: SabcrmSalesOrderCreateInput,
  ): Promise<SabcrmSalesOrderDoc> =>
    rustFetch<SabcrmSalesOrderDoc>(SALES_ORDERS_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmSalesOrderUpdateInput,
  ): Promise<SabcrmSalesOrderDoc> =>
    rustFetch<SabcrmSalesOrderDoc>(
      `${SALES_ORDERS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (
    projectId: string,
    id: string,
  ): Promise<{ ok: boolean; deleted?: boolean }> =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `${SALES_ORDERS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ─── Credit notes (`crm-credit-notes`) ───────────────────────── */

export type SabcrmCreditNoteDoc = CrmCreditNoteDoc;
export type SabcrmCreditNoteListParams = CrmCreditNoteListParams;
/** Legacy create input has no `projectId`; this client injects it. */
export type SabcrmCreditNoteCreateInput = CrmCreditNoteCreateInput;
export type SabcrmCreditNoteUpdateInput = CrmCreditNoteUpdateInput;

const CREDIT_NOTES_BASE = '/v1/sabcrm/finance/credit-notes';

export const sabcrmFinanceCreditNotesApi = {
  list: (
    projectId: string,
    params?: SabcrmCreditNoteListParams,
  ): Promise<SabcrmCreditNoteDoc[]> =>
    rustFetch<SabcrmCreditNoteDoc[]>(
      `${CREDIT_NOTES_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        clientId: params?.clientId,
        status: params?.status ? String(params.status) : undefined,
      })}`,
    ),
  getById: (projectId: string, id: string): Promise<SabcrmCreditNoteDoc> =>
    rustFetch<SabcrmCreditNoteDoc>(
      `${CREDIT_NOTES_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  create: (
    projectId: string,
    input: SabcrmCreditNoteCreateInput,
  ): Promise<SabcrmCreditNoteDoc> =>
    rustFetch<SabcrmCreditNoteDoc>(CREDIT_NOTES_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmCreditNoteUpdateInput,
  ): Promise<SabcrmCreditNoteDoc> =>
    rustFetch<SabcrmCreditNoteDoc>(
      `${CREDIT_NOTES_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (
    projectId: string,
    id: string,
  ): Promise<{ ok: boolean; deleted?: boolean }> =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `${CREDIT_NOTES_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ─── Debit notes (`crm-debit-notes`) ─────────────────────────── */

export type SabcrmDebitNoteDoc = CrmDebitNoteDoc;
export type SabcrmDebitNoteListParams = CrmDebitNoteListParams;
/** Legacy create input has no `projectId`; this client injects it. */
export type SabcrmDebitNoteCreateInput = CrmDebitNoteCreateInput;
export type SabcrmDebitNoteUpdateInput = CrmDebitNoteUpdateInput;

const DEBIT_NOTES_BASE = '/v1/sabcrm/finance/debit-notes';

export const sabcrmFinanceDebitNotesApi = {
  list: (
    projectId: string,
    params?: SabcrmDebitNoteListParams,
  ): Promise<SabcrmDebitNoteDoc[]> =>
    rustFetch<SabcrmDebitNoteDoc[]>(
      `${DEBIT_NOTES_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        vendorId: params?.vendorId,
        status: params?.status ? String(params.status) : undefined,
      })}`,
    ),
  getById: (projectId: string, id: string): Promise<SabcrmDebitNoteDoc> =>
    rustFetch<SabcrmDebitNoteDoc>(
      `${DEBIT_NOTES_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  create: (
    projectId: string,
    input: SabcrmDebitNoteCreateInput,
  ): Promise<SabcrmDebitNoteDoc> =>
    rustFetch<SabcrmDebitNoteDoc>(DEBIT_NOTES_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmDebitNoteUpdateInput,
  ): Promise<SabcrmDebitNoteDoc> =>
    rustFetch<SabcrmDebitNoteDoc>(
      `${DEBIT_NOTES_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (
    projectId: string,
    id: string,
  ): Promise<{ ok: boolean; deleted?: boolean }> =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `${DEBIT_NOTES_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ─── Payment receipts (`crm-payment-receipts`) ───────────────── */

export type SabcrmPaymentReceiptDoc = CrmPaymentReceiptDoc;
export type SabcrmPaymentReceiptListParams = CrmPaymentReceiptListParams;
export type SabcrmPaymentReceiptCreateInput = Omit<
  CrmPaymentReceiptCreateInput,
  'projectId'
>;
export type SabcrmPaymentReceiptUpdateInput = CrmPaymentReceiptUpdateInput;

const PAYMENT_RECEIPTS_BASE = '/v1/sabcrm/finance/payment-receipts';

export const sabcrmFinancePaymentReceiptsApi = {
  list: (
    projectId: string,
    params?: SabcrmPaymentReceiptListParams,
  ): Promise<SabcrmPaymentReceiptDoc[]> =>
    rustFetch<SabcrmPaymentReceiptDoc[]>(
      `${PAYMENT_RECEIPTS_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        clientId: params?.clientId,
        status: params?.status ? String(params.status) : undefined,
      })}`,
    ),
  getById: (
    projectId: string,
    id: string,
  ): Promise<SabcrmPaymentReceiptDoc> =>
    rustFetch<SabcrmPaymentReceiptDoc>(
      `${PAYMENT_RECEIPTS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  create: (
    projectId: string,
    input: SabcrmPaymentReceiptCreateInput,
  ): Promise<SabcrmPaymentReceiptDoc> =>
    rustFetch<SabcrmPaymentReceiptDoc>(PAYMENT_RECEIPTS_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmPaymentReceiptUpdateInput,
  ): Promise<SabcrmPaymentReceiptDoc> =>
    rustFetch<SabcrmPaymentReceiptDoc>(
      `${PAYMENT_RECEIPTS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (
    projectId: string,
    id: string,
  ): Promise<{ ok: boolean; deleted?: boolean }> =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `${PAYMENT_RECEIPTS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ─── Bills (`crm-bills`) ─────────────────────────────────────── */

export type SabcrmBillDoc = CrmBillDoc;
export type SabcrmBillListParams = CrmBillListParams;
export type SabcrmBillCreateInput = Omit<CrmBillCreateInput, 'projectId'>;
export type SabcrmBillUpdateInput = CrmBillUpdateInput;

const BILLS_BASE = '/v1/sabcrm/finance/bills';

export const sabcrmFinanceBillsApi = {
  list: (
    projectId: string,
    params?: SabcrmBillListParams,
  ): Promise<SabcrmBillDoc[]> =>
    rustFetch<SabcrmBillDoc[]>(
      `${BILLS_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        vendorId: params?.vendorId,
        status: params?.status ? String(params.status) : undefined,
      })}`,
    ),
  getById: (projectId: string, id: string): Promise<SabcrmBillDoc> =>
    rustFetch<SabcrmBillDoc>(
      `${BILLS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  create: (
    projectId: string,
    input: SabcrmBillCreateInput,
  ): Promise<SabcrmBillDoc> =>
    rustFetch<SabcrmBillDoc>(BILLS_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmBillUpdateInput,
  ): Promise<SabcrmBillDoc> =>
    rustFetch<SabcrmBillDoc>(
      `${BILLS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  delete: (
    projectId: string,
    id: string,
  ): Promise<{ ok: boolean; deleted?: boolean }> =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `${BILLS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ─── Proforma invoices (`crm-proforma-invoices`) ─────────────── */

export type SabcrmProformaInvoiceDoc = CrmProformaInvoiceDoc;
export type SabcrmProformaListParams = CrmProformaListParams;
export type SabcrmProformaListResponse = CrmProformaListResponse;
/** Legacy create input has no `projectId`; this client injects it. */
export type SabcrmProformaCreateInput = CrmProformaCreateInput;
export type SabcrmProformaUpdateInput = CrmProformaUpdateInput;

const PROFORMA_BASE = '/v1/sabcrm/finance/proforma-invoices';

export const sabcrmFinanceProformaInvoicesApi = {
  /** NB: crm-common style — list returns `{ items, page, limit, hasMore }`. */
  list: (
    projectId: string,
    params?: SabcrmProformaListParams,
  ): Promise<SabcrmProformaListResponse> =>
    rustFetch<SabcrmProformaListResponse>(
      `${PROFORMA_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status ? String(params.status) : undefined,
        accountId: params?.accountId,
      })}`,
    ),
  getById: (
    projectId: string,
    id: string,
  ): Promise<SabcrmProformaInvoiceDoc> =>
    rustFetch<SabcrmProformaInvoiceDoc>(
      `${PROFORMA_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  /** NB: crm-common style — create returns `{ id, entity }`. */
  create: (
    projectId: string,
    input: SabcrmProformaCreateInput,
  ): Promise<{ id: string; entity: SabcrmProformaInvoiceDoc }> =>
    rustFetch<{ id: string; entity: SabcrmProformaInvoiceDoc }>(
      PROFORMA_BASE,
      { method: 'POST', body: JSON.stringify({ ...input, projectId }) },
    ),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmProformaUpdateInput,
  ): Promise<SabcrmProformaInvoiceDoc> =>
    rustFetch<SabcrmProformaInvoiceDoc>(
      `${PROFORMA_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  /** NB: crm-common style — delete is an archive and returns `{ deleted }`. */
  delete: (projectId: string, id: string): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${PROFORMA_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ─── Payment accounts (`crm-payment-accounts`) ───────────────── */

export type SabcrmPaymentAccountDoc = CrmPaymentAccountDoc;
export type SabcrmPaymentAccountListParams = CrmPaymentAccountListParams;
export type SabcrmPaymentAccountListResponse = CrmPaymentAccountListResponse;
/** Legacy create input has no `projectId`; this client injects it. */
export type SabcrmPaymentAccountCreateInput = CrmPaymentAccountCreateInput;
export type SabcrmPaymentAccountUpdateInput = CrmPaymentAccountUpdateInput;

const PAYMENT_ACCOUNTS_BASE = '/v1/sabcrm/finance/payment-accounts';

export const sabcrmFinancePaymentAccountsApi = {
  /** NB: crm-common style — list returns `{ items, page, limit, hasMore }`. */
  list: (
    projectId: string,
    params?: SabcrmPaymentAccountListParams,
  ): Promise<SabcrmPaymentAccountListResponse> =>
    rustFetch<SabcrmPaymentAccountListResponse>(
      `${PAYMENT_ACCOUNTS_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status ? String(params.status) : undefined,
        accountType: params?.accountType
          ? String(params.accountType)
          : undefined,
      })}`,
    ),
  getById: (
    projectId: string,
    id: string,
  ): Promise<SabcrmPaymentAccountDoc> =>
    rustFetch<SabcrmPaymentAccountDoc>(
      `${PAYMENT_ACCOUNTS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  /** NB: crm-common style — create returns `{ id, entity }`. */
  create: (
    projectId: string,
    input: SabcrmPaymentAccountCreateInput,
  ): Promise<{ id: string; entity: SabcrmPaymentAccountDoc }> =>
    rustFetch<{ id: string; entity: SabcrmPaymentAccountDoc }>(
      PAYMENT_ACCOUNTS_BASE,
      { method: 'POST', body: JSON.stringify({ ...input, projectId }) },
    ),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmPaymentAccountUpdateInput,
  ): Promise<SabcrmPaymentAccountDoc> =>
    rustFetch<SabcrmPaymentAccountDoc>(
      `${PAYMENT_ACCOUNTS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  /** NB: crm-common style — delete is an archive and returns `{ deleted }`. */
  delete: (projectId: string, id: string): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${PAYMENT_ACCOUNTS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ═══════════════════════════════════════════════════════════════════
 * Finance tranche 2 — banking/ledger crates re-mounted under
 * `/v1/sabcrm/finance/*` (each crate's `project_router`). All eight are
 * crm-common-style (list `{ items, page, limit, hasMore }`, create
 * `{ id, entity }`, delete = archive `{ deleted }`) EXCEPT payouts,
 * which keeps its bespoke wire shapes (list = bare array, create =
 * entity, delete = HARD delete `{ ok, deleted }`).
 * ═══════════════════════════════════════════════════════════════════ */


/* ─── Bank transactions (`crm-bank-transactions`) ─────────────── */

export type SabcrmBankTransactionDoc = CrmBankTransactionDoc;
export type SabcrmBankTransactionListParams = CrmBankTransactionListParams;
export type SabcrmBankTransactionListResponse = CrmBankTransactionListResponse;
/** Legacy create input has no `projectId`; this client injects it. */
export type SabcrmBankTransactionCreateInput = CrmBankTransactionCreateInput;
export type SabcrmBankTransactionUpdateInput = CrmBankTransactionUpdateInput;

const BANK_TRANSACTIONS_BASE = '/v1/sabcrm/finance/bank-transactions';

export const sabcrmFinanceBankTransactionsApi = {
  /** NB: crm-common style — list returns `{ items, page, limit, hasMore }`. */
  list: (
    projectId: string,
    params?: SabcrmBankTransactionListParams,
  ): Promise<SabcrmBankTransactionListResponse> =>
    rustFetch<SabcrmBankTransactionListResponse>(
      `${BANK_TRANSACTIONS_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status ? String(params.status) : undefined,
        accountId: params?.accountId,
        type: params?.type ? String(params.type) : undefined,
        category: params?.category,
        from: params?.from,
        to: params?.to,
      })}`,
    ),
  getById: (
    projectId: string,
    id: string,
  ): Promise<SabcrmBankTransactionDoc> =>
    rustFetch<SabcrmBankTransactionDoc>(
      `${BANK_TRANSACTIONS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  /** NB: crm-common style — create returns `{ id, entity }`. */
  create: (
    projectId: string,
    input: SabcrmBankTransactionCreateInput,
  ): Promise<{ id: string; entity: SabcrmBankTransactionDoc }> =>
    rustFetch<{ id: string; entity: SabcrmBankTransactionDoc }>(
      BANK_TRANSACTIONS_BASE,
      { method: 'POST', body: JSON.stringify({ ...input, projectId }) },
    ),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmBankTransactionUpdateInput,
  ): Promise<SabcrmBankTransactionDoc> =>
    rustFetch<SabcrmBankTransactionDoc>(
      `${BANK_TRANSACTIONS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  /** NB: crm-common style — delete is an archive and returns `{ deleted }`. */
  delete: (projectId: string, id: string): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${BANK_TRANSACTIONS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ─── Recurring invoices (`crm-recurring-invoices`) ───────────── */

export type SabcrmRecurringInvoiceDoc = CrmRecurringInvoiceDoc;
export type SabcrmRecurringInvoiceListParams = CrmRecurringInvoiceListParams;
export type SabcrmRecurringInvoiceListResponse =
  CrmRecurringInvoiceListResponse;
/** Legacy create input has no `projectId`; this client injects it. */
export type SabcrmRecurringInvoiceCreateInput = CrmRecurringInvoiceCreateInput;
export type SabcrmRecurringInvoiceUpdateInput = CrmRecurringInvoiceUpdateInput;

const RECURRING_INVOICES_BASE = '/v1/sabcrm/finance/recurring-invoices';

export const sabcrmFinanceRecurringInvoicesApi = {
  /** NB: crm-common style — list returns `{ items, page, limit, hasMore }`. */
  list: (
    projectId: string,
    params?: SabcrmRecurringInvoiceListParams,
  ): Promise<SabcrmRecurringInvoiceListResponse> =>
    rustFetch<SabcrmRecurringInvoiceListResponse>(
      `${RECURRING_INVOICES_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status ? String(params.status) : undefined,
      })}`,
    ),
  getById: (
    projectId: string,
    id: string,
  ): Promise<SabcrmRecurringInvoiceDoc> =>
    rustFetch<SabcrmRecurringInvoiceDoc>(
      `${RECURRING_INVOICES_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  /** NB: crm-common style — create returns `{ id, entity }`. */
  create: (
    projectId: string,
    input: SabcrmRecurringInvoiceCreateInput,
  ): Promise<{ id: string; entity: SabcrmRecurringInvoiceDoc }> =>
    rustFetch<{ id: string; entity: SabcrmRecurringInvoiceDoc }>(
      RECURRING_INVOICES_BASE,
      { method: 'POST', body: JSON.stringify({ ...input, projectId }) },
    ),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmRecurringInvoiceUpdateInput,
  ): Promise<SabcrmRecurringInvoiceDoc> =>
    rustFetch<SabcrmRecurringInvoiceDoc>(
      `${RECURRING_INVOICES_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  /** NB: crm-common style — delete is an archive and returns `{ deleted }`. */
  delete: (projectId: string, id: string): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${RECURRING_INVOICES_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ─── Expenses (`crm-expense-claims`) ─────────────────────────── */

export type SabcrmExpenseClaimDoc = CrmExpenseClaimDoc;
export type SabcrmExpenseClaimListParams = CrmExpenseClaimListParams;
export type SabcrmExpenseClaimListResponse = CrmExpenseClaimListResponse;
/**
 * Legacy create input has no project scope; this client injects it. NB:
 * this crate's create/update bodies are snake_case on the wire, so the
 * tenancy key is injected as `project_id` (NOT `projectId`).
 */
export type SabcrmExpenseClaimCreateInput = CrmExpenseClaimCreateInput;
export type SabcrmExpenseClaimUpdateInput = CrmExpenseClaimUpdateInput;

const EXPENSES_BASE = '/v1/sabcrm/finance/expenses';

export const sabcrmFinanceExpensesApi = {
  /** NB: crm-common style — list returns `{ items, page, limit, hasMore }`. */
  list: (
    projectId: string,
    params?: SabcrmExpenseClaimListParams,
  ): Promise<SabcrmExpenseClaimListResponse> =>
    rustFetch<SabcrmExpenseClaimListResponse>(
      `${EXPENSES_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status ? String(params.status) : undefined,
        employeeId: params?.employeeId,
        categoryId: params?.categoryId,
      })}`,
    ),
  getById: (projectId: string, id: string): Promise<SabcrmExpenseClaimDoc> =>
    rustFetch<SabcrmExpenseClaimDoc>(
      `${EXPENSES_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  /** NB: crm-common style — create returns `{ id, entity }`. */
  create: (
    projectId: string,
    input: SabcrmExpenseClaimCreateInput,
  ): Promise<{ id: string; entity: SabcrmExpenseClaimDoc }> =>
    rustFetch<{ id: string; entity: SabcrmExpenseClaimDoc }>(EXPENSES_BASE, {
      method: 'POST',
      // snake_case body — see SabcrmExpenseClaimCreateInput note.
      body: JSON.stringify({ ...input, project_id: projectId }),
    }),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmExpenseClaimUpdateInput,
  ): Promise<SabcrmExpenseClaimDoc> =>
    rustFetch<SabcrmExpenseClaimDoc>(
      `${EXPENSES_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  /** NB: crm-common style — delete is an archive and returns `{ deleted }`. */
  delete: (projectId: string, id: string): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${EXPENSES_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ─── Payouts (`crm-payouts`) ─────────────────────────────────── */

export type SabcrmPayoutDoc = CrmPayoutDoc;
export type SabcrmPayoutListParams = CrmPayoutListParams;
export type SabcrmPayoutCreateInput = Omit<CrmPayoutCreateInput, 'projectId'>;
export type SabcrmPayoutUpdateInput = CrmPayoutUpdateInput;

const PAYOUTS_BASE = '/v1/sabcrm/finance/payouts';

export const sabcrmFinancePayoutsApi = {
  /** NB: payout style — list returns a bare array. */
  list: (
    projectId: string,
    params?: SabcrmPayoutListParams,
  ): Promise<SabcrmPayoutDoc[]> =>
    rustFetch<SabcrmPayoutDoc[]>(
      `${PAYOUTS_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        vendorId: params?.vendorId,
        status: params?.status ? String(params.status) : undefined,
      })}`,
    ),
  getById: (projectId: string, id: string): Promise<SabcrmPayoutDoc> =>
    rustFetch<SabcrmPayoutDoc>(
      `${PAYOUTS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  /** NB: payout style — create returns the full entity. */
  create: (
    projectId: string,
    input: SabcrmPayoutCreateInput,
  ): Promise<SabcrmPayoutDoc> =>
    rustFetch<SabcrmPayoutDoc>(PAYOUTS_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmPayoutUpdateInput,
  ): Promise<SabcrmPayoutDoc> =>
    rustFetch<SabcrmPayoutDoc>(
      `${PAYOUTS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  /** NB: payout style — HARD delete, returns `{ ok, deleted }`. */
  delete: (
    projectId: string,
    id: string,
  ): Promise<{ ok: boolean; deleted?: boolean }> =>
    rustFetch<{ ok: boolean; deleted?: boolean }>(
      `${PAYOUTS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ─── Voucher books (`crm-vouchers`) ──────────────────────────── */

export type SabcrmVoucherBookDoc = CrmVoucherBookDoc;
export type SabcrmVoucherBookListParams = CrmVoucherBookListParams;
export type SabcrmVoucherBookListResponse = CrmVoucherBookListResponse;
/** Legacy create input has no `projectId`; this client injects it. */
export type SabcrmVoucherBookCreateInput = CrmVoucherBookCreateInput;
export type SabcrmVoucherBookUpdateInput = CrmVoucherBookUpdateInput;

const VOUCHERS_BASE = '/v1/sabcrm/finance/vouchers';

export const sabcrmFinanceVouchersApi = {
  /** NB: crm-common style — list returns `{ items, page, limit, hasMore }`. */
  list: (
    projectId: string,
    params?: SabcrmVoucherBookListParams,
  ): Promise<SabcrmVoucherBookListResponse> =>
    rustFetch<SabcrmVoucherBookListResponse>(
      `${VOUCHERS_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status ? String(params.status) : undefined,
        type: params?.type,
      })}`,
    ),
  getById: (projectId: string, id: string): Promise<SabcrmVoucherBookDoc> =>
    rustFetch<SabcrmVoucherBookDoc>(
      `${VOUCHERS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  /** NB: crm-common style — create returns `{ id, entity }`. */
  create: (
    projectId: string,
    input: SabcrmVoucherBookCreateInput,
  ): Promise<{ id: string; entity: SabcrmVoucherBookDoc }> =>
    rustFetch<{ id: string; entity: SabcrmVoucherBookDoc }>(VOUCHERS_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmVoucherBookUpdateInput,
  ): Promise<SabcrmVoucherBookDoc> =>
    rustFetch<SabcrmVoucherBookDoc>(
      `${VOUCHERS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  /** NB: crm-common style — delete is an archive and returns `{ deleted }`. */
  delete: (projectId: string, id: string): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${VOUCHERS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ─── Petty cash floats (`crm-petty-cash`) ────────────────────── */

export type SabcrmPettyCashFloatDoc = CrmPettyCashFloatDoc;
export type SabcrmPettyCashListParams = CrmPettyCashListParams;
export type SabcrmPettyCashListResponse = CrmPettyCashListResponse;
/** Legacy create input has no `projectId`; this client injects it. */
export type SabcrmPettyCashCreateInput = CrmPettyCashCreateInput;
export type SabcrmPettyCashUpdateInput = CrmPettyCashUpdateInput;

const PETTY_CASH_BASE = '/v1/sabcrm/finance/petty-cash';

export const sabcrmFinancePettyCashApi = {
  /** NB: crm-common style — list returns `{ items, page, limit, hasMore }`. */
  list: (
    projectId: string,
    params?: SabcrmPettyCashListParams,
  ): Promise<SabcrmPettyCashListResponse> =>
    rustFetch<SabcrmPettyCashListResponse>(
      `${PETTY_CASH_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status ? String(params.status) : undefined,
        branchName: params?.branchName,
      })}`,
    ),
  getById: (
    projectId: string,
    id: string,
  ): Promise<SabcrmPettyCashFloatDoc> =>
    rustFetch<SabcrmPettyCashFloatDoc>(
      `${PETTY_CASH_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  /** NB: crm-common style — create returns `{ id, entity }`. */
  create: (
    projectId: string,
    input: SabcrmPettyCashCreateInput,
  ): Promise<{ id: string; entity: SabcrmPettyCashFloatDoc }> =>
    rustFetch<{ id: string; entity: SabcrmPettyCashFloatDoc }>(
      PETTY_CASH_BASE,
      { method: 'POST', body: JSON.stringify({ ...input, projectId }) },
    ),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmPettyCashUpdateInput,
  ): Promise<SabcrmPettyCashFloatDoc> =>
    rustFetch<SabcrmPettyCashFloatDoc>(
      `${PETTY_CASH_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  /** NB: crm-common style — delete is an archive and returns `{ deleted }`. */
  delete: (projectId: string, id: string): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${PETTY_CASH_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ─── Budgets (`crm-budgets`) ─────────────────────────────────── */

export type SabcrmBudgetDoc = CrmBudgetDoc;
export type SabcrmBudgetListParams = CrmBudgetListParams;
export type SabcrmBudgetListResponse = CrmBudgetListResponse;
/**
 * Legacy budgets use `projectId` as a BUSINESS field ("budget for CRM
 * project X"); on this mount the same field is the tenancy key, so it is
 * stripped from the input and injected by the client. The Rust side also
 * ignores `projectId` patches on this mount.
 */
export type SabcrmBudgetCreateInput = Omit<CrmBudgetCreateInput, 'projectId'>;
export type SabcrmBudgetUpdateInput = Omit<CrmBudgetUpdateInput, 'projectId'>;

const BUDGETS_BASE = '/v1/sabcrm/finance/budgets';

export const sabcrmFinanceBudgetsApi = {
  /** NB: crm-common style — list returns `{ items, page, limit, hasMore }`. */
  list: (
    projectId: string,
    params?: SabcrmBudgetListParams,
  ): Promise<SabcrmBudgetListResponse> =>
    rustFetch<SabcrmBudgetListResponse>(
      `${BUDGETS_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status ? String(params.status) : undefined,
        department: params?.department,
        period: params?.period,
      })}`,
    ),
  getById: (projectId: string, id: string): Promise<SabcrmBudgetDoc> =>
    rustFetch<SabcrmBudgetDoc>(
      `${BUDGETS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  /** NB: crm-common style — create returns `{ id, entity }`. */
  create: (
    projectId: string,
    input: SabcrmBudgetCreateInput,
  ): Promise<{ id: string; entity: SabcrmBudgetDoc }> =>
    rustFetch<{ id: string; entity: SabcrmBudgetDoc }>(BUDGETS_BASE, {
      method: 'POST',
      body: JSON.stringify({ ...input, projectId }),
    }),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmBudgetUpdateInput,
  ): Promise<SabcrmBudgetDoc> =>
    rustFetch<SabcrmBudgetDoc>(
      `${BUDGETS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  /** NB: crm-common style — delete is an archive and returns `{ deleted }`. */
  delete: (projectId: string, id: string): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${BUDGETS_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};

/* ─── Reconciliation (`crm-reconciliation`) ───────────────────── */

export type SabcrmReconciliationDoc = CrmReconciliationDoc;
export type SabcrmReconciliationListParams = CrmReconciliationListParams;
export type SabcrmReconciliationListResponse = CrmReconciliationListResponse;
/** Legacy create input has no `projectId`; this client injects it. */
export type SabcrmReconciliationCreateInput = CrmReconciliationCreateInput;
export type SabcrmReconciliationUpdateInput = CrmReconciliationUpdateInput;

const RECONCILIATION_BASE = '/v1/sabcrm/finance/reconciliation';

export const sabcrmFinanceReconciliationApi = {
  /** NB: crm-common style — list returns `{ items, page, limit, hasMore }`. */
  list: (
    projectId: string,
    params?: SabcrmReconciliationListParams,
  ): Promise<SabcrmReconciliationListResponse> =>
    rustFetch<SabcrmReconciliationListResponse>(
      `${RECONCILIATION_BASE}${qs({
        projectId,
        page: params?.page,
        limit: params?.limit,
        q: params?.q,
        status: params?.status ? String(params.status) : undefined,
        accountId: params?.accountId,
      })}`,
    ),
  getById: (
    projectId: string,
    id: string,
  ): Promise<SabcrmReconciliationDoc> =>
    rustFetch<SabcrmReconciliationDoc>(
      `${RECONCILIATION_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
    ),
  /** NB: crm-common style — create returns `{ id, entity }`. */
  create: (
    projectId: string,
    input: SabcrmReconciliationCreateInput,
  ): Promise<{ id: string; entity: SabcrmReconciliationDoc }> =>
    rustFetch<{ id: string; entity: SabcrmReconciliationDoc }>(
      RECONCILIATION_BASE,
      { method: 'POST', body: JSON.stringify({ ...input, projectId }) },
    ),
  update: (
    projectId: string,
    id: string,
    patch: SabcrmReconciliationUpdateInput,
  ): Promise<SabcrmReconciliationDoc> =>
    rustFetch<SabcrmReconciliationDoc>(
      `${RECONCILIATION_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'PATCH', body: JSON.stringify(patch) },
    ),
  /** NB: crm-common style — delete is an archive and returns `{ deleted }`. */
  delete: (projectId: string, id: string): Promise<{ deleted: boolean }> =>
    rustFetch<{ deleted: boolean }>(
      `${RECONCILIATION_BASE}/${encodeURIComponent(id)}${qs({ projectId })}`,
      { method: 'DELETE' },
    ),
};
