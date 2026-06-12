'use server';

/**
 * SabCRM Finance — payment-receipt surface server actions.
 *
 * Full doc-surface adoption for `/sabcrm/finance/payment-receipts`
 * (finance-rollout spec §3.7): paged display-ready list rows (party AND
 * payment-account labels batch-resolved — never raw ObjectIds, never
 * N+1), KPI strip, capped CSV export, RCPT- numbering, full-form
 * create with invoice allocations (folds `amountPaid`/status onto each
 * applied invoice the same way `recordSabcrmInvoicePayment` does),
 * G4-locked edit patch, status transitions and the detail page's
 * related rail (lineage parents + resolved allocation table).
 *
 * Rust wire traps honoured here:
 *   - the receipts list is 1-INDEXED and returns a bare array
 *     (`skip = (page-1)*limit`) — unlike the crm-common crates;
 *   - `CreatePaymentReceiptInput` accepts neither `exchangeRate` nor
 *     `attachments`; both ride a follow-up PATCH;
 *   - the edit form keeps `amount`/`mode`/`applyTo`/`clientId`/
 *     `currency` locked per the spec (invoice reconciliation on
 *     mutation is a follow-up).
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * its siblings; engine failures normalise into `{ ok: false, error }`.
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
  sabcrmFinancePaymentAccountsApi,
  sabcrmFinancePaymentReceiptsApi,
  sabcrmFinanceProformaInvoicesApi,
  type SabcrmPaymentReceiptDoc,
  type SabcrmPaymentReceiptUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type {
  CrmPaymentMode,
  CrmReceiptStatus,
} from '@/lib/rust-client/crm-payment-receipts';
import type { CrmInvoiceStatus } from '@/lib/rust-client/crm-invoices';
import { round2 } from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import { resolveSabcrmFinanceParties } from './sabcrm-finance-invoices.actions';
import type {
  SabcrmDocAttachmentInput,
  SabcrmPartyRef,
  SabcrmRelatedDocRef,
} from './sabcrm-finance-invoices.actions.types';
import {
  SABCRM_RECEIPT_TRANSITIONS,
  type SabcrmReceiptAllocationRef,
  type SabcrmReceiptFullInput,
  type SabcrmReceiptFullPatch,
  type SabcrmReceiptKpis,
  type SabcrmReceiptListFilters,
  type SabcrmReceiptListPage,
  type SabcrmReceiptListRow,
  type SabcrmReceiptRelated,
} from './sabcrm-finance-payment-receipts.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const RECEIPTS_PATH = '/sabcrm/finance/payment-receipts';

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

/** Coerce a `YYYY-MM-DD` / ISO date string into a full RFC3339 instant. */
function toIso(raw: string): string | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/* ─── Shared lookups (batched — never per-row) ─────────────────── */

const PAYMENT_MODES: ReadonlySet<CrmPaymentMode> = new Set([
  'cash',
  'cheque',
  'upi',
  'neft',
  'rtgs',
  'imps',
  'card',
  'wallet',
]);

const RECEIPT_STATUSES: ReadonlySet<CrmReceiptStatus> = new Set([
  'received',
  'cleared',
  'bounced',
]);

/**
 * ONE payment-accounts list call → id → name map for row labels.
 * Capped at 100 accounts (the crate's MAX_LIMIT) — receipts pointing at
 * accounts beyond the cap simply render the muted fallback.
 */
async function accountLabelMap(
  projectId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await sabcrmFinancePaymentAccountsApi.list(projectId, {
      limit: 100,
      status: 'all',
    });
    for (const acc of res.items) {
      if (acc._id) map.set(String(acc._id), acc.accountName || 'Unnamed account');
    }
  } catch {
    // Accounts engine down — rows render without account labels.
  }
  return map;
}

async function partyLabelMap(
  ids: string[],
  projectId: string,
): Promise<Map<string, SabcrmPartyRef>> {
  const map = new Map<string, SabcrmPartyRef>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  const refs = await resolveSabcrmFinanceParties(unique, projectId);
  if (refs.ok) for (const ref of refs.data) map.set(ref.id, ref);
  return map;
}

function toListRow(
  doc: SabcrmPaymentReceiptDoc,
  parties: Map<string, SabcrmPartyRef>,
  accounts: Map<string, string>,
): SabcrmReceiptListRow {
  const party = doc.clientId ? parties.get(doc.clientId) : undefined;
  return {
    id: doc._id,
    receiptNo: doc.receiptNo,
    partyId: doc.clientId ?? '',
    partyLabel: party?.label ?? null,
    partyObjectSlug: party?.objectSlug ?? null,
    date: doc.date,
    mode: doc.mode,
    bankAccountId: doc.bankAccountId ?? '',
    bankAccountLabel: doc.bankAccountId
      ? (accounts.get(doc.bankAccountId) ?? null)
      : null,
    amount: doc.amount ?? 0,
    currency: doc.currency || 'INR',
    tdsDeducted: doc.tdsDeducted ?? 0,
    bankCharges: doc.bankCharges ?? 0,
    allocationCount: (doc.applyTo ?? []).length,
    status: (doc.status ?? 'received') as CrmReceiptStatus,
  };
}

/** In-page inclusive date refinement (the crate has no from/to filter). */
function refineByDate<T extends { date?: string }>(
  docs: T[],
  from?: string,
  to?: string,
): T[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.date ?? '').slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

/* ─── List page (display-ready rows) ───────────────────────────── */

/**
 * Lists a page of display-ready receipt rows; party + account labels
 * resolve in two batched passes (zero per-row lookups).
 *
 * Pagination: this crate is 1-INDEXED with `skip = (page-1)*limit`, so
 * we request exactly `limit` rows and derive `hasMore` from a full page
 * (same contract as the invoices flagship).
 */
export async function listSabcrmPaymentReceiptsPage(
  filters: SabcrmReceiptListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmReceiptListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const docs = await sabcrmFinancePaymentReceiptsApi.list(g.ctx.projectId, {
      page,
      limit,
      q: filters.q || undefined,
      clientId: filters.clientId || undefined,
      status: filters.status || undefined,
    });

    const pageDocs = refineByDate(docs, filters.from, filters.to);
    const hasMore = docs.length === limit;

    const [parties, accounts] = await Promise.all([
      partyLabelMap(
        pageDocs.map((d) => d.clientId).filter(Boolean),
        g.ctx.projectId,
      ),
      accountLabelMap(g.ctx.projectId),
    ]);

    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, parties, accounts)),
        page,
        hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list payment receipts.');
  }
}

/** Pages the list endpoint scans for KPIs/export (100 docs each). */
const SCAN_MAX_PAGES = 5;

/**
 * Fetch-all (capped at 500) for CSV export, honouring the current
 * filters. Returns display-ready rows so the CSV never contains ids.
 */
export async function exportSabcrmPaymentReceiptRows(
  filters: SabcrmReceiptListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmReceiptListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmPaymentReceiptDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const batch = await sabcrmFinancePaymentReceiptsApi.list(
        g.ctx.projectId,
        {
          page,
          limit: 100,
          q: filters.q || undefined,
          clientId: filters.clientId || undefined,
          status: filters.status || undefined,
        },
      );
      docs.push(...batch);
      if (batch.length < 100) break;
    }
    const rows = refineByDate(docs, filters.from, filters.to);
    const [parties, accounts] = await Promise.all([
      partyLabelMap(
        rows.map((d) => d.clientId).filter(Boolean),
        g.ctx.projectId,
      ),
      accountLabelMap(g.ctx.projectId),
    ]);
    return {
      ok: true,
      data: rows.map((d) => toListRow(d, parties, accounts)),
    };
  } catch (e) {
    return fail(e, 'Failed to export payment receipts.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/** Indian FY start (Apr 1) for the TDS year-to-date KPI. */
function fyStartKey(now: Date): string {
  const y =
    now.getUTCMonth() + 1 >= 4 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${y}-04-01`;
}

/**
 * KPI strip over a capped scan (up to 500 most recent receipts):
 * collected this month, uncleared total, bounced count, TDS deducted
 * FY-to-date. `sampled: true` flags a capped result.
 */
export async function getSabcrmPaymentReceiptKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmReceiptKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmPaymentReceiptDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const batch = await sabcrmFinancePaymentReceiptsApi.list(
        g.ctx.projectId,
        { page, limit: 100 },
      );
      docs.push(...batch);
      if (batch.length < 100) break;
      if (page === SCAN_MAX_PAGES) sampled = true;
    }

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const fyStart = fyStartKey(now);
    const currencyVotes = new Map<string, number>();
    let collectedThisMonth = 0;
    let collectedThisMonthCount = 0;
    let unclearedTotal = 0;
    let unclearedCount = 0;
    let bouncedCount = 0;
    let tdsFyToDate = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'received') as CrmReceiptStatus;
      const amount = doc.amount ?? 0;
      const currency = doc.currency || 'INR';
      const day = (doc.date ?? '').slice(0, 10);
      currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);

      if (status === 'bounced') {
        bouncedCount += 1;
      } else {
        if (day.slice(0, 7) === monthKey) {
          collectedThisMonth += amount;
          collectedThisMonthCount += 1;
        }
        if (day >= fyStart) tdsFyToDate += doc.tdsDeducted ?? 0;
      }
      if (status === 'received') {
        unclearedTotal += amount;
        unclearedCount += 1;
      }
    }

    let currency = 'INR';
    let votes = -1;
    for (const [code, n] of currencyVotes) {
      if (n > votes) {
        currency = code;
        votes = n;
      }
    }

    return {
      ok: true,
      data: {
        currency,
        collectedThisMonth: round2(collectedThisMonth),
        collectedThisMonthCount,
        unclearedTotal: round2(unclearedTotal),
        unclearedCount,
        bouncedCount,
        tdsFyToDate: round2(tdsFyToDate),
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute receipt KPIs.');
  }
}

/* ─── Numbering ────────────────────────────────────────────────── */

/**
 * Suggests the next receipt number from the latest documents: highest
 * numeric suffix + 1, preserving prefix + zero-padding. First receipt ⇒
 * `RCPT-<year>-0001`.
 */
export async function getNextSabcrmPaymentReceiptNumber(
  projectId?: string,
): Promise<ActionResult<string>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await sabcrmFinancePaymentReceiptsApi.list(g.ctx.projectId, {
      page: 1,
      limit: 100,
    });
    let best: { prefix: string; num: number; width: number } | null = null;
    for (const doc of docs) {
      const m = /^(.*?)(\d+)\s*$/.exec(doc.receiptNo ?? '');
      if (!m) continue;
      const num = Number(m[2]);
      if (!Number.isFinite(num)) continue;
      if (!best || num > best.num) {
        best = { prefix: m[1], num, width: m[2].length };
      }
    }
    if (!best) {
      return { ok: true, data: `RCPT-${new Date().getUTCFullYear()}-0001` };
    }
    const next = String(best.num + 1).padStart(best.width, '0');
    return { ok: true, data: `${best.prefix}${next}` };
  } catch (e) {
    return fail(e, 'Failed to suggest a receipt number.');
  }
}

/* ─── Single document ──────────────────────────────────────────── */

/** Fetches one receipt (detail page). */
export async function getSabcrmPaymentReceiptFull(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentReceiptDoc>> {
  if (!id) return { ok: false, error: 'Receipt id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmFinancePaymentReceiptsApi.getById(
      g.ctx.projectId,
      id,
    );
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the payment receipt.');
  }
}

/* ─── Create (full form) ───────────────────────────────────────── */

/** Validates + narrows the attachments payload (SabFiles pointers only). */
function cleanAttachments(
  attachments: SabcrmDocAttachmentInput[] | undefined,
): SabcrmDocAttachmentInput[] | undefined {
  if (!attachments) return undefined;
  return attachments
    .filter((a) => a.fileId && ObjectId.isValid(a.fileId))
    .map((a) => ({
      fileId: a.fileId,
      name: a.name || undefined,
      mimeType: a.mimeType || undefined,
      size: a.size,
    }));
}

/** Non-negative finite money field (TDS / bank charges). */
function cleanMoney(
  v: number | undefined,
  label: string,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (v === undefined) return { ok: true, value: undefined };
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: `${label} can't be negative.` };
  }
  return { ok: true, value: round2(n) };
}

/**
 * Folds an allocation onto its invoice: bumps `amountPaid` and flips
 * the status to paid / partially_paid (same math as
 * `recordSabcrmInvoicePayment`). Best-effort per invoice — a missing or
 * non-payable invoice never fails the receipt itself.
 */
async function foldAllocationsOntoInvoices(
  projectId: string,
  applyTo: { invoiceId: string; amount: number }[],
): Promise<void> {
  await Promise.all(
    applyTo.map(async ({ invoiceId, amount }) => {
      try {
        const invoice = await sabcrmFinanceApi.getInvoice(projectId, invoiceId);
        const status = (invoice.status ?? 'draft') as CrmInvoiceStatus;
        if (status === 'draft' || status === 'cancelled' || status === 'paid') {
          return;
        }
        const total = invoice.totals?.total ?? 0;
        const newPaid = round2((invoice.amountPaid ?? 0) + amount);
        const nextStatus: CrmInvoiceStatus =
          newPaid + 0.005 >= total ? 'paid' : 'partially_paid';
        await sabcrmFinanceApi.updateInvoice(projectId, invoiceId, {
          amountPaid: newPaid,
          status: nextStatus,
        });
      } catch {
        // Invoice gone or engine hiccup — the receipt still stands.
      }
    }),
  );
}

/**
 * Creates a receipt from the FULL form: real picked customer + payment
 * account, validated mode/allocations, then folds every allocation onto
 * its invoice. `exchangeRate`/`attachments` ride a follow-up PATCH (the
 * create DTO doesn't accept them).
 */
export async function createSabcrmPaymentReceiptFull(
  input: SabcrmReceiptFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentReceiptDoc>> {
  if (!input?.receiptNo?.trim()) {
    return { ok: false, error: 'A receipt number is required.' };
  }
  if (!input.clientId || !ObjectId.isValid(input.clientId)) {
    return { ok: false, error: 'Pick a customer for this receipt.' };
  }
  if (!PAYMENT_MODES.has(input.mode)) {
    return { ok: false, error: 'Pick a valid payment mode.' };
  }
  if (!input.bankAccountId || !ObjectId.isValid(input.bankAccountId)) {
    return { ok: false, error: 'Pick the account that received this payment.' };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Amount must be greater than zero.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid receipt date is required.' };
  let chequeDateIso: string | undefined;
  if (input.chequeDate) {
    const iso = toIso(input.chequeDate);
    if (!iso) return { ok: false, error: 'The cheque date is invalid.' };
    chequeDateIso = iso;
  }
  if (input.exchangeRate !== undefined) {
    const rate = Number(input.exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      return { ok: false, error: 'The exchange rate must be greater than zero.' };
    }
  }
  const tds = cleanMoney(input.tdsDeducted, 'TDS deducted');
  if (!tds.ok) return { ok: false, error: tds.error };
  const charges = cleanMoney(input.bankCharges, 'Bank charges');
  if (!charges.ok) return { ok: false, error: charges.error };

  // Allocation rows: every row needs a REAL invoice id + positive amount,
  // and the sum can never exceed the receipt amount.
  const applyTo = (input.applyTo ?? []).map((row) => ({
    invoiceId: row.invoiceId,
    amount: round2(Number(row.amount)),
  }));
  for (const row of applyTo) {
    if (!row.invoiceId || !ObjectId.isValid(row.invoiceId)) {
      return { ok: false, error: 'Every allocation row needs an invoice.' };
    }
    if (!Number.isFinite(row.amount) || row.amount <= 0) {
      return {
        ok: false,
        error: 'Every allocation amount must be greater than zero.',
      };
    }
  }
  const allocated = round2(applyTo.reduce((s, r) => s + r.amount, 0));
  if (allocated > round2(amount) + 0.005) {
    return {
      ok: false,
      error: 'The allocations exceed the amount received.',
    };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinancePaymentReceiptsApi.create(
      g.ctx.projectId,
      {
        receiptNo: input.receiptNo.trim(),
        date: dateIso,
        clientId: input.clientId,
        mode: input.mode,
        bankAccountId: input.bankAccountId,
        amount: round2(amount),
        currency: input.currency.trim().toUpperCase(),
        chequeNo: input.chequeNo?.trim() || undefined,
        chequeDate: chequeDateIso,
        txnId: input.txnId?.trim() || undefined,
        reference: input.reference?.trim() || undefined,
        applyTo,
        excessAsAdvance: !!input.excessAsAdvance,
        tdsDeducted: tds.value,
        bankCharges: charges.value,
        notes: input.notes?.trim() || undefined,
        fromKind: input.fromKind,
        fromId:
          input.fromId && ObjectId.isValid(input.fromId)
            ? input.fromId
            : undefined,
      },
    );

    // Create-DTO gap: exchangeRate + attachments only exist on the
    // update DTO — follow up with one PATCH when either is set.
    let result = created;
    const attachments = cleanAttachments(input.attachments);
    if (input.exchangeRate !== undefined || attachments?.length) {
      try {
        const followUp: SabcrmPaymentReceiptUpdateInput & {
          exchangeRate?: number;
          attachments?: SabcrmDocAttachmentInput[];
        } = {};
        if (input.exchangeRate !== undefined) {
          followUp.exchangeRate = input.exchangeRate;
        }
        if (attachments?.length) followUp.attachments = attachments;
        result = await sabcrmFinancePaymentReceiptsApi.update(
          g.ctx.projectId,
          created._id,
          followUp,
        );
      } catch {
        // Non-fatal — the receipt exists; only the extras PATCH failed.
      }
    }

    if (applyTo.length > 0) {
      await foldAllocationsOntoInvoices(g.ctx.projectId, applyTo);
    }

    revalidatePath(RECEIPTS_PATH);
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to create the payment receipt.');
  }
}

/* ─── Update (G4-locked edit form) ─────────────────────────────── */

/**
 * Edit-mode patch — financial identity fields (`amount`, `mode`,
 * `applyTo`, `clientId`, `currency`) stay locked per the spec; only
 * the document plumbing is patchable here.
 */
export async function updateSabcrmPaymentReceiptFull(
  id: string,
  patch: SabcrmReceiptFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentReceiptDoc>> {
  if (!id) return { ok: false, error: 'Receipt id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmPaymentReceiptUpdateInput & {
    exchangeRate?: number;
    attachments?: SabcrmDocAttachmentInput[];
  } = {};
  if (patch.receiptNo !== undefined) {
    if (!patch.receiptNo.trim()) {
      return { ok: false, error: 'A receipt number is required.' };
    }
    wire.receiptNo = patch.receiptNo.trim();
  }
  if (patch.date !== undefined) {
    const iso = toIso(patch.date);
    if (!iso) return { ok: false, error: 'The receipt date is invalid.' };
    wire.date = iso;
  }
  if (patch.bankAccountId !== undefined) {
    if (!patch.bankAccountId || !ObjectId.isValid(patch.bankAccountId)) {
      return {
        ok: false,
        error: 'Pick the account that received this payment.',
      };
    }
    wire.bankAccountId = patch.bankAccountId;
  }
  if (patch.chequeNo !== undefined) wire.chequeNo = patch.chequeNo;
  if (patch.chequeDate !== undefined) {
    if (patch.chequeDate === '') {
      // Wire can't unset — leave absent (cosmetic; the cheque fields
      // only render for cheque-mode receipts anyway).
    } else {
      const iso = toIso(patch.chequeDate);
      if (!iso) return { ok: false, error: 'The cheque date is invalid.' };
      wire.chequeDate = iso;
    }
  }
  if (patch.txnId !== undefined) wire.txnId = patch.txnId;
  if (patch.reference !== undefined) wire.reference = patch.reference;
  if (patch.exchangeRate !== undefined) {
    const rate = Number(patch.exchangeRate);
    if (!Number.isFinite(rate) || rate <= 0) {
      return { ok: false, error: 'The exchange rate must be greater than zero.' };
    }
    wire.exchangeRate = rate;
  }
  if (patch.tdsDeducted !== undefined) {
    const tds = cleanMoney(patch.tdsDeducted, 'TDS deducted');
    if (!tds.ok) return { ok: false, error: tds.error };
    wire.tdsDeducted = tds.value;
  }
  if (patch.bankCharges !== undefined) {
    const charges = cleanMoney(patch.bankCharges, 'Bank charges');
    if (!charges.ok) return { ok: false, error: charges.error };
    wire.bankCharges = charges.value;
  }
  if (patch.notes !== undefined) wire.notes = patch.notes;
  if (patch.attachments !== undefined) {
    wire.attachments = cleanAttachments(patch.attachments) ?? [];
  }
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmFinancePaymentReceiptsApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(RECEIPTS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the payment receipt.');
  }
}

/* ─── Status transitions ───────────────────────────────────────── */

/**
 * Applies a workflow transition (received → cleared/bounced, bounced →
 * received), validated against the crate vocabulary AND the
 * allowed-transition map.
 */
export async function transitionSabcrmPaymentReceiptStatus(
  id: string,
  next: CrmReceiptStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentReceiptDoc>> {
  if (!id) return { ok: false, error: 'Receipt id is required.' };
  if (!RECEIPT_STATUSES.has(next)) {
    return { ok: false, error: 'Invalid receipt status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmFinancePaymentReceiptsApi.getById(
      g.ctx.projectId,
      id,
    );
    const from = (current.status ?? 'received') as CrmReceiptStatus;
    if (!SABCRM_RECEIPT_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a receipt from "${from}" to "${next}".`,
      };
    }
    const data = await sabcrmFinancePaymentReceiptsApi.update(
      g.ctx.projectId,
      id,
      { status: next },
    );
    revalidatePath(RECEIPTS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the receipt status.');
  }
}

/* ─── Related documents (lineage rail + allocation card) ───────── */

const INVOICE_DETAIL_BASE = '/sabcrm/finance/invoices';

/**
 * Builds the detail rail: lineage PARENTS (invoice / proforma resolved
 * to their doc numbers) plus the `applyTo` allocation table with every
 * invoice resolved to a number + detail link (batched by unique id).
 */
export async function getSabcrmPaymentReceiptRelated(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmReceiptRelated>> {
  if (!id) return { ok: false, error: 'Receipt id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const receipt = await sabcrmFinancePaymentReceiptsApi.getById(
      g.ctx.projectId,
      id,
    );

    // One getInvoice per UNIQUE invoice id across lineage + applyTo.
    const invoiceIds = new Set<string>();
    for (const ref of receipt.lineage ?? []) {
      if (ref.kind === 'invoice' && ObjectId.isValid(ref.id)) {
        invoiceIds.add(ref.id);
      }
    }
    for (const row of receipt.applyTo ?? []) {
      if (ObjectId.isValid(row.invoiceId)) invoiceIds.add(row.invoiceId);
    }
    const invoiceMap = new Map<string, { invoiceNo: string; status?: string; date?: string }>();
    await Promise.all(
      [...invoiceIds].map(async (invoiceId) => {
        try {
          const doc = await sabcrmFinanceApi.getInvoice(
            g.ctx.projectId,
            invoiceId,
          );
          invoiceMap.set(invoiceId, {
            invoiceNo: doc.invoiceNo,
            status: doc.status,
            date: doc.date,
          });
        } catch {
          // Invoice gone — render the humanised fallback.
        }
      }),
    );

    const related: SabcrmRelatedDocRef[] = [];
    for (const ref of receipt.lineage ?? []) {
      if (ref.kind === 'invoice') {
        const inv = invoiceMap.get(ref.id);
        related.push({
          kind: 'invoice',
          id: ref.id,
          label: inv?.invoiceNo ?? 'Invoice',
          href: inv ? `${INVOICE_DETAIL_BASE}/${encodeURIComponent(ref.id)}` : null,
          date: inv?.date,
          status: inv?.status,
          direction: 'parent',
        });
      } else if (ref.kind === 'proforma') {
        let label = 'Proforma invoice';
        let status: string | undefined;
        try {
          const doc = await sabcrmFinanceProformaInvoicesApi.getById(
            g.ctx.projectId,
            ref.id,
          );
          label = doc.proformaNumber ?? label;
          status = doc.status;
        } catch {
          // Parent gone — keep the humanised kind.
        }
        related.push({
          kind: 'proforma',
          id: ref.id,
          label,
          href: '/sabcrm/finance/proforma-invoices',
          status,
          direction: 'parent',
        });
      } else {
        related.push({
          kind: ref.kind,
          id: ref.id,
          label: ref.kind.replace(/([a-z])([A-Z])/g, '$1 $2'),
          href: null,
          direction: 'parent',
        });
      }
    }

    const allocations: SabcrmReceiptAllocationRef[] = (
      receipt.applyTo ?? []
    ).map((row) => {
      const inv = invoiceMap.get(row.invoiceId);
      return {
        invoiceId: row.invoiceId,
        invoiceNo: inv?.invoiceNo ?? null,
        amount: row.amount,
        href: inv
          ? `${INVOICE_DETAIL_BASE}/${encodeURIComponent(row.invoiceId)}`
          : null,
        status: inv?.status,
      };
    });

    return { ok: true, data: { related, allocations } };
  } catch (e) {
    return fail(e, 'Failed to load related documents.');
  }
}
