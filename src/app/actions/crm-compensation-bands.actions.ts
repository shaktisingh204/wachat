'use server';

/**
 * CRM Compensation Bands — settings-style server actions.
 *
 * Backed directly by MongoDB (`crm_compensation_bands`). No Rust crate.
 * Each band describes a salary band attached to a role / level /
 * department, with min / mid / max salary, currency, perks, etc.
 *
 * Fields per spec:
 *   name, code, level, min_salary, max_salary, mid_salary,
 *   currency, department_id, role_title, perks (string[]),
 *   is_active, status.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmCompensationBandsApi } from '@/lib/rust-client/crm-compensation-bands';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Types ──────────────────────────────────────────────────────────── */

type CrmCompensationBandStatus =
    | 'draft'
    | 'active'
    | 'inactive'
    | 'archived';

interface CrmCompensationBandDoc {
    _id: string;
    userId?: string;
    name: string;
    code?: string;
    level?: string;
    min_salary?: number;
    max_salary?: number;
    mid_salary?: number;
    currency?: string;
    department_id?: string;
    role_title?: string;
    perks: string[];
    is_active: boolean;
    status: CrmCompensationBandStatus;
    createdAt?: string;
    updatedAt?: string;
}

interface ListCompensationBandsParams {
    q?: string;
    status?: CrmCompensationBandStatus | 'all';
    level?: string | 'all';
    limit?: number;
}

const COLLECTION = 'crm_compensation_bands';
const BASE_PATH = '/dashboard/hrm/hr/compensation-bands';

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

function asNumber(v: FormDataEntryValue | null): number | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
}

function asBool(v: FormDataEntryValue | null): boolean {
    if (v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s === 'true' || s === 'on' || s === 'yes' || s === '1';
}

/**
 * Parse the `perks` form field. Accepts either a JSON array string or a
 * plain comma-separated value list. Empty strings are dropped.
 */
function parsePerks(raw: FormDataEntryValue | null): string[] {
    if (raw == null) return [];
    const s = String(raw).trim();
    if (!s) return [];
    // Try JSON first.
    if (s.startsWith('[')) {
        try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) {
                return parsed
                    .map((x) => (typeof x === 'string' ? x.trim() : ''))
                    .filter((x) => x.length > 0);
            }
        } catch {
            // fall through to comma split
        }
    }
    return s
        .split(',')
        .map((x) => x.trim())
        .filter((x) => x.length > 0);
}

const VALID_STATUSES: ReadonlySet<CrmCompensationBandStatus> = new Set<
    CrmCompensationBandStatus
>(['draft', 'active', 'inactive', 'archived']);

function jsonify<T>(doc: WithId<unknown> | null): T | null {
    if (!doc) return null;
    return JSON.parse(JSON.stringify(doc)) as T;
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function listCompensationBands(
    filters?: ListCompensationBandsParams,
): Promise<CrmCompensationBandDoc[]> {
    const session = await getSession();
    if (!session?.user) return [];

    const guard = await requirePermission('crm_compensation_bands', 'view');
    if (!guard.ok) return [];

    if (useRustCrm()) {
        try {
            const res = await crmCompensationBandsApi.list({
                q: filters?.q,
                status: filters?.status,
                level: filters?.level,
                limit: filters?.limit,
            });
            return JSON.parse(JSON.stringify(res.items ?? [])) as CrmCompensationBandDoc[];
        } catch (e) {
            console.error('[listCompensationBands] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'compensation_band',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);
        const q: Record<string, unknown> = { userId };
        if (filters?.status && filters.status !== 'all') {
            q.status = filters.status;
        }
        if (filters?.level && filters.level !== 'all') {
            q.level = filters.level;
        }
        if (filters?.q && filters.q.trim()) {
            const rx = new RegExp(
                filters.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
                'i',
            );
            q.$or = [
                { name: rx },
                { code: rx },
                { role_title: rx },
                { level: rx },
            ];
        }

        const docs = await db
            .collection(COLLECTION)
            .find(q)
            .sort({ name: 1, level: 1 })
            .limit(filters?.limit ?? 200)
            .toArray();
        return JSON.parse(JSON.stringify(docs));
    } catch (e) {
        console.error('[listCompensationBands] failed:', e);
        return [];
    }
}

export async function getCompensationBandById(
    id: string,
): Promise<CrmCompensationBandDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_compensation_bands', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmCompensationBandsApi.getById(id);
            return JSON.parse(JSON.stringify(doc)) as CrmCompensationBandDoc;
        } catch (e) {
            console.error('[getCompensationBandById] rust path failed; falling back:', e);
            recordRustFallback({
                entity: 'compensation_band',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection(COLLECTION).findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        return jsonify<CrmCompensationBandDoc>(doc);
    } catch (e) {
        console.error('[getCompensationBandById] failed:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveCompensationBand(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const bandId = asString(formData.get('bandId'));
    const isEditing = !!bandId;

    const guard = await requirePermission(
        'crm_compensation_bands',
        isEditing ? 'edit' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const name = asString(formData.get('name'));
    if (!name) return { error: 'Band name is required.' };

    const statusRaw = asString(formData.get('status'));
    const status: CrmCompensationBandStatus =
        statusRaw && VALID_STATUSES.has(statusRaw as CrmCompensationBandStatus)
            ? (statusRaw as CrmCompensationBandStatus)
            : 'draft';

    const minSalary = asNumber(formData.get('min_salary'));
    const maxSalary = asNumber(formData.get('max_salary'));
    const midSalary = asNumber(formData.get('mid_salary'));

    if (
        minSalary != null &&
        maxSalary != null &&
        Number(minSalary) > Number(maxSalary)
    ) {
        return { error: 'Min salary cannot exceed max salary.' };
    }

    const payload: Omit<CrmCompensationBandDoc, '_id'> & {
        userId: ObjectId;
        updatedAt: Date;
    } = {
        userId: new ObjectId(session.user._id),
        name,
        code: asString(formData.get('code')),
        level: asString(formData.get('level')),
        min_salary: minSalary,
        max_salary: maxSalary,
        mid_salary: midSalary,
        currency: asString(formData.get('currency')) ?? 'INR',
        department_id: asString(formData.get('department_id')),
        role_title: asString(formData.get('role_title')),
        perks: parsePerks(formData.get('perks')),
        is_active: asBool(formData.get('is_active')),
        status,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        let savedId: string;

        if (isEditing && ObjectId.isValid(bandId!)) {
            await db.collection(COLLECTION).updateOne(
                {
                    _id: new ObjectId(bandId!),
                    userId: payload.userId,
                },
                { $set: payload },
            );
            savedId = bandId!;
        } else {
            const result = await db.collection(COLLECTION).insertOne({
                ...payload,
                createdAt: new Date(),
            });
            savedId = result.insertedId.toString();
        }

        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: isEditing ? 'update' : 'create',
            entityKind: 'compensation_band',
            entityId: savedId,
            reason: payload.name,
        });

        revalidatePath(BASE_PATH);
        return {
            message: isEditing
                ? 'Compensation band updated.'
                : 'Compensation band created.',
            id: savedId,
        };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[saveCompensationBand] failed:', e);
        return { error: `Failed to save band: ${msg}` };
    }
}

export async function deleteCompensationBand(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id))
        return { success: false, error: 'Invalid band id.' };

    const guard = await requirePermission('crm_compensation_bands', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        await db.collection(COLLECTION).deleteOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id),
        });
        await writeAuditEntry({
            tenantUserId: session.user._id,
            action: 'delete',
            entityKind: 'compensation_band',
            entityId: id,
        });
        revalidatePath(BASE_PATH);
        return { success: true };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        return { success: false, error: msg };
    }
}
