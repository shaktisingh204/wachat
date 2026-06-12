'use server';

/**
 * SabCRM Finance — expense-claim-surface server actions (spec §3.12).
 *
 * Full doc-surface data paths for `/sabcrm/finance/expenses`, mirroring
 * the flagship invoices structure:
 *
 *   - display-ready paged list rows (employee labels batch-resolved in
 *     ONE pass for rows missing the denormalised `employee_name`);
 *   - KPI strip (pending approval / reimbursed this month / rejected /
 *     average claim);
 *   - capped fetch-all for CSV export;
 *   - full-form create/update over EVERY crate field (claim number,
 *     employee, category, amount, currency, date, description, SabFiles
 *     receipt, status);
 *   - status transitions validated against `SABCRM_EXPENSE_TRANSITIONS`
 *     — approving stamps the SESSION USER as `approver_id` /
 *     `approver_name` (never a placeholder);
 *   - `EC-YYYYMM-NNNN` number suggestion (the crate also auto-generates
 *     server-side when the field is left blank).
 *
 * Wire traps handled here:
 *   - the crate's create/update bodies are SNAKE_CASE (`employee_id`,
 *     `expense_date`, …) — all translation lives in this file;
 *   - the entity serializes `_id`/ObjectId/Date fields as MongoDB
 *     extended JSON — every fetched doc is deflated via
 *     `finance-extjson`;
 *   - crm-common pagination is 0-INDEXED — the kit's 1-based page is
 *     decremented before it reaches the engine (sending `page=1` would
 *     silently skip the first page).
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmFinanceExpensesApi,
  type SabcrmExpenseClaimDoc,
  type SabcrmExpenseClaimUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type { CrmExpenseClaimStatus } from '@/lib/rust-client/crm-expense-claims';
import { deflateDoc, deflateDocs } from '@/lib/sabcrm/finance-extjson';
import { round2 } from '@/lib/sabcrm/finance-doc-math';
import { resolveSabcrmFinanceParties } from './sabcrm-finance-invoices.actions';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  SABCRM_EXPENSE_TRANSITIONS,
  type SabcrmExpenseFullInput,
  type SabcrmExpenseFullPatch,
  type SabcrmExpenseKpis,
  type SabcrmExpenseListFilters,
  type SabcrmExpenseListPage,
  type SabcrmExpenseListRow,
} from './sabcrm-finance-expenses.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const FINANCE_EXPENSES_PATH = '/sabcrm/finance/expenses';

interface SessionUser {
  _id: string;
  name?: string;
  email?: string;
}

interface GateContext {
  userId: string;
  /** Display name for approval stamping (best-effort, never an id). */
  userLabel: string | undefined;
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
  const user = session.user as SessionUser;
  const userId = user._id;
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

  return {
    ok: true,
    ctx: {
      userId,
      userLabel: user.name?.trim() || user.email?.trim() || undefined,
      projectId: requested,
    },
  };
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

/* ─── Numbering ───────────────────────────────────────────────── */

/**
 * Suggests the next `EC-YYYYMM-NNNN` claim number for the CURRENT
 * month: max existing NNNN in this month's series + 1, else `…-0001`.
 * (The crate auto-generates the same shape server-side when the field
 * is left blank — this keeps the form's preview honest.)
 */
export async function getNextSabcrmExpenseClaimNumber(
  projectId?: string,
): Promise<ActionResult<string>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const now = new Date();
    const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const prefix = `EC-${ym}-`;
    const res = await sabcrmFinanceExpensesApi.list(g.ctx.projectId, {
      limit: 100,
    });
    const docs = deflateDocs<SabcrmExpenseClaimDoc>(res.items);
    let max = 0;
    for (const doc of docs) {
      const num = doc.claim_number ?? '';
      if (!num.startsWith(prefix)) continue;
      const n = Number(num.slice(prefix.length));
      if (Number.isFinite(n) && n > max) max = n;
    }
    return { ok: true, data: `${prefix}${String(max + 1).padStart(4, '0')}` };
  } catch (e) {
    return fail(e, 'Failed to suggest a claim number.');
  }
}

/* ─── Rows (batch-resolved employee labels — no N+1) ──────────── */

async function employeeLabelMap(
  docs: SabcrmExpenseClaimDoc[],
  projectId: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  // Only rows MISSING the denormalised name need resolution, and only
  // ids that look like record ids can resolve.
  const ids = [
    ...new Set(
      docs
        .filter((d) => !d.employee_name && ObjectId.isValid(d.employee_id))
        .map((d) => d.employee_id),
    ),
  ];
  if (ids.length === 0) return map;
  const res = await resolveSabcrmFinanceParties(ids, projectId);
  if (res.ok) for (const ref of res.data) map.set(ref.id, ref.label);
  return map;
}

function toListRow(
  doc: SabcrmExpenseClaimDoc,
  employees: Map<string, string>,
): SabcrmExpenseListRow {
  const resolved =
    doc.employee_name ||
    employees.get(doc.employee_id) ||
    // Free-text employees store the NAME as the opaque id — render it
    // (a 24-hex id that failed to resolve stays hidden).
    (!ObjectId.isValid(doc.employee_id) ? doc.employee_id : null);
  return {
    id: doc._id,
    claimNumber: doc.claim_number,
    employeeId: doc.employee_id,
    employeeLabel: resolved || null,
    categoryLabel: doc.category_name ?? '',
    date: doc.expense_date ?? doc.createdAt ?? '',
    description: doc.description ?? '',
    amount: doc.amount ?? 0,
    currency: doc.currency || 'INR',
    hasReceipt: !!doc.receipt_url,
    status: doc.status,
    approverLabel: doc.approver_name ?? '',
  };
}

/** In-page inclusive date-range refinement (the crate has no from/to). */
function inRange(
  docs: SabcrmExpenseClaimDoc[],
  from?: string,
  to?: string,
): SabcrmExpenseClaimDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.expense_date ?? d.createdAt ?? '').slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

/* ─── List page ───────────────────────────────────────────────── */

/**
 * Lists a page of display-ready expense rows. NB: crm-common pages are
 * 0-indexed — the kit's 1-based `page` is decremented here. `hasMore`
 * comes straight from the crate's list envelope.
 */
export async function listSabcrmExpensesPage(
  filters: SabcrmExpenseListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmExpenseListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmFinanceExpensesApi.list(g.ctx.projectId, {
      // 1-based UI page → 0-based crate page.
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
      employeeId: filters.employeeId || undefined,
    });
    const docs = deflateDocs<SabcrmExpenseClaimDoc>(res.items);
    const pageDocs = inRange(docs, filters.from, filters.to);
    const employees = await employeeLabelMap(pageDocs, g.ctx.projectId);

    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, employees)),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list expenses.');
  }
}

/** Pages the list endpoint scans for KPIs / export (100 docs each). */
const SCAN_MAX_PAGES = 5;

/** Capped fetch-all (500) for CSV export, honouring the filters. */
export async function exportSabcrmExpenseRows(
  filters: SabcrmExpenseListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmExpenseListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmExpenseClaimDoc[] = [];
    for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmFinanceExpensesApi.list(g.ctx.projectId, {
        page,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
        employeeId: filters.employeeId || undefined,
      });
      docs.push(...deflateDocs<SabcrmExpenseClaimDoc>(res.items));
      if (!res.hasMore) break;
    }
    const rows = inRange(docs, filters.from, filters.to);
    const employees = await employeeLabelMap(rows, g.ctx.projectId);
    return { ok: true, data: rows.map((d) => toListRow(d, employees)) };
  } catch (e) {
    return fail(e, 'Failed to export expenses.');
  }
}

/* ─── KPIs ────────────────────────────────────────────────────── */

/**
 * Computes the KPI strip over a capped scan (up to 500 most recent
 * claims). `sampled: true` flags a capped result.
 */
export async function getSabcrmExpenseKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmExpenseKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmExpenseClaimDoc[] = [];
    let sampled = false;
    for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmFinanceExpensesApi.list(g.ctx.projectId, {
        page,
        limit: 100,
      });
      docs.push(...deflateDocs<SabcrmExpenseClaimDoc>(res.items));
      if (!res.hasMore) break;
      if (page === SCAN_MAX_PAGES - 1) sampled = true;
    }

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const currencyVotes = new Map<string, number>();
    let pendingApprovalAmount = 0;
    let pendingApprovalCount = 0;
    let reimbursedThisMonth = 0;
    let reimbursedThisMonthCount = 0;
    let rejectedCount = 0;
    let claimSum = 0;
    let claimCount = 0;

    for (const doc of docs) {
      const amount = doc.amount ?? 0;
      const currency = doc.currency || 'INR';
      currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);

      if (doc.status === 'submitted') {
        pendingApprovalAmount += amount;
        pendingApprovalCount += 1;
      }
      if (
        doc.status === 'reimbursed' &&
        (doc.updatedAt ?? '').slice(0, 7) === monthKey
      ) {
        reimbursedThisMonth += amount;
        reimbursedThisMonthCount += 1;
      }
      if (doc.status === 'rejected') rejectedCount += 1;
      if (doc.status !== 'cancelled' && doc.status !== 'archived') {
        claimSum += amount;
        claimCount += 1;
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
        pendingApprovalAmount: round2(pendingApprovalAmount),
        pendingApprovalCount,
        reimbursedThisMonth: round2(reimbursedThisMonth),
        reimbursedThisMonthCount,
        rejectedCount,
        averageClaim: claimCount > 0 ? round2(claimSum / claimCount) : 0,
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute expense KPIs.');
  }
}

/* ─── Detail fetch ────────────────────────────────────────────── */

/** Fetches ONE expense claim, extended-JSON deflated. */
export async function getSabcrmExpenseFull(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmExpenseClaimDoc>> {
  if (!id) return { ok: false, error: 'Expense id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const doc = deflateDoc<SabcrmExpenseClaimDoc>(
      await sabcrmFinanceExpensesApi.getById(g.ctx.projectId, id),
    );
    return { ok: true, data: doc };
  } catch (e) {
    return fail(e, 'Failed to load the expense claim.');
  }
}

/* ─── Validation + wire translation (camelCase → snake_case) ──── */

const EXPENSE_STATUSES: ReadonlySet<CrmExpenseClaimStatus> = new Set([
  'draft',
  'submitted',
  'approved',
  'rejected',
  'reimbursed',
  'cancelled',
  'archived',
]);

function cleanEmployee(
  employeeId: string | undefined,
  employeeName: string | undefined,
): { ok: true; id: string; name?: string } | { ok: false; error: string } {
  const id = employeeId?.trim() ?? '';
  const name = employeeName?.trim() || undefined;
  if (!id) {
    return {
      ok: false,
      error: 'Pick an employee, or type a name for a non-CRM employee.',
    };
  }
  return { ok: true, id, name };
}

/**
 * Creates an expense claim from the FULL form — real picked employee
 * (or a free-text name for non-CRM staff; the crate's `employee_id` is
 * an opaque string), SabFiles receipt, full field set. NB: snake_case
 * wire body.
 */
export async function createSabcrmExpenseFull(
  input: SabcrmExpenseFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmExpenseClaimDoc>> {
  const employee = cleanEmployee(input.employeeId, input.employeeName);
  if (!employee.ok) return { ok: false, error: employee.error };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Claim amount must be greater than zero.' };
  }
  const dateIso = input.expenseDate ? toIso(input.expenseDate) : undefined;
  if (input.expenseDate && !dateIso) {
    return { ok: false, error: 'The expense date is invalid.' };
  }
  if (input.status !== undefined && !EXPENSE_STATUSES.has(input.status)) {
    return { ok: false, error: 'Invalid expense status.' };
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmFinanceExpensesApi.create(g.ctx.projectId, {
      employee_id: employee.id,
      employee_name: employee.name,
      claim_number: input.claimNumber?.trim() || undefined,
      category_name: input.categoryName?.trim() || undefined,
      amount: round2(amount),
      currency: input.currency?.trim()
        ? input.currency.trim().toUpperCase()
        : undefined,
      expense_date: dateIso ?? undefined,
      description: input.description?.trim() || undefined,
      receipt_url: input.receiptUrl?.trim() || undefined,
      receipt_name: input.receiptName?.trim() || undefined,
      status: input.status,
    });
    revalidatePath(FINANCE_EXPENSES_PATH);
    return {
      ok: true,
      data: deflateDoc<SabcrmExpenseClaimDoc>(created.entity),
    };
  } catch (e) {
    return fail(e, 'Failed to create the expense claim.');
  }
}

/** Full-form partial update (NOT status — use the transition action). */
export async function updateSabcrmExpenseFull(
  id: string,
  patch: SabcrmExpenseFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmExpenseClaimDoc>> {
  if (!id) return { ok: false, error: 'Expense id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmExpenseClaimUpdateInput = {};
  if (patch.employeeId !== undefined || patch.employeeName !== undefined) {
    const employee = cleanEmployee(patch.employeeId, patch.employeeName);
    if (!employee.ok) return { ok: false, error: employee.error };
    wire.employee_id = employee.id;
    wire.employee_name = employee.name;
  }
  if (patch.claimNumber !== undefined) {
    if (!patch.claimNumber.trim()) {
      return { ok: false, error: 'A claim number is required.' };
    }
    wire.claim_number = patch.claimNumber.trim();
  }
  if (patch.categoryName !== undefined) {
    wire.category_name = patch.categoryName.trim();
  }
  if (patch.amount !== undefined) {
    const amount = Number(patch.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: 'Claim amount must be greater than zero.' };
    }
    wire.amount = round2(amount);
  }
  if (patch.currency !== undefined) {
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (patch.expenseDate !== undefined && patch.expenseDate) {
    const iso = toIso(patch.expenseDate);
    if (!iso) return { ok: false, error: 'The expense date is invalid.' };
    wire.expense_date = iso;
  }
  if (patch.description !== undefined) wire.description = patch.description;
  if (patch.receiptUrl !== undefined) wire.receipt_url = patch.receiptUrl;
  if (patch.receiptName !== undefined) wire.receipt_name = patch.receiptName;
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = deflateDoc<SabcrmExpenseClaimDoc>(
      await sabcrmFinanceExpensesApi.update(g.ctx.projectId, id, wire),
    );
    revalidatePath(FINANCE_EXPENSES_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the expense claim.');
  }
}

/* ─── Status transitions ──────────────────────────────────────── */

/**
 * Applies a workflow transition, validated against the transition map.
 * Approving stamps the SESSION USER as the approver (`approver_id` +
 * `approver_name`) — the audit trail never carries a placeholder.
 */
export async function transitionSabcrmExpenseStatus(
  id: string,
  next: CrmExpenseClaimStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmExpenseClaimDoc>> {
  if (!id) return { ok: false, error: 'Expense id is required.' };
  if (!(next in SABCRM_EXPENSE_TRANSITIONS)) {
    return { ok: false, error: 'Invalid expense status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = deflateDoc<SabcrmExpenseClaimDoc>(
      await sabcrmFinanceExpensesApi.getById(g.ctx.projectId, id),
    );
    const from = current.status;
    if (!SABCRM_EXPENSE_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a claim from "${from}" to "${next}".`,
      };
    }
    const wire: SabcrmExpenseClaimUpdateInput = { status: next };
    if (next === 'approved') {
      wire.approver_id = g.ctx.userId;
      wire.approver_name = g.ctx.userLabel;
    }
    const data = deflateDoc<SabcrmExpenseClaimDoc>(
      await sabcrmFinanceExpensesApi.update(g.ctx.projectId, id, wire),
    );
    revalidatePath(FINANCE_EXPENSES_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the claim status.');
  }
}
