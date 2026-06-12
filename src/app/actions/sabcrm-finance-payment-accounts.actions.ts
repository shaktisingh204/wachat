'use server';

/**
 * SabCRM Finance — payment-account surface server actions.
 *
 * Full doc-surface adoption for `/sabcrm/finance/payment-accounts`
 * (finance-rollout spec §3.9): paged display-ready rows, KPI strip
 * (total opening balance, computed current balance over a capped
 * bank-transaction scan, active count), capped CSV export and
 * full-field create/update (bank details, default flag, opening
 * balance date, status).
 *
 * Rust wire traps honoured here: this is a crm-common-style crate —
 * the list is 0-INDEXED (`skip = page * limit`) and returns
 * `{ items, page, limit, hasMore }`; create returns `{ id, entity }`;
 * delete is an archive. The kit's 1-indexed page number is translated
 * at the wire boundary.
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * its siblings; engine failures normalise into `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmFinanceBankTransactionsApi,
  sabcrmFinancePaymentAccountsApi,
  type SabcrmPaymentAccountDoc,
  type SabcrmPaymentAccountUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type {
  CrmBankAccountDetails,
  CrmPaymentAccountStatus,
  CrmPaymentAccountType,
} from '@/lib/rust-client/crm-payment-accounts';
import { round2 } from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmPaymentAccountFullInput,
  SabcrmPaymentAccountFullPatch,
  SabcrmPaymentAccountKpis,
  SabcrmPaymentAccountListFilters,
  SabcrmPaymentAccountListPage,
  SabcrmPaymentAccountListRow,
} from './sabcrm-finance-payment-accounts.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const ACCOUNTS_PATH = '/sabcrm/finance/payment-accounts';

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

const ACCOUNT_TYPES: ReadonlySet<CrmPaymentAccountType> = new Set([
  'bank',
  'cash',
  'upi',
  'wallet',
  'employee',
]);

const ACCOUNT_STATUSES: ReadonlySet<CrmPaymentAccountStatus> = new Set([
  'active',
  'inactive',
  'archived',
]);

function trimBankDetails(
  details: CrmBankAccountDetails | undefined,
): CrmBankAccountDetails | undefined {
  if (!details) return undefined;
  const cleaned: CrmBankAccountDetails = {
    bankName: details.bankName?.trim() || undefined,
    accountNumber: details.accountNumber?.trim() || undefined,
    ifsc: details.ifsc?.trim().toUpperCase() || undefined,
    branch: details.branch?.trim() || undefined,
    accountHolder: details.accountHolder?.trim() || undefined,
  };
  return Object.values(cleaned).some(Boolean) ? cleaned : undefined;
}

function toListRow(doc: SabcrmPaymentAccountDoc): SabcrmPaymentAccountListRow {
  return {
    id: doc._id,
    accountName: doc.accountName,
    accountType: String(doc.accountType ?? ''),
    status: doc.status ?? 'active',
    openingBalance: doc.openingBalance ?? 0,
    openingBalanceDate: doc.openingBalanceDate ?? '',
    currency: doc.currency || 'INR',
    isDefault: Boolean(doc.isDefault),
    bankDetails: doc.bankDetails,
  };
}

/* ─── List page ────────────────────────────────────────────────── */

/**
 * Lists a page of display-ready account rows. NB the crm-common crates
 * paginate 0-INDEXED — the kit's 1-indexed page translates here. An
 * empty status filter maps to the crate's default (archived hidden).
 */
export async function listSabcrmPaymentAccountsPage(
  filters: SabcrmPaymentAccountListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentAccountListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmFinancePaymentAccountsApi.list(g.ctx.projectId, {
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
    });

    let rows = res.items.map(toListRow);
    if (filters.from || filters.to) {
      const fromKey = filters.from ?? '0000-00-00';
      const toKey = filters.to ?? '9999-12-31';
      rows = rows.filter((r) => {
        const day = r.openingBalanceDate.slice(0, 10);
        return day >= fromKey && day <= toKey;
      });
    }

    return { ok: true, data: { rows, page, hasMore: res.hasMore } };
  } catch (e) {
    return fail(e, 'Failed to list payment accounts.');
  }
}

/** 0-indexed pages scanned for export/KPIs (100 docs each). */
const SCAN_MAX_PAGES = 5;

/** Fetch-all (capped at 500) for CSV export, honouring current filters. */
export async function exportSabcrmPaymentAccountRows(
  filters: SabcrmPaymentAccountListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentAccountListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmPaymentAccountDoc[] = [];
    for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmFinancePaymentAccountsApi.list(g.ctx.projectId, {
        page,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
      });
      docs.push(...res.items);
      if (!res.hasMore) break;
    }
    let rows = docs.map(toListRow);
    if (filters.from || filters.to) {
      const fromKey = filters.from ?? '0000-00-00';
      const toKey = filters.to ?? '9999-12-31';
      rows = rows.filter((r) => {
        const day = r.openingBalanceDate.slice(0, 10);
        return day >= fromKey && day <= toKey;
      });
    }
    return { ok: true, data: rows };
  } catch (e) {
    return fail(e, 'Failed to export payment accounts.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/**
 * KPI strip: total opening balance, computed current balance (opening
 * + Σ bank-tx credit − debit over ONE capped transaction scan — no
 * per-account queries), active count, default account. `sampled: true`
 * flags a capped scan.
 */
export async function getSabcrmPaymentAccountKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentAccountKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const accounts: SabcrmPaymentAccountDoc[] = [];
    for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmFinancePaymentAccountsApi.list(g.ctx.projectId, {
        page,
        limit: 100,
      });
      accounts.push(...res.items);
      if (!res.hasMore) break;
    }

    const currencyVotes = new Map<string, number>();
    let totalOpening = 0;
    let activeCount = 0;
    let defaultAccountName: string | null = null;
    for (const acc of accounts) {
      totalOpening += acc.openingBalance ?? 0;
      if ((acc.status ?? 'active') === 'active') activeCount += 1;
      if (acc.isDefault && !defaultAccountName) {
        defaultAccountName = acc.accountName;
      }
      const code = acc.currency || 'INR';
      currencyVotes.set(code, (currencyVotes.get(code) ?? 0) + 1);
    }

    // Net flow from ONE capped bank-transaction scan (batched).
    let netFlow = 0;
    let sampled = false;
    for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
      const res = await sabcrmFinanceBankTransactionsApi.list(g.ctx.projectId, {
        page,
        limit: 100,
      });
      for (const tx of res.items) {
        netFlow += tx.type === 'credit' ? (tx.amount ?? 0) : -(tx.amount ?? 0);
      }
      if (!res.hasMore) break;
      if (page === SCAN_MAX_PAGES - 1 && res.hasMore) sampled = true;
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
        totalOpeningBalance: round2(totalOpening),
        currentBalance: round2(totalOpening + netFlow),
        activeCount,
        count: accounts.length,
        defaultAccountName,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute account KPIs.');
  }
}

/* ─── Create / update (full dialog) ────────────────────────────── */

/** Creates an account from the full dialog (every DTO field). */
export async function createSabcrmPaymentAccountFull(
  input: SabcrmPaymentAccountFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentAccountDoc>> {
  if (!input?.accountName?.trim()) {
    return { ok: false, error: 'An account name is required.' };
  }
  if (!ACCOUNT_TYPES.has(input.accountType)) {
    return { ok: false, error: 'Pick a valid account type.' };
  }
  if (input.openingBalance !== undefined) {
    const n = Number(input.openingBalance);
    if (!Number.isFinite(n)) {
      return { ok: false, error: 'The opening balance is invalid.' };
    }
  }
  let openingDateIso: string | undefined;
  if (input.openingBalanceDate) {
    const iso = toIso(input.openingBalanceDate);
    if (!iso) {
      return { ok: false, error: 'The opening balance date is invalid.' };
    }
    openingDateIso = iso;
  }

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const res = await sabcrmFinancePaymentAccountsApi.create(g.ctx.projectId, {
      accountName: input.accountName.trim(),
      accountType: input.accountType,
      openingBalance:
        input.openingBalance !== undefined
          ? round2(Number(input.openingBalance))
          : undefined,
      openingBalanceDate: openingDateIso,
      currency: input.currency?.trim().toUpperCase() || undefined,
      isDefault: input.isDefault,
      bankDetails:
        input.accountType === 'bank'
          ? trimBankDetails(input.bankDetails)
          : undefined,
    });
    revalidatePath(ACCOUNTS_PATH);
    return { ok: true, data: res.entity };
  } catch (e) {
    return fail(e, 'Failed to create the payment account.');
  }
}

/** Full-field patch (name, type, balances, default flag, bank details, status). */
export async function updateSabcrmPaymentAccountFull(
  id: string,
  patch: SabcrmPaymentAccountFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentAccountDoc>> {
  if (!id) return { ok: false, error: 'Account id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmPaymentAccountUpdateInput = {};
  if (patch.accountName !== undefined) {
    if (!patch.accountName.trim()) {
      return { ok: false, error: 'An account name is required.' };
    }
    wire.accountName = patch.accountName.trim();
  }
  if (patch.accountType !== undefined) {
    if (!ACCOUNT_TYPES.has(patch.accountType)) {
      return { ok: false, error: 'Pick a valid account type.' };
    }
    wire.accountType = patch.accountType;
  }
  if (patch.status !== undefined) {
    if (!ACCOUNT_STATUSES.has(patch.status)) {
      return { ok: false, error: 'Pick a valid account status.' };
    }
    wire.status = patch.status;
  }
  if (patch.openingBalance !== undefined) {
    const n = Number(patch.openingBalance);
    if (!Number.isFinite(n)) {
      return { ok: false, error: 'The opening balance is invalid.' };
    }
    wire.openingBalance = round2(n);
  }
  if (patch.openingBalanceDate !== undefined) {
    const iso = toIso(patch.openingBalanceDate);
    if (!iso) {
      return { ok: false, error: 'The opening balance date is invalid.' };
    }
    wire.openingBalanceDate = iso;
  }
  if (patch.currency !== undefined) {
    wire.currency = patch.currency.trim().toUpperCase();
  }
  if (patch.isDefault !== undefined) wire.isDefault = patch.isDefault;
  if (patch.bankDetails !== undefined) {
    wire.bankDetails = trimBankDetails(patch.bankDetails) ?? {};
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
    revalidatePath(ACCOUNTS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the payment account.');
  }
}
