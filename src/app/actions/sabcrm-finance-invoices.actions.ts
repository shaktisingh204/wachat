'use server';

/**
 * SabCRM Finance — flagship invoice-surface server actions.
 *
 * Extends the proving-vertical `sabcrm-finance.actions.ts` with the
 * data paths the world-class `/sabcrm/finance/invoices` surface needs:
 *
 *   - party search/resolve against the records engine (`companies` +
 *     `people`) so a customer is always a REAL picked record — this
 *     surface never mints placeholder ObjectIds;
 *   - supply-item search for the line-items editor;
 *   - full-form create/update (line items recomputed server-side via
 *     the shared `finance-doc-math` module — client totals are never
 *     trusted);
 *   - status transitions validated against the crate's vocabulary;
 *   - record-payment (creates a `crm-payment-receipts` document with
 *     `applyTo` + lineage back-link, then folds `amountPaid` /
 *     `status` onto the invoice);
 *   - related-documents (lineage parents + receipt children);
 *   - email-invoice via the gated `sendSabcrmEmail` path (recipient is
 *     re-resolved server-side from the linked record).
 *
 * Every action runs the same session → project → RBAC → plan gate as
 * its siblings. The Rust engine may be down at dev time — failures are
 * normalised into `{ ok: false, error }`.
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
  sabcrmFinancePaymentReceiptsApi,
  sabcrmFinancePaymentAccountsApi,
  sabcrmFinanceQuotationsApi,
  sabcrmFinanceSalesOrdersApi,
  sabcrmFinanceProformaInvoicesApi,
  type SabcrmInvoiceDoc,
  type SabcrmInvoiceUpdateInput,
} from '@/lib/rust-client/sabcrm-finance';
import type {
  CrmInvoiceLineItem,
  CrmInvoiceStatus,
  CrmInvoiceTotals,
} from '@/lib/rust-client/crm-invoices';
import { sabcrmSupplyItemsApi } from '@/lib/rust-client/sabcrm-supply';
import { sabcrmRecordsApi } from '@/lib/rust-client/sabcrm-records';
import { sabcrmObjectsApi } from '@/lib/rust-client/sabcrm-objects';
import { sabcrmRecordLabel } from '@/lib/sabcrm/record-label';
import {
  computeDocTotals,
  isBlankDocLine,
  round2,
  type DocLineInput,
} from '@/lib/sabcrm/finance-doc-math';
import { sendSabcrmEmail } from './sabcrm-email.actions';
import type { ActionResult } from '@/lib/sabcrm/types';
import {
  SABCRM_INVOICE_TRANSITIONS,
  type SabcrmDocAttachmentInput,
  type SabcrmInvoiceFullInput,
  type SabcrmInvoiceFullPatch,
  type SabcrmInvoiceKpis,
  type SabcrmInvoiceListFilters,
  type SabcrmInvoiceListPage,
  type SabcrmInvoiceListRow,
  type SabcrmInvoicePaymentInput,
  type SabcrmItemOption,
  type SabcrmPartyContact,
  type SabcrmPartyObjectSlug,
  type SabcrmPartyOption,
  type SabcrmPartyRef,
  type SabcrmPaymentAccountOption,
  type SabcrmPaymentMode,
  type SabcrmRelatedDocRef,
} from './sabcrm-finance-invoices.actions.types';

/* ─── Gate (mirrors sabcrm-finance.actions.ts verbatim) ─────────── */

const MODULE_KEY = 'sabcrm';
const FINANCE_INVOICES_PATH = '/sabcrm/finance/invoices';

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

/* ─── Party search + resolution (records engine) ───────────────── */

const PARTY_OBJECTS: SabcrmPartyObjectSlug[] = ['companies', 'people'];

/** Best-effort email extraction from a records-engine record's data. */
function extractEmail(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const looksLikeEmail = (s: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
  // EMAILS composite (Twenty shape) first, then bare strings.
  for (const value of Object.values(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const primary = (value as { primaryEmail?: unknown }).primaryEmail;
      if (typeof primary === 'string' && looksLikeEmail(primary)) {
        return primary.trim();
      }
    }
  }
  for (const [key, value] of Object.entries(data)) {
    if (
      typeof value === 'string' &&
      /email/i.test(key) &&
      looksLikeEmail(value)
    ) {
      return value.trim();
    }
  }
  for (const value of Object.values(data)) {
    if (typeof value === 'string' && looksLikeEmail(value)) {
      return value.trim();
    }
  }
  return null;
}

/**
 * Searches `companies` + `people` for the customer picker. Each option
 * carries a real record id, a human label and (when present) an email
 * meta line — the picker never shows raw ObjectIds.
 */
export async function searchSabcrmFinanceParties(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmPartyOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const objects = await sabcrmObjectsApi.list(g.ctx.projectId);
    const out: SabcrmPartyOption[] = [];
    await Promise.all(
      PARTY_OBJECTS.map(async (slug) => {
        const object = objects.find((o) => o.slug === slug);
        if (!object) return;
        try {
          const page = await sabcrmRecordsApi.list(slug, {
            projectId: g.ctx.projectId,
            q: q.trim() || undefined,
            limit: 8,
          });
          for (const record of page.records) {
            const label = sabcrmRecordLabel(object, record);
            out.push({
              id: record.id,
              label,
              meta:
                extractEmail(record.data as Record<string, unknown>) ??
                (slug === 'companies' ? 'Company' : 'Person'),
              objectSlug: slug,
            });
          }
        } catch {
          // One object failing (e.g. not seeded yet) shouldn't kill the
          // other's results.
        }
      }),
    );
    out.sort((a, b) => a.label.localeCompare(b.label));
    return { ok: true, data: out.slice(0, 12) };
  } catch (e) {
    return fail(e, 'Failed to search customers.');
  }
}

/**
 * Batch-resolves party ids (invoice `clientId`s) to display refs across
 * `companies` + `people`. Unresolvable ids are simply absent from the
 * result — callers render a muted "Unknown customer", never a raw id.
 */
export async function resolveSabcrmFinanceParties(
  ids: string[],
  projectId?: string,
): Promise<ActionResult<SabcrmPartyRef[]>> {
  const unique = [...new Set((ids ?? []).filter(Boolean))].slice(0, 200);
  if (unique.length === 0) return { ok: true, data: [] };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const objects = await sabcrmObjectsApi.list(g.ctx.projectId);
    const resolved = new Map<string, SabcrmPartyRef>();
    await Promise.all(
      PARTY_OBJECTS.map(async (slug) => {
        const object = objects.find((o) => o.slug === slug);
        if (!object) return;
        await Promise.all(
          unique.map(async (id) => {
            if (resolved.has(id)) return;
            try {
              const record = await sabcrmRecordsApi.get(
                slug,
                id,
                g.ctx.projectId,
              );
              resolved.set(id, {
                id,
                label: sabcrmRecordLabel(object, record),
                objectSlug: slug,
              });
            } catch {
              // Not in this object (or gone) — fine.
            }
          }),
        );
      }),
    );
    return { ok: true, data: [...resolved.values()] };
  } catch (e) {
    return fail(e, 'Failed to resolve customers.');
  }
}

/**
 * Full contact lookup for ONE party — powers the detail page's party
 * card and the email-invoice dialog (recipient preview).
 */
export async function getSabcrmFinancePartyContact(
  clientId: string,
  projectId?: string,
): Promise<ActionResult<SabcrmPartyContact | null>> {
  if (!clientId) return { ok: true, data: null };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const objects = await sabcrmObjectsApi.list(g.ctx.projectId);
    for (const slug of PARTY_OBJECTS) {
      const object = objects.find((o) => o.slug === slug);
      if (!object) continue;
      try {
        const record = await sabcrmRecordsApi.get(slug, clientId, g.ctx.projectId);
        return {
          ok: true,
          data: {
            id: clientId,
            label: sabcrmRecordLabel(object, record),
            objectSlug: slug,
            email: extractEmail(record.data as Record<string, unknown>),
          },
        };
      } catch {
        // Try the next object.
      }
    }
    return { ok: true, data: null };
  } catch (e) {
    return fail(e, 'Failed to load the customer.');
  }
}

/* ─── Item search (sabcrm-supply catalog) ──────────────────────── */

/** Searches the supply catalog for the line-item picker. */
export async function searchSabcrmFinanceItems(
  q: string,
  projectId?: string,
): Promise<ActionResult<SabcrmItemOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const items = await sabcrmSupplyItemsApi.list(g.ctx.projectId, {
      q: q.trim() || undefined,
      limit: 10,
    });
    return {
      ok: true,
      data: items
        .filter((it) => it._id)
        .map((it) => ({
          id: String(it._id),
          name: it.name,
          sku: it.sku || undefined,
          description: it.description || undefined,
          sellingPrice: Number.isFinite(it.sellingPrice) ? it.sellingPrice : 0,
          taxRate: it.taxRate,
          hsnSac: it.hsnSac,
          currency: it.currency,
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to search items.');
  }
}

/* ─── Numbering ────────────────────────────────────────────────── */

/**
 * Suggests the next invoice number from the latest documents: takes the
 * highest numeric suffix among existing numbers and increments it,
 * preserving prefix + zero-padding. First invoice ⇒ `INV-<year>-0001`.
 */
export async function getNextSabcrmInvoiceNumber(
  projectId?: string,
): Promise<ActionResult<string>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs = await sabcrmFinanceApi.listInvoices(g.ctx.projectId, {
      page: 1,
      limit: 100,
    });
    let best: { prefix: string; num: number; width: number } | null = null;
    for (const doc of docs) {
      const m = /^(.*?)(\d+)\s*$/.exec(doc.invoiceNo ?? '');
      if (!m) continue;
      const num = Number(m[2]);
      if (!Number.isFinite(num)) continue;
      if (!best || num > best.num) {
        best = { prefix: m[1], num, width: m[2].length };
      }
    }
    if (!best) {
      return {
        ok: true,
        data: `INV-${new Date().getUTCFullYear()}-0001`,
      };
    }
    const next = String(best.num + 1).padStart(best.width, '0');
    return { ok: true, data: `${best.prefix}${next}` };
  } catch (e) {
    return fail(e, 'Failed to suggest an invoice number.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/** Pages the list endpoint scans for KPIs (100 docs each). */
const KPI_MAX_PAGES = 5;

/**
 * Computes the KPI strip over a capped scan (up to 500 most recent
 * invoices). `sampled: true` flags a capped result.
 */
export async function getSabcrmInvoiceKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmInvoiceKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmInvoiceDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= KPI_MAX_PAGES; page += 1) {
      const batch = await sabcrmFinanceApi.listInvoices(g.ctx.projectId, {
        page,
        limit: 100,
      });
      docs.push(...batch);
      if (batch.length < 100) break;
      if (page === KPI_MAX_PAGES) sampled = true;
    }

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const currencyVotes = new Map<string, number>();
    let totalInvoiced = 0;
    let outstanding = 0;
    let overdueCount = 0;
    let thisMonthTotal = 0;
    let thisMonthCount = 0;

    for (const doc of docs) {
      const status = (doc.status ?? 'draft') as CrmInvoiceStatus;
      const total = doc.totals?.total ?? 0;
      const currency = doc.currency || 'INR';
      currencyVotes.set(currency, (currencyVotes.get(currency) ?? 0) + 1);

      if (status !== 'cancelled') totalInvoiced += total;
      const open =
        status === 'sent' || status === 'partially_paid' || status === 'overdue';
      if (open) {
        const balance = doc.balance ?? total - (doc.amountPaid ?? 0);
        outstanding += Math.max(0, balance);
        if (doc.dueDate && new Date(doc.dueDate).getTime() < now.getTime()) {
          overdueCount += 1;
        }
      }
      if ((doc.date ?? '').slice(0, 7) === monthKey && status !== 'cancelled') {
        thisMonthTotal += total;
        thisMonthCount += 1;
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
        totalInvoiced: round2(totalInvoiced),
        outstanding: round2(outstanding),
        overdueCount,
        thisMonthTotal: round2(thisMonthTotal),
        thisMonthCount,
        count: docs.length,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute invoice KPIs.');
  }
}

/* ─── List page (display-ready rows) ───────────────────────────── */

/** Days from `dueIso` to now (UTC midnights); positive ⇒ past due. */
function agingDaysFor(dueIso: string | undefined): number | null {
  if (!dueIso) return null;
  const due = new Date(dueIso);
  if (Number.isNaN(due.getTime())) return null;
  const ms =
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    ) - Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  return Math.round(ms / 86_400_000);
}

function toListRow(
  doc: SabcrmInvoiceDoc,
  partyMap: Map<string, SabcrmPartyRef>,
): SabcrmInvoiceListRow {
  const status = (doc.status ?? 'draft') as CrmInvoiceStatus;
  const total = doc.totals?.total ?? 0;
  const amountPaid = doc.amountPaid ?? 0;
  const party = doc.clientId ? partyMap.get(doc.clientId) : undefined;
  const open =
    status === 'sent' || status === 'partially_paid' || status === 'overdue';
  return {
    id: doc._id,
    invoiceNo: doc.invoiceNo,
    partyId: doc.clientId ?? '',
    partyLabel: party?.label ?? null,
    partyObjectSlug: party?.objectSlug ?? null,
    date: doc.date,
    dueDate: doc.dueDate,
    currency: doc.currency,
    total,
    amountPaid,
    balance: doc.balance ?? total - amountPaid,
    status,
    agingDays: open ? agingDaysFor(doc.dueDate) : null,
  };
}

/**
 * Lists a page of display-ready invoice rows and resolves all party
 * labels in one batched pass. Date-range filtering is applied here (the
 * crate filters by month/year only).
 *
 * Pagination: the Rust list handler computes `skip = (page-1) * limit`
 * from the REQUESTED limit, so we must request exactly `limit` rows —
 * a `limit + 1` probe would shift every later page by one and silently
 * skip a document at each boundary. `hasMore` is therefore derived from
 * a full page (`docs.length === limit`), accepting one false-positive
 * "Next" when the total is an exact multiple of the page size (that
 * next page simply renders empty).
 */
export async function listSabcrmInvoicesPage(
  filters: SabcrmInvoiceListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmInvoiceListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  // Clamped to the crate's MAX_LIMIT (100) so the skip math stays exact.
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const docs = await sabcrmFinanceApi.listInvoices(g.ctx.projectId, {
      page,
      limit,
      q: filters.q || undefined,
      status: filters.status || undefined,
      clientId: filters.clientId || undefined,
    });

    let pageDocs = docs;
    // In-page date-range refinement (inclusive bounds on the invoice date).
    if (filters.from || filters.to) {
      const fromKey = filters.from ?? '0000-00-00';
      const toKey = filters.to ?? '9999-12-31';
      pageDocs = pageDocs.filter((d) => {
        const day = (d.date ?? '').slice(0, 10);
        return day >= fromKey && day <= toKey;
      });
    }

    const hasMore = docs.length === limit;

    const partyIds = [...new Set(pageDocs.map((d) => d.clientId).filter(Boolean))];
    const partyMap = new Map<string, SabcrmPartyRef>();
    if (partyIds.length > 0) {
      const refs = await resolveSabcrmFinanceParties(partyIds, g.ctx.projectId);
      if (refs.ok) for (const ref of refs.data) partyMap.set(ref.id, ref);
    }

    return {
      ok: true,
      data: {
        rows: pageDocs.map((d) => toListRow(d, partyMap)),
        page,
        hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list invoices.');
  }
}

/**
 * Fetch-all (capped at 500) for CSV export, honouring the current
 * filters. Returns display-ready rows so the CSV never contains ids.
 */
export async function exportSabcrmInvoiceRows(
  filters: SabcrmInvoiceListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmInvoiceListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: SabcrmInvoiceDoc[] = [];
    for (let page = 1; page <= KPI_MAX_PAGES; page += 1) {
      const batch = await sabcrmFinanceApi.listInvoices(g.ctx.projectId, {
        page,
        limit: 100,
        q: filters.q || undefined,
        status: filters.status || undefined,
        clientId: filters.clientId || undefined,
      });
      docs.push(...batch);
      if (batch.length < 100) break;
    }
    let rows = docs;
    if (filters.from || filters.to) {
      const fromKey = filters.from ?? '0000-00-00';
      const toKey = filters.to ?? '9999-12-31';
      rows = rows.filter((d) => {
        const day = (d.date ?? '').slice(0, 10);
        return day >= fromKey && day <= toKey;
      });
    }
    const partyIds = [...new Set(rows.map((d) => d.clientId).filter(Boolean))];
    const partyMap = new Map<string, SabcrmPartyRef>();
    if (partyIds.length > 0) {
      const refs = await resolveSabcrmFinanceParties(partyIds, g.ctx.projectId);
      if (refs.ok) for (const ref of refs.data) partyMap.set(ref.id, ref);
    }
    return { ok: true, data: rows.map((d) => toListRow(d, partyMap)) };
  } catch (e) {
    return fail(e, 'Failed to export invoices.');
  }
}

/* ─── Full-form create / update ────────────────────────────────── */

/** Builds the wire `items` + `totals` from form lines (authoritative). */
function buildWireMoney(lines: DocLineInput[]): {
  items: CrmInvoiceLineItem[];
  totals: CrmInvoiceTotals;
} | null {
  const meaningful = lines.filter((l) => !isBlankDocLine(l));
  if (meaningful.length === 0) return null;
  const computed = computeDocTotals(meaningful);
  return {
    items: computed.lines.map((l) => ({
      itemId:
        l.itemId && ObjectId.isValid(l.itemId) ? l.itemId : undefined,
      description: l.description?.trim() || undefined,
      hsnSac: l.hsnSac?.trim() || undefined,
      qty: l.qty,
      unit: l.unit?.trim() || undefined,
      rate: l.rate,
      discountPct: l.discountPct,
      taxRatePct: l.taxRatePct,
      total: l.total,
    })),
    totals: {
      subTotal: computed.subTotal,
      total: computed.total,
    },
  };
}

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

/**
 * Creates an invoice from the FULL doc form — real picked party, real
 * line items, server-computed totals, optional SabFiles attachments,
 * optional lineage parent, optional immediate issue (`sent`).
 */
export async function createSabcrmInvoiceFull(
  input: SabcrmInvoiceFullInput,
  projectId?: string,
): Promise<ActionResult<SabcrmInvoiceDoc>> {
  if (!input?.invoiceNo?.trim()) {
    return { ok: false, error: 'An invoice number is required.' };
  }
  if (!input.clientId || !ObjectId.isValid(input.clientId)) {
    return { ok: false, error: 'Pick a customer for this invoice.' };
  }
  if (!input.currency?.trim()) {
    return { ok: false, error: 'A currency is required.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid invoice date is required.' };
  const dueIso = input.dueDate ? toIso(input.dueDate) : dateIso;
  if (!dueIso) return { ok: false, error: 'The due date is invalid.' };
  const money = buildWireMoney(input.lines ?? []);
  if (!money) {
    return { ok: false, error: 'Add at least one line item.' };
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
      items: money.items,
      totals: money.totals,
      paymentTerms: input.paymentTerms?.trim() || undefined,
      customerNotes: input.customerNotes?.trim() || undefined,
      termsAndConditions: input.termsAndConditions?.trim() || undefined,
      attachments: cleanAttachments(input.attachments),
      fromKind: input.fromKind,
      fromId:
        input.fromId && ObjectId.isValid(input.fromId)
          ? input.fromId
          : undefined,
    });

    let result = created;
    if (input.issue) {
      result = await sabcrmFinanceApi.updateInvoice(
        g.ctx.projectId,
        created._id,
        { status: 'sent' },
      );
    }

    revalidatePath(FINANCE_INVOICES_PATH);
    return { ok: true, data: result };
  } catch (e) {
    return fail(e, 'Failed to create invoice.');
  }
}

/** Full-form partial update (number, party, dates, lines, notes, files). */
export async function updateSabcrmInvoiceFull(
  id: string,
  patch: SabcrmInvoiceFullPatch,
  projectId?: string,
): Promise<ActionResult<SabcrmInvoiceDoc>> {
  if (!id) return { ok: false, error: 'Invoice id is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: SabcrmInvoiceUpdateInput = {};
  if (patch.invoiceNo !== undefined) {
    if (!patch.invoiceNo.trim()) {
      return { ok: false, error: 'An invoice number is required.' };
    }
    wire.invoiceNo = patch.invoiceNo.trim();
  }
  if (patch.clientId !== undefined) {
    if (!patch.clientId || !ObjectId.isValid(patch.clientId)) {
      return { ok: false, error: 'Pick a customer for this invoice.' };
    }
    wire.clientId = patch.clientId;
  }
  if (patch.currency !== undefined) {
    if (!patch.currency.trim()) {
      return { ok: false, error: 'A currency is required.' };
    }
    wire.currency = patch.currency.trim().toUpperCase();
  }
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
  if (patch.lines !== undefined) {
    const money = buildWireMoney(patch.lines);
    if (!money) return { ok: false, error: 'Add at least one line item.' };
    wire.items = money.items;
    wire.totals = money.totals;
  }
  if (patch.paymentTerms !== undefined) wire.paymentTerms = patch.paymentTerms;
  if (patch.customerNotes !== undefined) {
    wire.customerNotes = patch.customerNotes;
  }
  if (patch.termsAndConditions !== undefined) {
    wire.termsAndConditions = patch.termsAndConditions;
  }
  if (patch.attachments !== undefined) {
    wire.attachments = cleanAttachments(patch.attachments) ?? [];
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

/* ─── Status transitions ───────────────────────────────────────── */

/**
 * Applies a workflow transition, validated against the crate vocabulary
 * AND the allowed-transition map (e.g. a paid invoice can't be re-sent).
 */
export async function transitionSabcrmInvoiceStatus(
  id: string,
  next: CrmInvoiceStatus,
  projectId?: string,
): Promise<ActionResult<SabcrmInvoiceDoc>> {
  if (!id) return { ok: false, error: 'Invoice id is required.' };
  if (!(next in SABCRM_INVOICE_TRANSITIONS)) {
    return { ok: false, error: 'Invalid invoice status.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const current = await sabcrmFinanceApi.getInvoice(g.ctx.projectId, id);
    const from = (current.status ?? 'draft') as CrmInvoiceStatus;
    if (!SABCRM_INVOICE_TRANSITIONS[from]?.includes(next)) {
      return {
        ok: false,
        error: `Can't move an invoice from "${from.replace('_', ' ')}" to "${next.replace('_', ' ')}".`,
      };
    }
    const data = await sabcrmFinanceApi.updateInvoice(g.ctx.projectId, id, {
      status: next,
    });
    revalidatePath(FINANCE_INVOICES_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the invoice status.');
  }
}

/* ─── Payments ─────────────────────────────────────────────────── */

const PAYMENT_MODES: ReadonlySet<SabcrmPaymentMode> = new Set([
  'cash',
  'cheque',
  'upi',
  'neft',
  'rtgs',
  'imps',
  'card',
  'wallet',
]);

/** Payment-account options for the record-payment dialog (real ids only). */
export async function listSabcrmPaymentAccountOptions(
  projectId?: string,
): Promise<ActionResult<SabcrmPaymentAccountOption[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };
  try {
    const res = await sabcrmFinancePaymentAccountsApi.list(g.ctx.projectId, {
      limit: 50,
    });
    return {
      ok: true,
      data: res.items
        .filter((a) => a._id)
        .map((a) => ({
          id: String(a._id),
          label: a.accountName || 'Unnamed account',
        })),
    };
  } catch (e) {
    return fail(e, 'Failed to list payment accounts.');
  }
}

/**
 * Records a payment against an invoice:
 *   1. creates a `crm-payment-receipts` document with `applyTo` +
 *      `fromKind: 'invoice'` (which back-links the receipt into the
 *      invoice's lineage on the Rust side);
 *   2. folds the new cumulative `amountPaid` onto the invoice and moves
 *      its status to `paid` / `partially_paid` (the Rust handler
 *      re-derives `balance`).
 *
 * The bank account is a REAL picked payment account — never minted.
 */
export async function recordSabcrmInvoicePayment(
  id: string,
  input: SabcrmInvoicePaymentInput,
  projectId?: string,
): Promise<ActionResult<SabcrmInvoiceDoc>> {
  if (!id) return { ok: false, error: 'Invoice id is required.' };
  const amount = Number(input?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Payment amount must be greater than zero.' };
  }
  if (!PAYMENT_MODES.has(input.mode)) {
    return { ok: false, error: 'Pick a valid payment mode.' };
  }
  if (!input.bankAccountId || !ObjectId.isValid(input.bankAccountId)) {
    return { ok: false, error: 'Pick the account that received this payment.' };
  }
  const dateIso = input.date ? toIso(input.date) : null;
  if (!dateIso) return { ok: false, error: 'A valid payment date is required.' };

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const invoice = await sabcrmFinanceApi.getInvoice(g.ctx.projectId, id);
    const status = (invoice.status ?? 'draft') as CrmInvoiceStatus;
    if (status === 'cancelled' || status === 'draft') {
      return {
        ok: false,
        error:
          status === 'draft'
            ? 'Issue the invoice before recording a payment.'
            : "Can't record a payment on a cancelled invoice.",
      };
    }

    const day = dateIso.slice(0, 10).replaceAll('-', '');
    const receiptNo = `RCT-${day}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    await sabcrmFinancePaymentReceiptsApi.create(g.ctx.projectId, {
      receiptNo,
      date: dateIso,
      clientId: invoice.clientId,
      mode: input.mode,
      bankAccountId: input.bankAccountId,
      amount: round2(amount),
      currency: invoice.currency,
      reference: input.reference?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      applyTo: [{ invoiceId: id, amount: round2(amount) }],
      fromKind: 'invoice',
      fromId: id,
    });

    const total = invoice.totals?.total ?? 0;
    const newPaid = round2((invoice.amountPaid ?? 0) + amount);
    const nextStatus: CrmInvoiceStatus =
      newPaid + 0.005 >= total ? 'paid' : 'partially_paid';

    const data = await sabcrmFinanceApi.updateInvoice(g.ctx.projectId, id, {
      amountPaid: newPaid,
      status: nextStatus,
    });
    revalidatePath(FINANCE_INVOICES_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to record the payment.');
  }
}

/* ─── Related documents (lineage rail) ─────────────────────────── */

const PARENT_ROUTES: Record<string, string | null> = {
  quotation: '/sabcrm/finance/quotations',
  salesOrder: '/sabcrm/finance/sales-orders',
  proforma: '/sabcrm/finance/proforma-invoices',
  deal: null,
  lead: null,
  invoice: '/sabcrm/finance/invoices',
};

function humaniseKind(kind: string): string {
  return kind
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

/**
 * Builds the related-documents rail: lineage PARENTS (resolved to their
 * doc numbers where a finance surface exists) + receipt CHILDREN
 * (payment receipts applied to this invoice).
 */
export async function getSabcrmInvoiceRelated(
  id: string,
  projectId?: string,
): Promise<ActionResult<SabcrmRelatedDocRef[]>> {
  if (!id) return { ok: false, error: 'Invoice id is required.' };

  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const invoice = await sabcrmFinanceApi.getInvoice(g.ctx.projectId, id);
    const out: SabcrmRelatedDocRef[] = [];

    // Parents — the invoice's own lineage chain.
    await Promise.all(
      (invoice.lineage ?? []).map(async (ref) => {
        const base: SabcrmRelatedDocRef = {
          kind: ref.kind,
          id: ref.id,
          label: humaniseKind(ref.kind),
          href: PARENT_ROUTES[ref.kind] ?? null,
          direction: 'parent',
        };
        try {
          if (ref.kind === 'quotation') {
            const doc = await sabcrmFinanceQuotationsApi.getById(
              g.ctx.projectId,
              ref.id,
            );
            base.label = doc.quotationNo ?? base.label;
            base.date = doc.date;
            base.status = doc.status;
          } else if (ref.kind === 'salesOrder') {
            const doc = await sabcrmFinanceSalesOrdersApi.getById(
              g.ctx.projectId,
              ref.id,
            );
            base.label = doc.soNo ?? base.label;
            base.date = doc.date;
            base.status = doc.status;
          } else if (ref.kind === 'proforma') {
            const doc = await sabcrmFinanceProformaInvoicesApi.getById(
              g.ctx.projectId,
              ref.id,
            );
            base.label = doc.proformaNumber ?? base.label;
            base.status = doc.status;
          }
        } catch {
          // Parent gone — keep the humanised kind, drop the link.
          base.href = null;
        }
        out.push(base);
      }),
    );

    // Children — receipts applied to this invoice.
    try {
      const receipts = await sabcrmFinancePaymentReceiptsApi.list(
        g.ctx.projectId,
        { clientId: invoice.clientId, limit: 100 },
      );
      for (const receipt of receipts) {
        const applied = (receipt.applyTo ?? []).some(
          (a) => a.invoiceId === id,
        );
        const linked = (receipt.lineage ?? []).some(
          (l) => l.kind === 'invoice' && l.id === id,
        );
        if (!applied && !linked) continue;
        out.push({
          kind: 'paymentReceipt',
          id: receipt._id,
          label: receipt.receiptNo,
          href: '/sabcrm/finance/payment-receipts',
          date: receipt.date,
          amount:
            (receipt.applyTo ?? []).find((a) => a.invoiceId === id)?.amount ??
            receipt.amount,
          currency: receipt.currency,
          status: receipt.status,
          direction: 'child',
        });
      }
    } catch {
      // Receipts engine down — parents alone still render.
    }

    return { ok: true, data: out };
  } catch (e) {
    return fail(e, 'Failed to load related documents.');
  }
}

/* ─── Email invoice ────────────────────────────────────────────── */

/**
 * Emails an invoice to its linked customer. The recipient address is
 * re-resolved server-side from the record by `sendSabcrmEmail` — the
 * client supplies only subject/body. On success the send is appended to
 * the invoice's `emailLog` (the detail page's activity feed sources it)
 * and a `draft` invoice is moved to `sent` (issuing it implicitly).
 */
export async function emailSabcrmInvoice(
  id: string,
  input: { subject: string; body: string },
  projectId?: string,
): Promise<ActionResult<{ to: string }>> {
  if (!id) return { ok: false, error: 'Invoice id is required.' };
  if (!input?.subject?.trim()) {
    return { ok: false, error: 'A subject is required.' };
  }
  if (!input.body?.trim()) {
    return { ok: false, error: 'A message body is required.' };
  }

  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const invoice = await sabcrmFinanceApi.getInvoice(g.ctx.projectId, id);
    const contact = await getSabcrmFinancePartyContact(
      invoice.clientId,
      g.ctx.projectId,
    );
    if (!contact.ok) return { ok: false, error: contact.error };
    if (!contact.data) {
      return {
        ok: false,
        error: 'The linked customer record could not be found.',
      };
    }
    if (!contact.data.email) {
      return {
        ok: false,
        error: `${contact.data.label} has no email address on their record.`,
      };
    }

    const sent = await sendSabcrmEmail(
      g.ctx.projectId,
      contact.data.objectSlug,
      contact.data.id,
      { subject: input.subject.trim(), body: input.body },
    );
    if (!sent.ok) return { ok: false, error: sent.error };

    // Record the send on the invoice's append-only emailLog (the
    // activity feed renders it) and — implicit issue — flip a mailed
    // draft to `sent` in the same PATCH.
    try {
      await sabcrmFinanceApi.updateInvoice(g.ctx.projectId, id, {
        emailLogAppend: [
          {
            sentAt: new Date().toISOString(),
            to: contact.data.email,
            status: 'sent',
            providerMessageId: sent.data.messageId,
          },
        ],
        ...((invoice.status ?? 'draft') === 'draft'
          ? { status: 'sent' as const }
          : {}),
      });
    } catch {
      // Non-fatal — the email went out; only the audit-log PATCH failed.
    }

    revalidatePath(FINANCE_INVOICES_PATH);
    return { ok: true, data: { to: contact.data.email } };
  } catch (e) {
    return fail(e, 'Failed to email the invoice.');
  }
}
