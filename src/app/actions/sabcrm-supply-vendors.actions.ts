'use server';

/**
 * SabCRM Supply — vendor surface server actions (rollout WI-7).
 *
 * The doc-surface-kit data paths for `/sabcrm/supply/vendors`,
 * mirroring the finance master-data structure
 * (`sabcrm-finance-payment-accounts.actions.ts`):
 *
 *   - paged display-ready list rows (every editable field carried on
 *     the row so a click opens the edit drawer with no second fetch);
 *   - KPI strip (vendors / with GSTIN / with bank details / vendor
 *     types) over a capped scan;
 *   - capped fetch-all for CSV export;
 *   - full-form create/update over the entire `CreateVendorInput` DTO
 *     (identity, contact, address, tax, banking, invoice flags,
 *     attachments).
 *
 * Get + the shared `updateSabcrmSupplyVendor` master-data patch live in
 * `sabcrm-supply-docs.actions.ts`; the full-DTO create/update verbs the
 * drawer needs live here. Vendors are master data — the crate has NO
 * status column, so there is no transition action and no `[id]` page.
 *
 * Every action re-runs the session → project → RBAC → plan gate. The
 * Rust engine may be down at dev time — failures normalise into
 * `{ ok: false, error }`.
 */

import { revalidatePath } from 'next/cache';
import { getCachedSession, getCachedProjects } from '@/lib/server-cache';
import { canServer } from '@/lib/rbac-server';
import type { PermissionAction } from '@/lib/rbac';
import { sabcrmPlanFeature } from '@/lib/plans';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  sabcrmSupplyVendorsApi,
  type CrmVendorDoc,
} from '@/lib/rust-client/sabcrm-supply';
import type {
  CrmVendorBankDetails,
  CrmVendorCreateInput,
  CrmVendorUpdateInput,
} from '@/lib/rust-client/crm-vendors';
import type { ActionResult } from '@/lib/sabcrm/types';
import type {
  SabcrmVendorFullInput,
  SabcrmVendorFullPatch,
  SabcrmVendorKpis,
  SabcrmVendorListFilters,
  SabcrmVendorListPage,
  SabcrmVendorListRow,
} from './sabcrm-supply-vendors.actions.types';

/* ─── Gate (mirrors sabcrm-supply-docs.actions.ts verbatim) ────── */

const MODULE_KEY = 'sabcrm';
const VENDORS_PATH = '/sabcrm/supply/vendors';

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

/* ─── Wire helpers ─────────────────────────────────────────────── */

/** Trim a string to `undefined` when blank (keeps the DTO sparse). */
function clean(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

/** Bank details → wire shape, dropping a wholly-empty group. */
function cleanBank(
  bank: CrmVendorBankDetails | undefined,
): CrmVendorBankDetails | undefined {
  if (!bank) return undefined;
  const out: CrmVendorBankDetails = {
    accountNumber: clean(bank.accountNumber),
    accountHolder: clean(bank.accountHolder),
    ifsc: clean(bank.ifsc),
    bankName: clean(bank.bankName),
    accountType: bank.accountType,
    currency: clean(bank.currency),
    swiftCode: clean(bank.swiftCode),
    ibanCode: clean(bank.ibanCode),
  };
  const hasAny = Object.values(out).some((v) => v !== undefined);
  return hasAny ? out : undefined;
}

/** Full input → `CrmVendorCreateInput` (shared by create + update). */
function toWire(
  input: SabcrmVendorFullInput,
): CrmVendorCreateInput {
  return {
    name: input.name.trim(),
    displayName: clean(input.displayName),
    industry: clean(input.industry),
    logoUrl: clean(input.logoUrl),
    email: clean(input.email),
    phone: clean(input.phone),
    street: clean(input.street),
    city: clean(input.city),
    state: clean(input.state),
    country: clean(input.country),
    pincode: clean(input.pincode),
    gstin: clean(input.gstin),
    pan: clean(input.pan),
    panName: clean(input.panName),
    vendorType: clean(input.vendorType),
    taxTreatment: clean(input.taxTreatment),
    subject: clean(input.subject),
    bankAccountDetails: cleanBank(input.bankAccountDetails),
    showEmailInInvoice: input.showEmailInInvoice,
    showPhoneInInvoice: input.showPhoneInInvoice,
    attachments: input.attachments?.filter(Boolean),
  };
}

/** Doc → display-ready row (every editable field carried). */
function toListRow(doc: CrmVendorDoc): SabcrmVendorListRow {
  return {
    id: String(doc._id ?? ''),
    name: doc.name ?? '',
    displayName: doc.displayName ?? '',
    industry: doc.industry ?? '',
    logoUrl: doc.logoUrl ?? '',
    email: doc.email ?? '',
    phone: doc.phone ?? '',
    street: doc.street ?? '',
    city: doc.city ?? '',
    state: doc.state ?? '',
    country: doc.country ?? '',
    pincode: doc.pincode ?? '',
    gstin: doc.gstin ?? '',
    pan: doc.pan ?? '',
    panName: doc.panName ?? '',
    vendorType: doc.vendorType ?? '',
    taxTreatment: doc.taxTreatment ?? '',
    subject: doc.subject ?? '',
    bankAccountDetails: doc.bankAccountDetails ?? null,
    showEmailInInvoice: !!doc.showEmailInInvoice,
    showPhoneInInvoice: !!doc.showPhoneInInvoice,
    attachments: doc.attachments ?? [],
    createdAt: doc.createdAt ?? '',
  };
}

/** In-page inclusive date-range refinement (the crate has no from/to). */
function applyDateRange(
  docs: CrmVendorDoc[],
  from?: string,
  to?: string,
): CrmVendorDoc[] {
  if (!from && !to) return docs;
  const fromKey = from ?? '0000-00-00';
  const toKey = to ?? '9999-12-31';
  return docs.filter((d) => {
    const day = (d.createdAt ?? '').slice(0, 10);
    return day >= fromKey && day <= toKey;
  });
}

/* ─── List page (display-ready rows) ───────────────────────────── */

/**
 * Lists a page of display-ready vendor rows. Pagination is normalized
 * by `listPaged` (crm-common style / 0-indexed — never hand-rolled).
 */
export async function listSabcrmSupplyVendorsPage(
  filters: SabcrmVendorListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmVendorListPage>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);

  try {
    const { items, hasMore } = await sabcrmSupplyVendorsApi.listPaged(
      g.ctx.projectId,
      {
        page,
        limit,
        q: filters.q || undefined,
      },
    );
    const pageDocs = applyDateRange(items, filters.from, filters.to);
    return {
      ok: true,
      data: {
        rows: pageDocs.map(toListRow),
        page,
        hasMore,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to list vendors.');
  }
}

/** Pages the list endpoint scans for KPIs / CSV (100 docs each). */
const SCAN_MAX_PAGES = 5;

/**
 * Fetch-all (capped at 500) for CSV export, honouring the current
 * filters. Returns display-ready rows so the CSV never contains ids.
 */
export async function exportSabcrmSupplyVendorRows(
  filters: SabcrmVendorListFilters,
  projectId?: string,
): Promise<ActionResult<SabcrmVendorListRow[]>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmVendorDoc[] = [];
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const { items, hasMore } = await sabcrmSupplyVendorsApi.listPaged(
        g.ctx.projectId,
        { page, limit: 100, q: filters.q || undefined },
      );
      docs.push(...items);
      if (!hasMore) break;
    }
    const rows = applyDateRange(docs, filters.from, filters.to);
    return { ok: true, data: rows.map(toListRow) };
  } catch (e) {
    return fail(e, 'Failed to export vendors.');
  }
}

/* ─── KPIs ─────────────────────────────────────────────────────── */

/** Computes the KPI strip over a capped scan (up to 500 vendors). */
export async function getSabcrmSupplyVendorKpis(
  projectId?: string,
): Promise<ActionResult<SabcrmVendorKpis>> {
  const g = await gate('view', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const docs: CrmVendorDoc[] = [];
    let sampled = false;
    for (let page = 1; page <= SCAN_MAX_PAGES; page += 1) {
      const { items, hasMore } = await sabcrmSupplyVendorsApi.listPaged(
        g.ctx.projectId,
        { page, limit: 100 },
      );
      docs.push(...items);
      if (!hasMore) break;
      if (page === SCAN_MAX_PAGES) sampled = true;
    }

    const vendorTypes = new Set<string>();
    let withGstin = 0;
    let withBankDetails = 0;
    for (const doc of docs) {
      if ((doc.gstin ?? '').trim()) withGstin += 1;
      if (doc.bankAccountDetails?.accountNumber?.trim()) withBankDetails += 1;
      if ((doc.vendorType ?? '').trim()) vendorTypes.add(doc.vendorType!.trim());
    }

    return {
      ok: true,
      data: {
        count: docs.length,
        withGstin,
        withBankDetails,
        vendorTypeCount: vendorTypes.size,
        sampled,
      },
    };
  } catch (e) {
    return fail(e, 'Failed to compute vendor KPIs.');
  }
}

/* ─── Full-form create / update ────────────────────────────────── */

/** Creates a vendor from the FULL drawer payload. */
export async function createSabcrmSupplyVendorFull(
  input: SabcrmVendorFullInput,
  projectId?: string,
): Promise<ActionResult<CrmVendorDoc>> {
  if (!input?.name?.trim()) {
    return { ok: false, error: 'A vendor name is required.' };
  }
  const g = await gate('create', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  try {
    const created = await sabcrmSupplyVendorsApi.create(
      g.ctx.projectId,
      toWire(input),
    );
    revalidatePath(VENDORS_PATH);
    return { ok: true, data: created };
  } catch (e) {
    return fail(e, 'Failed to create the vendor.');
  }
}

/** Patches a vendor from the FULL drawer payload (every field). */
export async function updateSabcrmSupplyVendorFull(
  id: string,
  patch: SabcrmVendorFullPatch,
  projectId?: string,
): Promise<ActionResult<CrmVendorDoc>> {
  if (!id) return { ok: false, error: 'Vendor id is required.' };
  if (patch.name !== undefined && !patch.name.trim()) {
    return { ok: false, error: 'A vendor name is required.' };
  }
  const g = await gate('edit', projectId);
  if (!g.ok) return { ok: false, error: g.error };

  const wire: CrmVendorUpdateInput = {};
  if (patch.name !== undefined) wire.name = patch.name.trim();
  if (patch.displayName !== undefined) wire.displayName = clean(patch.displayName);
  if (patch.industry !== undefined) wire.industry = clean(patch.industry);
  if (patch.logoUrl !== undefined) wire.logoUrl = clean(patch.logoUrl);
  if (patch.email !== undefined) wire.email = clean(patch.email);
  if (patch.phone !== undefined) wire.phone = clean(patch.phone);
  if (patch.street !== undefined) wire.street = clean(patch.street);
  if (patch.city !== undefined) wire.city = clean(patch.city);
  if (patch.state !== undefined) wire.state = clean(patch.state);
  if (patch.country !== undefined) wire.country = clean(patch.country);
  if (patch.pincode !== undefined) wire.pincode = clean(patch.pincode);
  if (patch.gstin !== undefined) wire.gstin = clean(patch.gstin);
  if (patch.pan !== undefined) wire.pan = clean(patch.pan);
  if (patch.panName !== undefined) wire.panName = clean(patch.panName);
  if (patch.vendorType !== undefined) wire.vendorType = clean(patch.vendorType);
  if (patch.taxTreatment !== undefined) {
    wire.taxTreatment = clean(patch.taxTreatment);
  }
  if (patch.subject !== undefined) wire.subject = clean(patch.subject);
  if (patch.bankAccountDetails !== undefined) {
    wire.bankAccountDetails = cleanBank(patch.bankAccountDetails);
  }
  if (patch.showEmailInInvoice !== undefined) {
    wire.showEmailInInvoice = patch.showEmailInInvoice;
  }
  if (patch.showPhoneInInvoice !== undefined) {
    wire.showPhoneInInvoice = patch.showPhoneInInvoice;
  }
  if (patch.attachments !== undefined) {
    wire.attachments = patch.attachments.filter(Boolean);
  }
  if (Object.keys(wire).length === 0) {
    return { ok: false, error: 'Nothing to update.' };
  }

  try {
    const data = await sabcrmSupplyVendorsApi.update(g.ctx.projectId, id, wire);
    revalidatePath(VENDORS_PATH);
    return { ok: true, data };
  } catch (e) {
    return fail(e, 'Failed to update the vendor.');
  }
}
