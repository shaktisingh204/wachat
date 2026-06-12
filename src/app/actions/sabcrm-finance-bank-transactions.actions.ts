'use server';

/**
 * SabCRM Finance — bank-transaction surface server actions.
 *
 * Full doc-surface adoption for `/sabcrm/finance/bank-transactions`
 * (finance-rollout spec §3.10): paged display-ready rows (account
 * labels batch-resolved from ONE accounts list call — never N+1), the
 * kit party filter repurposed as an account filter (plus native Rust
 * `from`/`to` range), KPI strip (inflow / outflow / net this month,
 * unreconciled count), capped CSV export, full-field create/update
 * (REAL picked accountId — the placeholder-id minting of the old
 * minimal dialog is gone) and pending → cleared → reconciled
 * transitions.
 *
 * Rust wire traps honoured here: crm-common-style crate — 0-INDEXED
 * list pages returning `{ items, page, limit, hasMore }`, create
 * `{ id, entity }`, delete = archive. The kit's 1-indexed page is
 * translated at the wire boundary.
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
  sabcrmFinanceBankTransactionsApi,
  sabcrmFinancePaymentAccountsApi,
  type SabcrmBankTransactionDoc,
  type SabcrmBankTransactionListParams,
  type SabcrmBankTransactionUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type {
  CrmBankTransactionStatus,
  CrmBankTransactionType,
} from '@/lib/rust-client/crm-bank-transactions';
import { round2 } from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import type { DocEntityOption } from '@/app/sabcrm/finance/_components/doc-surface/types';
import {
  SABCRM_BANK_TX_TRANSITIONS,
  type SabcrmBankTransactionFullInput,
  type SabcrmBankTransactionFullPatch,
  type SabcrmBankTransactionKpis,
  type SabcrmBankTransactionListFilters,
  type SabcrmBankTransactionListPage,
  type SabcrmBankTransactionListRow,
} from './sabcrm-finance-bank-transactions.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const BANK_TX_PATH = '/sabcrm/finance/bank-transactions';

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

/* ─── Vocabulary ───────────────────────────────────────────────── */

const TX_TYPES: ReadonlySet<CrmBankTransactionType> = new Set([
  'debit',
  'credit',
]);

const TX_STATUSES: ReadonlySet<CrmBankTransactionStatus> = new Set([
  'pending',
  'cleared',
  'reconciled',
  'archived',
]);

/* ─── Account lookups (batched — never per-row) ────────────────── */

/** ONE payment-accounts list call → id → name map for row labels. */
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

/**
 * Payment-account options for the toolbar account filter and the
 * dialog's account Select. The query filters client-side over one
 * (capped) fetch — account counts are small.
 */
export async function searchSabcrmBankTxAccounts(
  q: string,
  projectId?: string,
): Promise<ActionResult<DocEntityOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmFinancePaymentAccountsApi.list(g.ctx.projectId, {
      limit: 100,
      q: q.trim() || undefined,
    });
    return {
      ok: true,
      data: res.items
        .filter((a) => a._id && a.status !== 'archived')
        .slice(0, 12)
        .map((a) => ({
          id: String(a._id),
          label: a.accountName || 'Unnamed account',
          meta: String(a.accountType ?? '') || undefined,
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to search payment accounts.');
  }
}

function toListRow(
  doc: SabcrmBankTransactionDoc,
  accounts: Map<string, string>,
): SabcrmBankTransactionListRow {
  return {
    id: doc._id,
    accountId: doc.accountId ?? '',
    accountLabel: doc.accountId
      ? (accounts.get(doc.accountId) ?? null)
      : null,
    transactionDate: doc.transactionDate ?? '',
    amount: doc.amount ?? 0,
    type: doc.type,
    description: doc.description ?? '',
    referenceNumber: doc.referenceNumber ?? '',
    balanceAfter: doc.balanceAfter ?? null,
    category: doc.category ?? '',
    voucherEntryId: doc.voucherEntryId ?? null,
    status: doc.status ?? 'pending',
    sourceFileUrl: doc.sourceFileUrl ?? '',
  };
}

function wireListParams(
  filters: SabcrmBankTransactionListFilters,
  page: number,
  limit: number,
): SabcrmBankTransactionListParams {
  return {
    page,
    limit,
    q: filters.q || undefined,
    status: filters.status || undefined,
    accountId: filters.accountId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  };
}

/* ─── List page ────────────────────────────────────────────────── */

/**
 * Lists a page of display-ready transaction rows; account labels
 * resolve from one batched accounts fetch. 0-indexed wire pages; the
 * native `from`/`to` filter is passed straight through.
 */
export async function listSabcrmBankTransactionsPage(
  filters: SabcrmBankTransactionListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmBankTransactionListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const [res, accounts] = await Promise.all([
      sabcrmFinanceBankTransactionsApi.list(
        g.ctx.projectId,
        wireListParams(filters, page - 1, limit),
      ),
      accountLabelMap(g.ctx.projectId),
    ]);
    return {
      ok: true,
      data: {
        rows: res.items.map((d) => toListRow(d, accounts)),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list bank transactions.');
  }
}

/** 0-indexed pages scanned for export/KPIs (100 docs each). */
const SCAN_MAX_PAGES = 5;

/** Fetch-all (capped at 500) for CSV export, honouring current filters. */
export async function exportSabcrmBankTransactionRows(
  filters: SabcrmBankTransactionListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmBankTransactionListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmBankTransactionDoc[] = [];
    for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmFinanceBankTransactionsApi.list(
        g.ctx.projectId,
        wireListParams(filters, page, 100),
      );
      docs.push(...res.items);
      if (!res.hasMore) break;
    }
    const accounts = await accountLabelMap(g.ctx.projectId);
    return { ok: true, data: docs.map((d) => toListRow(d, accounts)) };
  } catch (e) {
    return fail(e, 'Failed to export bank transactions.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/**
 * KPI strip over a capped scan (up to 500 most recent transactions):
 * inflow / outflow / net for the current month, unreconciled count.
 */
export async function getSabcrmBankTransactionKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmBankTransactionKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmBankTransactionDoc[] = [];
    let sampled = false;
    for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmFinanceBankTransactionsApi.list(
        g.ctx.projectId,
        { page, limit: 100 },
      );
      docs.push(...res.items);
      if (!res.hasMore) break;
      if (page === SCAN_MAX_PAGES - 1) sampled = true;
    }

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    let inflow = 0;
    let outflow = 0;
    let unreconciled = 0;

    for (const doc of docs) {
      const status = doc.status ?? 'pending';
      if (status === 'pending' || status === 'cleared') unreconciled += 1;
      if ((doc.transactionDate ?? '').slice(0, 7) !== monthKey) continue;
      if (doc.type === 'credit') inflow += doc.amount ?? 0;
      else outflow += doc.amount ?? 0;
    }

    return {
      ok: true,
      data: {
        currency: 'INR',
        inflowThisMonth: round2(inflow),
        outflowThisMonth: round2(outflow),
        netThisMonth: round2(inflow - outflow),
        unreconciledCount: unreconciled,
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute bank-transaction KPIs.');
  }
}

/* ─── Create / update (full dialog) ────────────────────────────── */

function validateCommon(
  input: Partial<SabcrmBankTransactionFullInput>,
): string | null {
  if (input.amount !== undefined) {
    const n = Number(input.amount);
    if (!Number.isFinite(n) || n <= 0) {
      return 'Amount must be greater than zero (direction lives in the type).';
    }
  }
  if (input.type !== undefined && !TX_TYPES.has(input.type)) {
    return 'Pick a valid transaction type.';
  }
  if (input.status !== undefined && !TX_STATUSES.has(input.status)) {
    return 'Pick a valid transaction status.';
  }
  if (input.balanceAfter !== undefined && input.balanceAfter !== null) {
    const n = Number(input.balanceAfter);
    if (!Number.isFinite(n)) return 'The balance-after figure is invalid.';
  }
  return null;
}

/**
 * Creates a transaction from the full dialog. `accountId` is a REAL
 * picked payment account — required and validated (the old surface's
 * placeholder-id minting is gone, per the spec).
 */
export async function createSabcrmBankTransactionFull(
  input: SabcrmBankTransactionFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmBankTransactionDoc>> {
  if (!input?.accountId || !ObjectId.isValid(input.accountId)) {
    return { ok: false, error: 'Pick the payment account for this transaction.' };
  }
  const dateIso = input.transactionDate ? toIso(input.transactionDate) : null;
  if (!dateIso) {
    return { ok: false, error: 'A valid transaction date is required.' };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      error: 'Amount must be greater than zero (direction lives in the type).',
    };
  }
  if (!TX_TYPES.has(input.type)) {
    return { ok: false, error: 'Pick a valid transaction type.' };
  }
  const problem = validateCommon(input);
  if (problem) return { ok: false, error: problem };
  if (input.voucherEntryId && !ObjectId.isValid(input.voucherEntryId)) {
    return { ok: false, error: 'The linked journal entry id is invalid.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmFinanceBankTransactionsApi.create(
      g.ctx.projectId,
      {
        accountId: input.accountId,
        transactionDate: dateIso,
        amount: round2(amount),
        type: input.type,
        description: input.description?.trim() || undefined,
        referenceNumber: input.referenceNumber?.trim() || undefined,
        balanceAfter:
          input.balanceAfter !== undefined && input.balanceAfter !== null
            ? round2(Number(input.balanceAfter))
            : undefined,
        category: input.category?.trim() || undefined,
        voucherEntryId: input.voucherEntryId || undefined,
        status: input.status,
        sourceFileUrl: input.sourceFileUrl?.trim() || undefined,
      },
    );
    revalidatePath(BANK_TX_PATH);
    return { ok: true, data: res.entity };
  } catch (e) {
    return fail(e, 'Failed to record the bank transaction.');
  }
}

/** Full-field patch (the crate's update DTO is fully open). */
export async function updateSabcrmBankTransactionFull(
  id: string,
  patch: SabcrmBankTransactionFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmBankTransactionDoc>> {
  if (!id) return { ok: false, error: 'Transaction id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const problem = validateCommon(patch);
  if (problem) return { ok: false, error: problem };

  const wire: SabcrmBankTransactionUpdateInput = {};
  if (patch.accountId !== undefined) {
    if (!patch.accountId || !ObjectId.isValid(patch.accountId)) {
      return {
        ok: false,
        error: 'Pick the payment account for this transaction.',
      };
    }
    wire.accountId = patch.accountId;
  }
  if (patch.transactionDate !== undefined) {
    const iso = toIso(patch.transactionDate);
    if (!iso) return { ok: false, error: 'The transaction date is invalid.' };
    wire.transactionDate = iso;
  }
  if (patch.amount !== undefined) wire.amount = round2(Number(patch.amount));
  if (patch.type !== undefined) wire.type = patch.type;
  if (patch.description !== undefined) wire.description = patch.description;
  if (patch.referenceNumber !== undefined) {
    wire.referenceNumber = patch.referenceNumber;
  }
  if (patch.balanceAfter !== undefined) {
    wire.balanceAfter =
      patch.balanceAfter === null
        ? undefined
        : round2(Number(patch.balanceAfter));
  }
  if (patch.category !== undefined) wire.category = patch.category;
  if (patch.voucherEntryId !== undefined) {
    if (patch.voucherEntryId && !ObjectId.isValid(patch.voucherEntryId)) {
      return { ok: false, error: 'The linked journal entry id is invalid.' };
    }
    wire.voucherEntryId = patch.voucherEntryId || undefined;
  }
  if (patch.status !== undefined) wire.status = patch.status;
  if (patch.sourceFileUrl !== undefined) {
    wire.sourceFileUrl = patch.sourceFileUrl;
  }
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmFinanceBankTransactionsApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(BANK_TX_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the bank transaction.');
  }
}

/* ─── Status transitions ───────────────────────────────────────── */

/**
 * Applies a workflow transition (pending → cleared → reconciled),
 * validated against the vocabulary AND the allowed-transition map.
 */
export async function transitionSabcrmBankTransactionStatus(
  id: string,
  next: CrmBankTransactionStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmBankTransactionDoc>> {
  if (!id) return { ok: false, error: 'Transaction id is required.' };
  if (!TX_STATUSES.has(next)) {
    return { ok: false, error: 'Invalid transaction status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmFinanceBankTransactionsApi.getById(
      g.ctx.projectId,
      id,
    );
    const from = current.status ?? 'pending';
    if (!SABCRM_BANK_TX_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a transaction from "${from}" to "${next}".`,
      };
    }
    const data = await sabcrmFinanceBankTransactionsApi.update(
      g.ctx.projectId,
      id,
      { status: next },
    );
    revalidatePath(BANK_TX_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the transaction status.');
  }
}
