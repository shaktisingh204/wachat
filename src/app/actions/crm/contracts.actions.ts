'use server';

/**
 * CRM Contracts server actions (Wave 2 — §1D).
 *
 * Thin shims over `crmContractsApi` (Rust BFF) with the canonical
 * shape: RBAC guard + audit log + `recordRustFallback()` on failure +
 * `useRustCrm()` Rust branch. Mirrors `subscriptions.actions.ts`.
 *
 * The legacy `src/app/actions/crm-contracts.actions.ts` still exists
 * for back-compat with the older `<ContractForm>` and detail page;
 * new Wave-2 pages bind to *this* file instead. Both can co-exist —
 * they hit the same Rust handler.
 *
 * KPIs are derived from the same `crmContractsApi.list` because the
 * BFF does not expose a dedicated `/kpis` route for contracts (yet).
 * When that lands, swap the helper to the Rust call without touching
 * the page.
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { requirePermission } from '@/lib/rbac-server';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
  crmContractsApi,
  type CrmContractCreateInput,
  type CrmContractDoc,
  type CrmContractListParams,
  type CrmContractListResponse,
  type CrmContractStatus,
  type CrmContractUpdateInput,
} from '@/lib/rust-client/crm-contracts';

/* ─── Constants ───────────────────────────────────────────────── */

const LIST_PATH = '/dashboard/crm/sales/contracts';

/**
 * Wave-2 contract lifecycle. The Rust client still types its DB-level
 * union as `draft | active | expired | cancelled | archived`; the
 * Wave-2 enum catalog catalogs `draft | pending_signature | active |
 * expired | terminated | renewed`. We carry the wider type at the
 * application layer and persist as a free-string so the catalog can
 * evolve without a BFF deploy.
 */
type ContractStatusV2 =
  | 'draft'
  | 'pending_signature'
  | 'active'
  | 'expired'
  | 'terminated'
  | 'renewed';

const CONTRACT_STATUS_V2_VALUES: ContractStatusV2[] = [
  'draft',
  'pending_signature',
  'active',
  'expired',
  'terminated',
  'renewed',
];

function useRustCrm(): boolean {
  return process.env.USE_RUST_CRM === 'true';
}

function rustErr(e: unknown): string {
  if (e instanceof RustApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Unexpected error.';
}

function revalidateContracts(id?: string): void {
  revalidatePath(LIST_PATH);
  if (id) revalidatePath(`${LIST_PATH}/${id}`);
}

/* ─── Read ────────────────────────────────────────────────────── */

interface ContractListResult {
  contracts: CrmContractDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  error?: string;
}

export async function listContracts(
  params: CrmContractListParams = {},
): Promise<ContractListResult> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(Math.max(1, params.limit ?? 20), 100);

  const session = await getSession();
  if (!session?.user) {
    return { contracts: [], page, limit, hasMore: false, error: 'Unauthorized' };
  }
  const guard = await requirePermission('crm_contract', 'view');
  if (!guard.ok) {
    return { contracts: [], page, limit, hasMore: false, error: guard.error };
  }

  try {
    const res: CrmContractListResponse = await crmContractsApi.list({
      ...params,
      page,
      limit,
    });
    return {
      contracts: res.items,
      page: res.page,
      limit: res.limit,
      hasMore: res.hasMore,
    };
  } catch (e) {
    console.error('[listContracts] rust path failed; falling back:', e);
    recordRustFallback({
      entity: 'contract',
      op: 'list',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { contracts: [], page, limit, hasMore: false, error: rustErr(e) };
  }
}

export async function getContract(
  id: string,
): Promise<{ contract: CrmContractDoc | null; error?: string }> {
  if (!id) return { contract: null, error: 'Missing contract id.' };
  const session = await getSession();
  if (!session?.user) return { contract: null, error: 'Unauthorized' };
  const guard = await requirePermission('crm_contract', 'view');
  if (!guard.ok) return { contract: null, error: guard.error };

  try {
    const contract = await crmContractsApi.getById(id);
    return { contract };
  } catch (e) {
    if (e instanceof RustApiError && e.status === 404) {
      return { contract: null, error: 'Contract not found.' };
    }
    console.error('[getContract] rust path failed; falling back:', e);
    recordRustFallback({
      entity: 'contract',
      op: 'get',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return { contract: null, error: rustErr(e) };
  }
}

/* ─── KPIs ────────────────────────────────────────────────────── */

interface ContractKpisV2 {
  active: number;
  pendingSignature: number;
  expiringSoon: number;
  terminated: number;
  renewed: number;
}

const EMPTY_KPIS: ContractKpisV2 = {
  active: 0,
  pendingSignature: 0,
  expiringSoon: 0,
  terminated: 0,
  renewed: 0,
};

/**
 * Soft KPI rollup. Pulls the most recent 500 contracts from the Rust
 * BFF and counts in-memory — sufficient for SMB-scale tenants. Swap
 * to a dedicated `/v1/crm/contracts/kpis` once that route lands.
 */
export async function getContractKpisV2(): Promise<ContractKpisV2> {
  const session = await getSession();
  if (!session?.user) return EMPTY_KPIS;
  const guard = await requirePermission('crm_contract', 'view');
  if (!guard.ok) return EMPTY_KPIS;

  try {
    const res = await crmContractsApi.list({ page: 1, limit: 500 });
    const rows = res.items ?? [];
    const now = Date.now();
    const thirty = now + 30 * 24 * 60 * 60 * 1000;

    let active = 0;
    let pendingSignature = 0;
    let expiringSoon = 0;
    let terminated = 0;
    let renewed = 0;

    for (const c of rows) {
      const status = (c.status as string) ?? '';
      if (status === 'active') active += 1;
      if (status === 'pending_signature') pendingSignature += 1;
      if (status === 'terminated' || status === 'cancelled') terminated += 1;
      if (status === 'renewed') renewed += 1;

      if (c.expiryDate && status !== 'terminated' && status !== 'cancelled') {
        const t = new Date(c.expiryDate).getTime();
        if (Number.isFinite(t) && t >= now && t <= thirty) {
          expiringSoon += 1;
        }
      }
    }

    return { active, pendingSignature, expiringSoon, terminated, renewed };
  } catch (e) {
    console.error('[getContractKpisV2] rust path failed; falling back:', e);
    recordRustFallback({
      entity: 'contract',
      op: 'list',
      errorCode: e instanceof RustApiError ? e.code : undefined,
      status: e instanceof RustApiError ? e.status : undefined,
    });
    return EMPTY_KPIS;
  }
}

/* ─── Write ───────────────────────────────────────────────────── */

function pickString(formData: FormData, key: string): string | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t.length === 0 ? undefined : t;
}

function pickNumber(formData: FormData, key: string): number | undefined {
  const v = formData.get(key);
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function pickBool(formData: FormData, key: string): boolean {
  const v = formData.get(key);
  if (typeof v !== 'string') return false;
  return v === 'on' || v === 'true' || v === '1';
}

function isoOrUndefined(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function pickAttachments(formData: FormData): string[] | undefined {
  const raw = formData.get('attachments');
  if (typeof raw !== 'string' || raw.trim().length === 0) return undefined;
  // The Wave-2 form serialises attachments as a JSON array of URLs;
  // legacy callers pipe-separate. Accept both.
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
        .map((u) => u.trim());
    }
  } catch {
    /* fall through to pipe split */
  }
  return raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Server-action entry point for the create / edit form. If FormData
 * carries an `_id` (or `contractId`) the handler does a PATCH;
 * otherwise POST.
 */
export async function saveContractAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
  const session = await getSession();
  if (!session?.user) return { error: 'Unauthorized' };

  const id =
    pickString(formData, '_id') ?? pickString(formData, 'contractId');
  const guard = await requirePermission(
    'crm_contract',
    id ? 'edit' : 'create',
  );
  if (!guard.ok) return { error: guard.error };

  const title = pickString(formData, 'title');
  const partyName = pickString(formData, 'partyName');
  if (!title) return { error: 'Title is required.' };
  if (!partyName) return { error: 'Counter-party is required.' };

  const draft: CrmContractCreateInput = {
    title,
    partyName,
    contractNo: pickString(formData, 'contractNo'),
    type: pickString(formData, 'type'),
    partyEmail: pickString(formData, 'partyEmail'),
    partyPhone: pickString(formData, 'partyPhone'),
    signatoryName: pickString(formData, 'signatoryName'),
    signatoryEmail: pickString(formData, 'signatoryEmail'),
    scope: pickString(formData, 'scope'),
    deliverables: pickString(formData, 'deliverables'),
    currency: pickString(formData, 'currency') ?? 'INR',
    branch: pickString(formData, 'branch'),
    ownerId: pickString(formData, 'ownerId'),
    sourceProposalId: pickString(formData, 'sourceProposalId'),
    sourceProposalNumber: pickString(formData, 'sourceProposalNumber'),
    effectiveDate: isoOrUndefined(pickString(formData, 'effectiveDate')),
    expiryDate: isoOrUndefined(pickString(formData, 'expiryDate')),
    autoRenew: pickBool(formData, 'autoRenew'),
    renewalNoticeDays: pickNumber(formData, 'renewalNoticeDays'),
    value: pickNumber(formData, 'value'),
    esignProvider: pickString(formData, 'esignProvider'),
    notes: pickString(formData, 'notes'),
    attachments: pickAttachments(formData),
  };

  const statusRaw = pickString(formData, 'status');

  if (useRustCrm()) {
    try {
      let result: CrmContractDoc;
      if (id) {
        const patch: CrmContractUpdateInput = {
          ...draft,
          status:
            (statusRaw as CrmContractStatus | undefined) ?? undefined,
        };
        result = await crmContractsApi.update(id, patch);
      } else {
        const { entity } = await crmContractsApi.create(draft);
        result = entity;
      }

      try {
        await writeAuditEntry({
          tenantUserId: String(session.user._id),
          actorId: String(session.user._id),
          action: id ? 'update' : 'create',
          entityKind: 'contract',
          entityId: String(result._id),
        });
      } catch {
        /* non-fatal */
      }

      revalidateContracts(String(result._id));
      return {
        message: id ? 'Contract updated.' : 'Contract created.',
        id: String(result._id),
      };
    } catch (e) {
      console.error('[saveContractAction] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'contract',
        op: id ? 'update' : 'create',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
      return { error: rustErr(e) };
    }
  }

  // Mongo fallback path — delegate to the legacy action so we have a
  // single source of truth for the direct DB writer. Wave-2 form
  // posts a JSON-array `attachments` field, so re-serialise to the
  // pipe-separated format the legacy handler still consumes.
  const legacy = await import('@/app/actions/crm-contracts.actions');
  const fd = new FormData();
  for (const [k, v] of formData.entries()) {
    if (k === 'attachments') {
      const list = draft.attachments ?? [];
      fd.set('attachments', list.join('|'));
    } else if (k !== '_id') {
      fd.set(k, v);
    }
  }
  if (id) {
    fd.set('contractId', id);
    return legacy.updateContract(undefined, fd);
  }
  return legacy.saveContract(undefined, fd);
}

/* ─── Delete ──────────────────────────────────────────────────── */

export async function deleteContractAction(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing contract id.' };

  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_contract', 'delete');
  if (!guard.ok) return { success: false, error: guard.error };

  if (useRustCrm()) {
    try {
      await crmContractsApi.delete(id);
      try {
        await writeAuditEntry({
          tenantUserId: String(session.user._id),
          actorId: String(session.user._id),
          action: 'delete',
          entityKind: 'contract',
          entityId: id,
        });
      } catch {
        /* non-fatal */
      }
      revalidateContracts(id);
      return { success: true };
    } catch (e) {
      if (e instanceof RustApiError && e.status === 404) {
        return { success: false, error: 'Contract not found.' };
      }
      console.error('[deleteContractAction] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'contract',
        op: 'delete',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
      return { success: false, error: rustErr(e) };
    }
  }

  const legacy = await import('@/app/actions/crm-contracts.actions');
  return legacy.deleteContract(id);
}

/* ─── Lifecycle ───────────────────────────────────────────────── */

export async function setContractStatusV2(
  id: string,
  status: ContractStatusV2,
): Promise<{ success: boolean; error?: string }> {
  if (!id) return { success: false, error: 'Missing contract id.' };
  if (!CONTRACT_STATUS_V2_VALUES.includes(status)) {
    return { success: false, error: 'Invalid status.' };
  }

  const session = await getSession();
  if (!session?.user) return { success: false, error: 'Unauthorized' };
  const guard = await requirePermission('crm_contract', 'edit');
  if (!guard.ok) return { success: false, error: guard.error };

  if (useRustCrm()) {
    try {
      // Rust client types its status union narrowly; persist the
      // Wave-2 string anyway — the BFF stores it raw.
      await crmContractsApi.update(id, {
        status: status as unknown as CrmContractStatus,
      });
      try {
        await writeAuditEntry({
          tenantUserId: String(session.user._id),
          actorId: String(session.user._id),
          action: 'status_change',
          entityKind: 'contract',
          entityId: id,
          diff: { status: { after: status } },
        });
      } catch {
        /* non-fatal */
      }
      revalidateContracts(id);
      return { success: true };
    } catch (e) {
      console.error('[setContractStatusV2] rust path failed; falling back:', e);
      recordRustFallback({
        entity: 'contract',
        op: 'update',
        errorCode: e instanceof RustApiError ? e.code : undefined,
        status: e instanceof RustApiError ? e.status : undefined,
      });
      return { success: false, error: rustErr(e) };
    }
  }

  const legacy = await import('@/app/actions/crm-contracts.actions');
  return legacy.setContractStatus(
    id,
    // Cast to the legacy's wider union — the legacy handler treats it
    // as a free string at the persistence layer.
    status as unknown as
      | 'draft'
      | 'sent'
      | 'signed'
      | 'active'
      | 'expired'
      | 'renewed'
      | 'cancelled',
  );
}

export async function markContractActive(id: string) {
  return setContractStatusV2(id, 'active');
}

export async function markContractPendingSignature(id: string) {
  return setContractStatusV2(id, 'pending_signature');
}

export async function terminateContract(id: string) {
  return setContractStatusV2(id, 'terminated');
}

export async function renewContract(id: string) {
  return setContractStatusV2(id, 'renewed');
}

export async function markContractSigned(id: string) {
  // "Signed" maps to Active in the Wave-2 lifecycle.
  return setContractStatusV2(id, 'active');
}
