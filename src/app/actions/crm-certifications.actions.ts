'use server';

/**
 * CRM HR Certifications server actions.
 *
 * **Dual implementation:** when `USE_RUST_CRM === 'true'` the read paths
 * delegate to `/v1/crm/certifications` on the Rust BFF; otherwise legacy
 * direct-Mongo runs. Failures record via `recordRustFallback` and fall
 * through to the legacy path.
 *
 * Fields (Mongo source-of-truth uses snake_case):
 *   name, issuer, employee_id, employee_name, certification_number,
 *   issue_date, expiry_date, certificate_url (SabFile),
 *   status (active/expired/revoked/archived)
 *
 * Soft-delete is performed by flipping `status` to `archived`.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId, type Document } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { requirePermission } from '@/lib/rbac-server';
import { writeAuditEntry } from '@/lib/audit-log';
import { recordRustFallback } from '@/lib/observability/rust-fallback-counter';
import { crmCertificationsApi } from '@/lib/rust-client/crm-certifications';
import { RustApiError } from '@/lib/rust-client/fetcher';

function useRustCrm(): boolean {
    return process.env.USE_RUST_CRM === 'true';
}

/* ─── Types ──────────────────────────────────────────────────────────── */

type CrmCertificationStatus =
    | 'active'
    | 'expired'
    | 'revoked'
    | 'archived';

interface CrmCertificationDoc {
    _id: string;
    userId?: string;
    name: string;
    issuer?: string;
    employeeId?: string;
    employeeName?: string;
    certificationNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    certificateUrl?: string;
    status: CrmCertificationStatus;
    createdAt?: string;
    updatedAt?: string;
}

interface CrmCertificationListParams {
    q?: string;
    status?: CrmCertificationStatus | 'all';
    employeeId?: string;
    limit?: number;
}

interface CrmCertificationListResponse {
    items: CrmCertificationDoc[];
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function asString(v: FormDataEntryValue | null): string | undefined {
    if (v == null) return undefined;
    const s = String(v).trim();
    return s.length > 0 ? s : undefined;
}

const VALID_STATUSES: ReadonlySet<CrmCertificationStatus> = new Set<CrmCertificationStatus>([
    'active',
    'expired',
    'revoked',
    'archived',
]);

function normaliseStatus(v: string | undefined): CrmCertificationStatus {
    if (v && VALID_STATUSES.has(v as CrmCertificationStatus)) {
        return v as CrmCertificationStatus;
    }
    return 'active';
}

function asDate(v: FormDataEntryValue | null): Date | null {
    const s = asString(v);
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

function dateToIso(value: unknown): string | undefined {
    if (!value) return undefined;
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
    }
    return String(value);
}

function toDoc(raw: WithId<Document>): CrmCertificationDoc {
    return {
        _id: String(raw._id),
        userId: raw.userId ? String(raw.userId) : undefined,
        name: String(raw.name ?? ''),
        issuer: raw.issuer ? String(raw.issuer) : undefined,
        employeeId: raw.employee_id
            ? String(raw.employee_id)
            : raw.employeeId
              ? String(raw.employeeId)
              : undefined,
        employeeName: raw.employee_name
            ? String(raw.employee_name)
            : raw.employeeName
              ? String(raw.employeeName)
              : undefined,
        certificationNumber: raw.certification_number
            ? String(raw.certification_number)
            : raw.certificationNumber
              ? String(raw.certificationNumber)
              : undefined,
        issueDate: dateToIso(raw.issue_date ?? raw.issueDate),
        expiryDate: dateToIso(raw.expiry_date ?? raw.expiryDate),
        certificateUrl: raw.certificate_url
            ? String(raw.certificate_url)
            : raw.certificateUrl
              ? String(raw.certificateUrl)
              : undefined,
        status: normaliseStatus(raw.status as string | undefined),
        createdAt: dateToIso(raw.createdAt),
        updatedAt: dateToIso(raw.updatedAt),
    };
}

/* ─── Reads ──────────────────────────────────────────────────────────── */

export async function getCertifications(
    filters?: CrmCertificationListParams,
): Promise<CrmCertificationListResponse> {
    const empty: CrmCertificationListResponse = { items: [] };

    const session = await getSession();
    if (!session?.user) return empty;

    const guard = await requirePermission('crm_certification', 'view');
    if (!guard.ok) return empty;

    if (useRustCrm()) {
        try {
            const res = await crmCertificationsApi.list({
                q: filters?.q,
                status: filters?.status,
                employeeId: filters?.employeeId,
                limit: filters?.limit,
            });
            const items = (res.items ?? []).map((row) =>
                toDoc(row as unknown as WithId<Document>),
            );
            return { items };
        } catch (e) {
            console.error(
                '[getCertifications] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'certification',
                op: 'list',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const filter: Record<string, unknown> = {
            userId: new ObjectId(session.user._id as string),
        };

        if (filters?.status && filters.status !== 'all') {
            filter.status = filters.status;
        }
        if (filters?.employeeId) {
            filter.$or = [
                { employee_id: filters.employeeId },
                { employeeId: filters.employeeId },
            ];
        }
        if (filters?.q) {
            filter.name = { $regex: filters.q, $options: 'i' };
        }

        const limit = Math.min(filters?.limit ?? 100, 500);
        const rows = await db
            .collection('crm_certifications')
            .find(filter)
            .sort({ updatedAt: -1, _id: -1 })
            .limit(limit)
            .toArray();

        return { items: rows.map(toDoc) };
    } catch (e) {
        console.error('[getCertifications] failed:', e);
        return empty;
    }
}

export async function getCertificationById(
    id: string,
): Promise<CrmCertificationDoc | null> {
    const session = await getSession();
    if (!session?.user) return null;
    if (!id || !ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_certification', 'view');
    if (!guard.ok) return null;

    if (useRustCrm()) {
        try {
            const doc = await crmCertificationsApi.getById(id);
            return toDoc(doc as unknown as WithId<Document>);
        } catch (e) {
            console.error(
                '[getCertificationById] rust path failed; falling back:',
                e,
            );
            recordRustFallback({
                entity: 'certification',
                op: 'get',
                errorCode: e instanceof RustApiError ? e.code : undefined,
                status: e instanceof RustApiError ? e.status : undefined,
            });
        }
    }

    try {
        const { db } = await connectToDatabase();
        const row = await db.collection('crm_certifications').findOne({
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        });
        return row ? toDoc(row) : null;
    } catch (e) {
        console.error('[getCertificationById] failed:', e);
        return null;
    }
}

/* ─── Writes ─────────────────────────────────────────────────────────── */

export async function saveCertification(
    _prev: { message?: string; error?: string; id?: string } | undefined,
    formData: FormData,
): Promise<{ message?: string; error?: string; id?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const certificationId = asString(formData.get('certificationId'));
    const isEditing = !!certificationId;

    const guard = await requirePermission(
        'crm_certification',
        isEditing ? 'update' : 'create',
    );
    if (!guard.ok) return { error: guard.error };

    const name = asString(formData.get('name'));
    if (!name) return { error: 'Certification name is required.' };

    const status = normaliseStatus(asString(formData.get('status')));

    const payload = {
        name,
        issuer: asString(formData.get('issuer')) ?? null,
        employee_id: asString(formData.get('employeeId')) ?? null,
        employee_name: asString(formData.get('employeeName')) ?? null,
        certification_number:
            asString(formData.get('certificationNumber')) ?? null,
        issue_date: asDate(formData.get('issueDate')),
        expiry_date: asDate(formData.get('expiryDate')),
        certificate_url: asString(formData.get('certificateUrl')) ?? null,
        status,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id as string);

        if (isEditing) {
            if (!ObjectId.isValid(certificationId!)) {
                return { error: 'Invalid certification id.' };
            }
            const filter = { _id: new ObjectId(certificationId), userId };
            const before = await db.collection('crm_certifications').findOne(filter);
            if (!before) return { error: 'Certification not found.' };

            await db
                .collection('crm_certifications')
                .updateOne(filter, { $set: payload });

            await writeAuditEntry({
                tenantUserId: String(session.user._id),
                actorId: String(session.user._id),
                action: 'update',
                entityKind: 'certification',
                entityId: certificationId!,
            });

            revalidatePath('/dashboard/hrm/hr/certifications');
            revalidatePath(
                `/dashboard/hrm/hr/certifications/${certificationId}`,
            );
            return { message: 'Certification updated.', id: certificationId };
        }

        const insertDoc = {
            ...payload,
            userId,
            createdAt: new Date(),
        };
        const result = await db
            .collection('crm_certifications')
            .insertOne(insertDoc);

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'create',
            entityKind: 'certification',
            entityId: result.insertedId.toString(),
        });

        revalidatePath('/dashboard/hrm/hr/certifications');
        return {
            message: 'Certification created.',
            id: result.insertedId.toString(),
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[saveCertification] failed:', msg);
        return { error: `Failed to save certification: ${msg}` };
    }
}

export async function deleteCertification(
    id: string,
): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    if (!id || !ObjectId.isValid(id)) {
        return { success: false, error: 'Invalid certification id.' };
    }

    const guard = await requirePermission('crm_certification', 'delete');
    if (!guard.ok) return { success: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const filter = {
            _id: new ObjectId(id),
            userId: new ObjectId(session.user._id as string),
        };

        const result = await db
            .collection('crm_certifications')
            .updateOne(filter, {
                $set: {
                    status: 'archived' as CrmCertificationStatus,
                    updatedAt: new Date(),
                },
            });

        if (result.matchedCount === 0) {
            return { success: false, error: 'Certification not found.' };
        }

        await writeAuditEntry({
            tenantUserId: String(session.user._id),
            actorId: String(session.user._id),
            action: 'archive',
            entityKind: 'certification',
            entityId: id,
        });

        revalidatePath('/dashboard/hrm/hr/certifications');
        return { success: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Unknown error';
        console.error('[deleteCertification] failed:', msg);
        return {
            success: false,
            error: `Failed to delete certification: ${msg}`,
        };
    }
}
