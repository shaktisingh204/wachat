'use server';

/**
 * SabCRM Finance — journal-entries (voucher entries) surface server
 * actions (`/sabcrm/finance/journal-entries`, crate
 * `crm-voucher-entries`).
 *
 * Full doc-surface adopter actions for multi-leg journal vouchers:
 *
 *   - paged display-ready list (book labels batch-resolved in ONE
 *     parallel pass over the page's unique book ids — no N+1);
 *   - full-detail fetch for the view dialog (both leg tables resolved
 *     to account names — never raw ObjectIds);
 *   - KPI scan (posted this month / drafts / debit volume / books in
 *     use) and capped CSV export;
 *   - full multi-leg create (REAL picked ledger accounts, balance
 *     validated to the same ±0.01 rule the Rust handler enforces,
 *     find-or-create default Journal book) and draft-only update
 *     (posted entries are immutable);
 *   - status transition draft → posted;
 *   - book-aware voucher-number suggestion (prefix + padded counter).
 *
 * NB: the crate is crm-common style — list pagination is 0-INDEXED on
 * the wire, so these actions translate the kit's 1-based pages.
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
  sabcrmFinanceAccountsApi,
  sabcrmFinanceJournalEntriesApi,
  sabcrmFinanceVouchersApi,
  type SabcrmJournalEntryDoc,
  type SabcrmJournalEntryUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type { CrmVoucherEntryStatus, CrmVoucherLine } from '@/lib/rust-client/crm-voucher-entries';
import { round2 } from '@/lib/sabcrm/finance-doc-math';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  SABCRM_JOURNAL_ENTRY_TRANSITIONS,
  type SabcrmJournalEntryDetail,
  type SabcrmJournalEntryFullInput,
  type SabcrmJournalEntryFullPatch,
  type SabcrmJournalEntryKpis,
  type SabcrmJournalEntryListFilters,
  type SabcrmJournalEntryListPage,
  type SabcrmJournalEntryListRow,
  type SabcrmJournalLegDetail,
  type SabcrmJournalLegInput,
} from './sabcrm-finance-journal-entries.actions.types';

/* ─── Gate (mirrors sabcrm-finance-invoices.actions.ts verbatim) ── */

const MODULE_KEY = 'sabcrm';
const JOURNAL_ENTRIES_PATH = '/sabcrm/finance/journal-entries';

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

/* ─── Book label resolution (batched; no N+1) ─────────────────── */

/**
 * Batch-resolves voucher-book ids to names — ONE parallel pass over the
 * UNIQUE ids on the page. Unresolvable ids are absent; rows render a
 * muted "Unknown book", never a raw id.
 */
async function resolveBookLabels(
  projectId: string,
  ids: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 100);
  const map = new Map<string, string>();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const book = await sabcrmFinanceVouchersApi.getById(projectId, id);
        map.set(id, book.name || 'Unnamed book');
      } catch {
        // Book gone — leave unresolved.
      }
    }),
  );
  return map;
}

/* ─── Row / detail mapping ────────────────────────────────────── */

function toListRow(
  doc: SabcrmJournalEntryDoc,
  bookMap: Map<string, string>,
): SabcrmJournalEntryListRow {
  const debits = doc.debitEntries ?? [];
  const credits = doc.creditEntries ?? [];
  return {
    id: doc._id,
    voucherNumber: doc.voucherNumber,
    bookId: doc.voucherBookId,
    bookLabel: bookMap.get(doc.voucherBookId) ?? null,
    date: doc.date,
    narration: doc.narration ?? '',
    reference: doc.reference ?? '',
    legsSummary: `${debits.length} dr / ${credits.length} cr`,
    totalDebit: doc.totalDebit ?? 0,
    totalCredit: doc.totalCredit ?? 0,
    status: doc.status ?? 'posted',
  };
}

/** Inclusive `YYYY-MM-DD` refinement on the entry date (in-page). */
function inRange(
  doc: SabcrmJournalEntryDoc,
  from?: string,
  to?: string,
): boolean {
  if (!from && !to) return true;
  const day = (doc.date ?? '').slice(0, 10);
  if (!day) return false;
  return day >= (from ?? '0000-00-00') && day <= (to ?? '9999-12-31');
}

/* ─── List page ───────────────────────────────────────────────── */

/**
 * Lists a page of display-ready journal-entry rows with book labels
 * resolved in one batched pass.
 */
export async function listSabcrmJournalEntriesPage(
  filters: SabcrmJournalEntryListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmJournalEntryListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const res = await sabcrmFinanceJournalEntriesApi.list(g.ctx.projectId, {
      // crm-common pagination is 0-indexed.
      page: page - 1,
      limit,
      q: filters.q || undefined,
      status: filters.status ? filters.status : 'all',
      voucherBookId: filters.voucherBookId || undefined,
    });
    const pageDocs = res.items.filter((d) =>
      inRange(d, filters.from, filters.to),
    );
    const bookMap = await resolveBookLabels(
      g.ctx.projectId,
      pageDocs.map((d) => d.voucherBookId),
    );
    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, bookMap)),
        page,
        hasMore: res.hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list journal entries.');
  }
}

/* ─── Detail (view dialog) ────────────────────────────────────── */

/**
 * Loads one entry with BOTH leg tables resolved to account names
 * (chart of accounts) and the book label — the view dialog's payload.
 */
export async function getSabcrmJournalEntryDetail(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmJournalEntryDetail>> {
  if (!id) return { ok: false, error: 'Entry id is required.' };
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const doc = await sabcrmFinanceJournalEntriesApi.getById(
      g.ctx.projectId,
      id,
    );

    const accountIds = [
      ...new Set(
        [...(doc.debitEntries ?? []), ...(doc.creditEntries ?? [])].map(
          (l) => l.accountId,
        ),
      ),
    ].filter(Boolean);
    const accountMap = new Map<string, { label: string; meta: string | null }>();
    await Promise.all(
      accountIds.map(async (accountId) => {
        try {
          const account = await sabcrmFinanceAccountsApi.getById(
            g.ctx.projectId,
            accountId,
          );
          accountMap.set(accountId, {
            label: account.name,
            meta:
              [account.code, account.accountType].filter(Boolean).join(' · ') ||
              null,
          });
        } catch {
          // Account gone — row renders "Unknown account".
        }
      }),
    );

    const bookMap = await resolveBookLabels(g.ctx.projectId, [
      doc.voucherBookId,
    ]);

    const toLeg = (l: CrmVoucherLine): SabcrmJournalLegDetail => ({
      accountId: l.accountId,
      accountLabel: accountMap.get(l.accountId)?.label ?? null,
      accountMeta: accountMap.get(l.accountId)?.meta ?? null,
      amount: l.amount,
      description: l.description,
    });

    return {
      ok: true,
      data: {
        id: doc._id,
        voucherNumber: doc.voucherNumber,
        bookId: doc.voucherBookId,
        bookLabel: bookMap.get(doc.voucherBookId) ?? null,
        date: doc.date,
        narration: doc.narration ?? '',
        reference: doc.reference ?? '',
        status: doc.status ?? 'posted',
        totalDebit: doc.totalDebit ?? 0,
        totalCredit: doc.totalCredit ?? 0,
        debits: (doc.debitEntries ?? []).map(toLeg),
        credits: (doc.creditEntries ?? []).map(toLeg),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to load the journal entry.');
  }
}

/* ─── KPIs ────────────────────────────────────────────────────── */

const SCAN_MAX_PAGES = 5;

async function scanAll(
  projectId: string,
  filters?: Pick<
    SabcrmJournalEntryListFilters,
    'q' | 'status' | 'voucherBookId'
  >,
): Promise<{ docs: SabcrmJournalEntryDoc[]; sampled: boolean }> {
  const docs: SabcrmJournalEntryDoc[] = [];
  let sampled = false;
  for (let page = 0; page < SCAN_MAX_PAGES; page += 1) {
    const res = await sabcrmFinanceJournalEntriesApi.list(projectId, {
      page,
      limit: 100,
      q: filters?.q || undefined,
      status: filters?.status ? filters.status : 'all',
      voucherBookId: filters?.voucherBookId || undefined,
    });
    docs.push(...res.items);
    if (!res.hasMore || res.items.length === 0) break;
    if (page === SCAN_MAX_PAGES - 1) sampled = true;
  }
  return { docs, sampled };
}

/** Computes the KPI strip over a capped scan (up to 500 entries). */
export async function getSabcrmJournalEntryKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmJournalEntryKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const { docs, sampled } = await scanAll(g.ctx.projectId);
    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const books = new Set<string>();
    let postedThisMonthCount = 0;
    let debitVolumeThisMonth = 0;
    let draftCount = 0;

    for (const doc of docs) {
      const status = doc.status ?? 'posted';
      if (doc.voucherBookId && status !== 'archived') {
        books.add(doc.voucherBookId);
      }
      if (status === 'draft') draftCount += 1;
      if (status === 'posted' && (doc.date ?? '').slice(0, 7) === monthKey) {
        postedThisMonthCount += 1;
        debitVolumeThisMonth += doc.totalDebit ?? 0;
      }
    }

    return {
      ok: true,
      data: {
        count: docs.length,
        postedThisMonthCount,
        debitVolumeThisMonth: round2(debitVolumeThisMonth),
        draftCount,
        booksInUse: books.size,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute journal-entry KPIs.');
  }
}

/* ─── CSV export ──────────────────────────────────────────────── */

/** Fetch-all (capped at 500) for CSV export, honouring the filters. */
export async function exportSabcrmJournalEntryRows(
  filters: SabcrmJournalEntryListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmJournalEntryListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const { docs } = await scanAll(g.ctx.projectId, filters);
    const rows = docs.filter((d) => inRange(d, filters.from, filters.to));
    const bookMap = await resolveBookLabels(
      g.ctx.projectId,
      rows.map((d) => d.voucherBookId),
    );
    return { ok: true, data: rows.map((d) => toListRow(d, bookMap)) };
  } catch (e) {
    return fail(e, 'Failed to export journal entries.');
  }
}

/* ─── Numbering ───────────────────────────────────────────────── */

/**
 * Suggests the next voucher number for a book: scans the book's latest
 * entries for the highest numeric tail and increments it, preserving
 * the book's prefix/suffix + zero padding. First entry ⇒ the book's
 * `startingNumber` formatted; no book ⇒ `JV-<timestamp>`.
 */
export async function getNextSabcrmJournalEntryNumber(
  voucherBookId?: string,
  projectId?: string,
): Promise<ActionResult<string>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const fallback = `JV-${Date.now().toString(36).toUpperCase()}`;
  if (!voucherBookId || !ObjectId.isValid(voucherBookId)) {
    return { ok: true, data: fallback };
  }

  try {
    const [book, entries] = await Promise.all([
      sabcrmFinanceVouchersApi.getById(g.ctx.projectId, voucherBookId),
      sabcrmFinanceJournalEntriesApi.list(g.ctx.projectId, {
        page: 0,
        limit: 100,
        voucherBookId,
        status: 'all',
      }),
    ]);

    const prefix = book.prefix ?? '';
    const suffix = book.suffix ?? '';
    const padding = Math.max(book.padding ?? 0, 0);

    let best = 0;
    for (const entry of entries.items) {
      const m = /(\d+)\s*$/.exec(
        suffix && entry.voucherNumber.endsWith(suffix)
          ? entry.voucherNumber.slice(0, -suffix.length)
          : entry.voucherNumber,
      );
      if (!m) continue;
      const num = Number(m[1]);
      if (Number.isFinite(num) && num > best) best = num;
    }

    const next = best > 0 ? best + 1 : (book.startingNumber ?? 1);
    return {
      ok: true,
      data: `${prefix}${String(next).padStart(padding, '0')}${suffix}`,
    };
  } catch {
    return { ok: true, data: fallback };
  }
}

/* ─── Legs validation ─────────────────────────────────────────── */

function cleanLegs(
  legs: SabcrmJournalLegInput[] | undefined,
  side: 'debit' | 'credit',
):
  | { ok: true; legs: CrmVoucherLine[]; total: number }
  | { ok: false; error: string } {
  const meaningful = (legs ?? []).filter(
    (l) => l.accountId || Number(l.amount) > 0 || l.description?.trim(),
  );
  if (meaningful.length === 0) {
    return { ok: false, error: `Add at least one ${side} line.` };
  }
  const out: CrmVoucherLine[] = [];
  let total = 0;
  for (const leg of meaningful) {
    if (!leg.accountId || !ObjectId.isValid(leg.accountId)) {
      return {
        ok: false,
        error: `Pick a ledger account on every ${side} line.`,
      };
    }
    const amount = Number(leg.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        ok: false,
        error: `Every ${side} line needs an amount above zero.`,
      };
    }
    total += amount;
    out.push({
      accountId: leg.accountId,
      amount: round2(amount),
      description: leg.description?.trim() || undefined,
    });
  }
  return { ok: true, legs: out, total: round2(total) };
}

/* ─── Create ──────────────────────────────────────────────────── */

/**
 * Creates a multi-leg journal entry from the FULL drawer form. Debits
 * must balance credits (±0.01 — the same rule the Rust handler
 * enforces with a 400). When no book is supplied, the project's first
 * `journal` book is used (seeded as "Journal" when none exists).
 */
export async function createSabcrmJournalEntryFull(
  input: SabcrmJournalEntryFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmJournalEntryDoc>> {
  if (!input?.voucherNumber?.trim()) {
    return { ok: false, error: 'A voucher number is required.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid entry date is required.' };
  const debits = cleanLegs(input.debitEntries, 'debit');
  if (!debits.ok) return { ok: false, error: debits.error };
  const credits = cleanLegs(input.creditEntries, 'credit');
  if (!credits.ok) return { ok: false, error: credits.error };
  if (Math.abs(debits.total - credits.total) >= 0.01) {
    return {
      ok: false,
      error: `The entry doesn't balance — debits ${debits.total.toFixed(2)} vs credits ${credits.total.toFixed(2)}.`,
    };
  }
  if (input.voucherBookId && !ObjectId.isValid(input.voucherBookId)) {
    return { ok: false, error: 'Pick a valid voucher book.' };
  }
  const status = input.status === 'posted' ? 'posted' : 'draft';

  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    // Resolve (or seed) the default journal voucher book when unset.
    let bookId = input.voucherBookId;
    if (!bookId) {
      const books = await sabcrmFinanceVouchersApi.list(g.ctx.projectId, {
        type: 'journal',
        limit: 1,
      });
      bookId = books.items[0]?._id;
      if (!bookId) {
        const created = await sabcrmFinanceVouchersApi.create(
          g.ctx.projectId,
          { name: 'Journal', type: 'journal', prefix: 'JV-' },
        );
        bookId = created.id;
      }
    }

    const created = await sabcrmFinanceJournalEntriesApi.create(
      g.ctx.projectId,
      {
        voucherBookId: bookId,
        voucherNumber: input.voucherNumber.trim(),
        date: dateIso,
        narration: input.narration?.trim() || undefined,
        reference: input.reference?.trim() || undefined,
        debitEntries: debits.legs,
        creditEntries: credits.legs,
        status,
      },
    );
    revalidatePath(JOURNAL_ENTRIES_PATH);
    return { ok: true, data: created.entity };
  } catch (e) {
    return fail(e, 'Failed to create the journal entry.');
  }
}

/* ─── Update (draft only) ─────────────────────────────────────── */

/**
 * Full-form partial update. Only DRAFT entries are editable — posted
 * entries are immutable (archive + re-enter to correct). Legs are
 * always patched together so the balance rule can run.
 */
export async function updateSabcrmJournalEntryFull(
  id: string,
  patch: SabcrmJournalEntryFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmJournalEntryDoc>> {
  if (!id) return { ok: false, error: 'Entry id is required.' };

  const wire: SabcrmJournalEntryUpdateInput = {};
  if (patch.voucherNumber !== undefined) {
    if (!patch.voucherNumber.trim()) {
      return { ok: false, error: 'A voucher number is required.' };
    }
    wire.voucherNumber = patch.voucherNumber.trim();
  }
  if (patch.voucherBookId !== undefined) {
    if (!patch.voucherBookId || !ObjectId.isValid(patch.voucherBookId)) {
      return { ok: false, error: 'Pick a valid voucher book.' };
    }
    wire.voucherBookId = patch.voucherBookId;
  }
  if (patch.date !== undefined) {
    const iso = toIso(patch.date);
    if (!iso) return { ok: false, error: 'The entry date is invalid.' };
    wire.date = iso;
  }
  if (patch.narration !== undefined) wire.narration = patch.narration.trim();
  if (patch.reference !== undefined) wire.reference = patch.reference.trim();
  if (
    (patch.debitEntries === undefined) !==
    (patch.creditEntries === undefined)
  ) {
    return {
      ok: false,
      error: 'Debit and credit lines must be updated together.',
    };
  }
  if (patch.debitEntries !== undefined && patch.creditEntries !== undefined) {
    const debits = cleanLegs(patch.debitEntries, 'debit');
    if (!debits.ok) return { ok: false, error: debits.error };
    const credits = cleanLegs(patch.creditEntries, 'credit');
    if (!credits.ok) return { ok: false, error: credits.error };
    if (Math.abs(debits.total - credits.total) >= 0.01) {
      return {
        ok: false,
        error: `The entry doesn't balance — debits ${debits.total.toFixed(2)} vs credits ${credits.total.toFixed(2)}.`,
      };
    }
    wire.debitEntries = debits.legs;
    wire.creditEntries = credits.legs;
  }
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmFinanceJournalEntriesApi.getById(
      g.ctx.projectId,
      id,
    );
    if ((current.status ?? 'posted') !== 'draft') {
      return {
        ok: false,
        error: 'Posted entries are immutable — archive and re-enter instead.',
      };
    }
    const data = await sabcrmFinanceJournalEntriesApi.update(
      g.ctx.projectId,
      id,
      wire,
    );
    revalidatePath(JOURNAL_ENTRIES_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the journal entry.');
  }
}

/* ─── Status transitions ──────────────────────────────────────── */

/**
 * Applies a workflow transition validated against the allowed map
 * (draft → posted; posted entries never move back).
 */
export async function transitionSabcrmJournalEntryStatus(
  id: string,
  next: CrmVoucherEntryStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmJournalEntryDoc>> {
  if (!id) return { ok: false, error: 'Entry id is required.' };
  if (!(next in SABCRM_JOURNAL_ENTRY_TRANSITIONS)) {
    return { ok: false, error: 'Invalid journal-entry status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmFinanceJournalEntriesApi.getById(
      g.ctx.projectId,
      id,
    );
    const from = (current.status ?? 'posted') as CrmVoucherEntryStatus;
    if (!SABCRM_JOURNAL_ENTRY_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move a journal entry from "${from}" to "${next}".`,
      };
    }
    const data = await sabcrmFinanceJournalEntriesApi.update(
      g.ctx.projectId,
      id,
      { status: next },
    );
    revalidatePath(JOURNAL_ENTRIES_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the journal-entry status.');
  }
}
