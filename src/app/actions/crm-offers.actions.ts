'use server';

/**
 * CRM HR Offers — server-action wrappers around the Rust crate.
 *
 * Mirrors `crm-policies.actions.ts`. The `offerLetterUrl` field is fed by
 * `<SabFilePickerButton>` on the form side — there is NO free-text URL
 * paste anywhere (SabFiles policy).
 */

import { revalidatePath } from 'next/cache';

import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { RustApiError } from '@/lib/rust-client/fetcher';
import {
    crmOffersApi,
    type CrmOfferCreateInput,
    type CrmOfferDoc,
    type CrmOfferListParams,
    type CrmOfferListResponse,
    type CrmOfferSalaryPeriod,
    type CrmOfferStatus,
    type CrmOfferUpdateInput,
} from '@/lib/rust-client/crm-offers';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    const s = asString(v);
    if (s == null) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function asStringList(v: FormDataEntryValue | null): string[] | undefined {
    const s = asString(v);
    if (!s) return undefined;
    const list = s
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    return list.length > 0 ? list : undefined;
}

function rustError(e: unknown): { code?: string; status?: number; msg: string } {
    if (e instanceof RustApiError) {
        return { code: e.code, status: e.status, msg: e.message };
    }
    return { msg: e instanceof Error ? e.message : 'Unknown error' };
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getOffers(
    filters?: CrmOfferListParams,
): Promise<CrmOfferListResponse> {
    const empty: CrmOfferListResponse = {
        items: [],
        page: 1,
        limit: 50,
        hasMore: false,
    };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_offer', 'view');
    if (!guard.ok) return empty;

    try {
        return await crmOffersApi.list(filters);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getOffers] rust call failed:', msg);
        recordRustFallback({
            entity: 'offer',
            op: 'list',
            errorCode: code,
            status,
        });
        return empty;
    }
}

export async function getOfferById(id: string): Promise<CrmOfferDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id) return null;

    const guard = await requirePermission('crm_offer', 'view');
    if (!guard.ok) return null;

    try {
        return await crmOffersApi.getById(id);
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[getOfferById] rust call failed:', msg);
        recordRustFallback({
            entity: 'offer',
            op: 'get',
            errorCode: code,
            status,
        });
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

const VALID_STATUSES: ReadonlySet<CrmOfferStatus> = new Set<CrmOfferStatus>([
    'draft',
    'sent',
    'accepted',
    'rejected',
    'expired',
    'withdrawn',
    'archived',
]);

const VALID_PERIODS: ReadonlySet<CrmOfferSalaryPeriod> = new Set<
    CrmOfferSalaryPeriod
>(['annual', 'monthly', 'hourly']);

function readPayload(formData: FormData): {
    payload: CrmOfferCreateInput;
    error?: string;
} {
    const candidateId = asString(formData.get('candidateId'));
    if (!candidateId) {
        return {
            payload: { candidateId: '', salaryAmount: 0 },
            error: 'Candidate is required.',
        };
    }

    const salaryAmount = asNumber(formData.get('salaryAmount'));
    if (salaryAmount == null) {
        return {
            payload: { candidateId, salaryAmount: 0 },
            error: 'Salary amount is required.',
        };
    }

    const periodRaw = asString(formData.get('salaryPeriod'));
    const salaryPeriod: CrmOfferSalaryPeriod | undefined =
        periodRaw && VALID_PERIODS.has(periodRaw as CrmOfferSalaryPeriod)
            ? (periodRaw as CrmOfferSalaryPeriod)
            : undefined;

    const payload: CrmOfferCreateInput = {
        candidateId,
        candidateName: asString(formData.get('candidateName')),
        jobId: asString(formData.get('jobId')),
        jobTitle: asString(formData.get('jobTitle')),
        offerLetterUrl: asString(formData.get('offerLetterUrl')),
        salaryAmount,
        salaryCurrency: asString(formData.get('salaryCurrency')),
        bonus: asNumber(formData.get('bonus')),
        equity: asString(formData.get('equity')),
        benefits: asStringList(formData.get('benefits')),
        joiningDate: asString(formData.get('joiningDate')),
        expiresAt: asString(formData.get('expiresAt')),
        notes: asString(formData.get('notes')),
        approverId: asString(formData.get('approverId')),
        ...(salaryPeriod ? { salaryPeriod } : {}),
    };

    return { payload };
}

export async function saveOffer(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const offerId = asString(formData.get('offerId'));
    const isEditing = !!offerId;

    const guard = await requirePermission(
        'crm_offer',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const { payload, error } = readPayload(formData);
    if (error) return { error };

    const statusRaw = asString(formData.get('status'));
    const status: CrmOfferStatus | undefined =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmOfferStatus)
            ? (statusRaw as CrmOfferStatus)
            : undefined;
    const responseNotes = asString(formData.get('responseNotes'));

    try {
        if (isEditing) {
            const { candidateId: _drop, ...rest } = payload;
            void _drop;
            const patch: CrmOfferUpdateInput = {
                ...rest,
                ...(status ? { status } : {}),
                ...(responseNotes ? { responseNotes } : {}),
            };
            const updated = await crmOffersApi.update(offerId!, patch);
            revalidatePath('/dashboard/hrm/hr/offers');
            revalidatePath(`/dashboard/hrm/hr/offers/${offerId}`);
            return {
                message: 'Offer updated.',
                id: updated?._id ?? offerId,
            };
        }

        const created = await crmOffersApi.create(payload);
        revalidatePath('/dashboard/hrm/hr/offers');
        return {
            message: 'Offer created.',
            id: created.id,
        };
    } catch (e) {
        const { code, status: errStatus, msg } = rustError(e);
        console.error('[saveOffer] rust call failed:', msg);
        recordRustFallback({
            entity: 'offer',
            op: isEditing ? 'update' : 'create',
            errorCode: code,
            status: errStatus,
        });
        return { error: `Failed to save offer: ${msg}` };
    }
}

export async function deleteOffer(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id) return { success: false, error: 'Offer id is required.' };

    const guard = await requirePermission('crm_offer', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const result = await crmOffersApi.delete(id);
        revalidatePath('/dashboard/hrm/hr/offers');
        return { success: !!result?.deleted };
    } catch (e) {
        const { code, status, msg } = rustError(e);
        console.error('[deleteOffer] rust call failed:', msg);
        recordRustFallback({
            entity: 'offer',
            op: 'delete',
            errorCode: code,
            status,
        });
        return { success: false, error: `Failed to delete offer: ${msg}` };
    }
}
