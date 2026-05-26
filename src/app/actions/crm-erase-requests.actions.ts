'use server';

/**
 * CRM GDPR erase-request workflow — server actions.
 *
 * Implements §6.9 of CRM_REBUILD_PLAN.md. The collection
 * `crm_erase_requests` carries the lifecycle of a single subject-erasure
 * request through `pending → approved → executing → executed` (or the
 * `rejected` / `failed` terminal states).
 *
 * Every state transition writes to the chained-hash audit ledger via
 * `audit()` in `src/lib/compliance/audit-log.ts`. The hash chain is
 * what proves the workflow is tamper-evident — pulling the chain back
 * out with `queryAuditLog()` and walking it through `verifyChain()` is
 * how operations checks integrity.
 *
 * SAFETY: `executeEraseRequest` only mutates data when
 * `process.env.GDPR_EXECUTION_ENABLED === 'true'`. Without that env the
 * action walks the deletion code path, computes what *would* happen,
 * writes the executionLog and marks the request `executed`, but skips
 * the actual collection mutations. Production rollout flips the env
 * once the dry-run shape has been signed off — see
 * `docs/ops/gdpr-erasure.md`.
 *
 * RBAC: gated on the `crm_gdpr` module key. The key is *not* yet
 * registered in `src/lib/permission-modules.ts` — see the deliverable
 * note for batch registration. Until it is registered the guard will
 * fail closed for non-owners (which is the correct conservative
 * default for an irreversible operation).
 */

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { requirePermission } from '@/lib/rbac-server';
import { audit } from '@/lib/compliance/audit-log';

/* ── Types ────────────────────────────────────────────────────────── */

export type EraseSubjectKind = 'contact' | 'lead' | 'employee';
export type EraseScope = 'soft_redact' | 'hard_delete';
export type EraseStatus =
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'executing'
    | 'executed'
    | 'failed';

export interface EraseDryRunRow {
    collection: string;
    count: number;
    sampleIds: string[];
}

export interface EraseDryRunReport {
    collectionsScanned: number;
    rowsAffected: EraseDryRunRow[];
    /** Pre-computed total for the UI summary. */
    totalRows: number;
    /** ISO timestamp the dry-run was generated. */
    generatedAt: string;
}

export interface CrmEraseRequest {
    _id?: ObjectId;
    tenantUserId: ObjectId;
    subjectKind: EraseSubjectKind;
    subjectId: string;
    subjectName: string;
    subjectEmail?: string;
    requestedBy: ObjectId;
    requestedByName?: string;
    requestedAt: Date;
    status: EraseStatus;
    reason?: string;
    scope: EraseScope;
    legalHold: boolean;
    approverId?: ObjectId;
    approverName?: string;
    approvedAt?: Date;
    rejectedAt?: Date;
    rejectionReason?: string;
    executedAt?: Date;
    dryRunReport?: EraseDryRunReport;
    executionLog?: string[];
    /** Whether the actual deletion path ran or was env-gated. */
    executionMode?: 'env_gated_logged_only' | 'mutated';
}

/** Wire-friendly variant for the client. ObjectIds → hex strings, Dates → ISO. */
export interface CrmEraseRequestDTO {
    _id: string;
    subjectKind: EraseSubjectKind;
    subjectId: string;
    subjectName: string;
    subjectEmail?: string;
    requestedBy: string;
    requestedByName?: string;
    requestedAt: string;
    status: EraseStatus;
    reason?: string;
    scope: EraseScope;
    legalHold: boolean;
    approverId?: string;
    approverName?: string;
    approvedAt?: string;
    rejectedAt?: string;
    rejectionReason?: string;
    executedAt?: string;
    dryRunReport?: EraseDryRunReport;
    executionLog?: string[];
    executionMode?: 'env_gated_logged_only' | 'mutated';
}

export interface EraseRequestFilters {
    status?: EraseStatus | 'all';
    subjectKind?: EraseSubjectKind | 'all';
    /** Soft text search on subjectName / subjectEmail / reason. */
    search?: string;
    limit?: number;
}

const COLLECTION = 'crm_erase_requests';

/* ── Cascade map ──────────────────────────────────────────────────── */

/**
 * Which collections + foreign-key fields point at each subject kind.
 * This is the *cascade set* — every entry is touched by dry-run, and
 * every entry is the deletion / redaction target for hard_delete /
 * soft_redact respectively.
 *
 * The shape is intentionally small + explicit so a reviewer can audit
 * exactly what an erase request reaches.
 */
export interface CascadeRef {
    collection: string;
    field: string;
    /** If true, the entire row is owned by the subject — eligible for hard_delete. */
    ownedBySubject: boolean;
}

const CASCADE_MAP: Record<EraseSubjectKind, CascadeRef[]> = {
    contact: [
        { collection: 'crm_contacts', field: '_id', ownedBySubject: true },
        { collection: 'crm_tasks', field: 'contactId', ownedBySubject: false },
        { collection: 'crm_notes', field: 'contactId', ownedBySubject: false },
        { collection: 'crm_activity', field: 'contactId', ownedBySubject: false },
        { collection: 'crm_attachments', field: 'contactId', ownedBySubject: false },
        { collection: 'crm_deals', field: 'contactId', ownedBySubject: false },
        { collection: 'crm_tickets', field: 'contactId', ownedBySubject: false },
        { collection: 'crm_invoices', field: 'contactId', ownedBySubject: false },
        { collection: 'crm_emails', field: 'contactId', ownedBySubject: false },
        { collection: 'crm_calls', field: 'contactId', ownedBySubject: false },
    ],
    lead: [
        { collection: 'crm_leads', field: '_id', ownedBySubject: true },
        { collection: 'crm_tasks', field: 'leadId', ownedBySubject: false },
        { collection: 'crm_notes', field: 'leadId', ownedBySubject: false },
        { collection: 'crm_activity', field: 'leadId', ownedBySubject: false },
        { collection: 'crm_attachments', field: 'leadId', ownedBySubject: false },
        { collection: 'crm_emails', field: 'leadId', ownedBySubject: false },
        { collection: 'crm_calls', field: 'leadId', ownedBySubject: false },
        { collection: 'crm_interviews', field: 'leadId', ownedBySubject: false },
    ],
    employee: [
        { collection: 'crm_employees', field: '_id', ownedBySubject: true },
        { collection: 'crm_tasks', field: 'employeeId', ownedBySubject: false },
        { collection: 'crm_notes', field: 'employeeId', ownedBySubject: false },
        { collection: 'crm_attachments', field: 'employeeId', ownedBySubject: false },
        { collection: 'crm_attendance', field: 'employeeId', ownedBySubject: false },
        { collection: 'crm_shifts', field: 'employeeId', ownedBySubject: false },
        { collection: 'crm_payroll', field: 'employeeId', ownedBySubject: false },
        { collection: 'crm_documents', field: 'employeeId', ownedBySubject: false },
        { collection: 'crm_appraisals', field: 'employeeId', ownedBySubject: false },
        { collection: 'crm_leaves', field: 'employeeId', ownedBySubject: false },
    ],
};

/** PII fields that get sentinel-redacted in soft_redact mode. */
const PII_FIELDS = [
    'name',
    'firstName',
    'lastName',
    'fullName',
    'email',
    'phone',
    'mobile',
    'whatsapp',
    'address',
    'street',
    'city',
    'postalCode',
    'dateOfBirth',
    'nationalId',
    'taxId',
    'note',
    'description',
];

/* ── Helpers ──────────────────────────────────────────────────────── */

function isExecutionEnabled(): boolean {
    return process.env.GDPR_EXECUTION_ENABLED === 'true';
}

function toDTO(row: WithId<CrmEraseRequest>): CrmEraseRequestDTO {
    return {
        _id: row._id.toHexString(),
        subjectKind: row.subjectKind,
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        subjectEmail: row.subjectEmail,
        requestedBy: row.requestedBy.toHexString(),
        requestedByName: row.requestedByName,
        requestedAt: row.requestedAt.toISOString(),
        status: row.status,
        reason: row.reason,
        scope: row.scope,
        legalHold: row.legalHold,
        approverId: row.approverId?.toHexString(),
        approverName: row.approverName,
        approvedAt: row.approvedAt?.toISOString(),
        rejectedAt: row.rejectedAt?.toISOString(),
        rejectionReason: row.rejectionReason,
        executedAt: row.executedAt?.toISOString(),
        dryRunReport: row.dryRunReport,
        executionLog: row.executionLog,
        executionMode: row.executionMode,
    };
}

async function fetchLegalHoldFlag(
    tenantId: string,
    subjectKind: EraseSubjectKind,
    subjectId: string,
): Promise<boolean> {
    try {
        const { db } = await connectToDatabase();
        const hold = await db.collection('legal_holds').findOne({
            tenantId,
            releasedAt: { $exists: false },
            $or: [
                { 'scope.subjectKind': subjectKind, 'scope.subjectId': subjectId },
                { 'scope.subjectId': subjectId },
                { 'scope.subjectId': '*' },
            ],
        });
        return Boolean(hold);
    } catch {
        return false;
    }
}

/* ── Reads ────────────────────────────────────────────────────────── */

export async function getEraseRequests(
    filters: EraseRequestFilters = {},
): Promise<CrmEraseRequestDTO[]> {
    const session = await getSession();
    if (!session?.user?._id) return [];

    const guard = await requirePermission('crm_gdpr', 'view');
    if (!guard.ok) return [];

    try {
        const { db } = await connectToDatabase();
        const tenantOid = new ObjectId(session.user._id as string);

        const q: Record<string, unknown> = { tenantUserId: tenantOid };
        if (filters.status && filters.status !== 'all') q.status = filters.status;
        if (filters.subjectKind && filters.subjectKind !== 'all') {
            q.subjectKind = filters.subjectKind;
        }
        if (filters.search) {
            const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const rx = { $regex: escaped, $options: 'i' };
            q.$or = [{ subjectName: rx }, { subjectEmail: rx }, { reason: rx }];
        }

        const limit = Math.min(Math.max(filters.limit ?? 200, 1), 1000);
        const docs = (await db
            .collection<CrmEraseRequest>(COLLECTION)
            .find(q)
            .sort({ requestedAt: -1 })
            .limit(limit)
            .toArray()) as WithId<CrmEraseRequest>[];

        return docs.map(toDTO);
    } catch (e) {
        console.error('[getEraseRequests] query failed:', e);
        return [];
    }
}

export async function getEraseRequestById(
    id: string,
): Promise<CrmEraseRequestDTO | null> {
    const session = await getSession();
    if (!session?.user?._id) return null;
    if (!ObjectId.isValid(id)) return null;

    const guard = await requirePermission('crm_gdpr', 'view');
    if (!guard.ok) return null;

    try {
        const { db } = await connectToDatabase();
        const doc = await db
            .collection<CrmEraseRequest>(COLLECTION)
            .findOne({
                _id: new ObjectId(id),
                tenantUserId: new ObjectId(session.user._id as string),
            });
        if (!doc) return null;
        return toDTO(doc as WithId<CrmEraseRequest>);
    } catch (e) {
        console.error('[getEraseRequestById] query failed:', e);
        return null;
    }
}

/* ── State transitions ────────────────────────────────────────────── */

export interface FileEraseRequestInput {
    subjectKind: EraseSubjectKind;
    subjectId: string;
    subjectName?: string;
    subjectEmail?: string;
    scope: EraseScope;
    reason?: string;
}

export async function fileEraseRequest(
    input: FileEraseRequestInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { ok: false, error: 'Access denied.' };

    const guard = await requirePermission('crm_gdpr', 'create');
    if (!guard.ok) return { ok: false, error: guard.error };

    if (!input.subjectKind || !input.subjectId) {
        return { ok: false, error: 'subjectKind and subjectId are required.' };
    }
    if (input.scope !== 'soft_redact' && input.scope !== 'hard_delete') {
        return { ok: false, error: 'scope must be soft_redact or hard_delete.' };
    }

    try {
        const { db } = await connectToDatabase();
        const tenantUserId = new ObjectId(session.user._id as string);
        const tenantId = tenantUserId.toHexString();

        // Hydrate subject name from the source collection so the list page
        // never has to join.
        let subjectName = input.subjectName ?? '';
        let subjectEmail = input.subjectEmail;
        if (!subjectName || !subjectEmail) {
            const owner = CASCADE_MAP[input.subjectKind][0];
            try {
                if (ObjectId.isValid(input.subjectId)) {
                    const subj = await db
                        .collection(owner.collection)
                        .findOne({ _id: new ObjectId(input.subjectId) });
                    if (subj) {
                        if (!subjectName) {
                            subjectName =
                                (subj.fullName as string) ||
                                (subj.name as string) ||
                                [subj.firstName, subj.lastName]
                                    .filter(Boolean)
                                    .join(' ') ||
                                input.subjectId;
                        }
                        if (!subjectEmail && typeof subj.email === 'string') {
                            subjectEmail = subj.email;
                        }
                    }
                }
            } catch {
                /* tolerate missing source row */
            }
            if (!subjectName) subjectName = input.subjectId;
        }

        const legalHold = await fetchLegalHoldFlag(
            tenantId,
            input.subjectKind,
            input.subjectId,
        );

        const now = new Date();
        const row: CrmEraseRequest = {
            tenantUserId,
            subjectKind: input.subjectKind,
            subjectId: input.subjectId,
            subjectName,
            subjectEmail,
            requestedBy: tenantUserId,
            requestedByName: (session.user as { name?: string }).name,
            requestedAt: now,
            status: 'pending',
            reason: input.reason,
            scope: input.scope,
            legalHold,
        };

        const ins = await db.collection<CrmEraseRequest>(COLLECTION).insertOne(row);
        const id = ins.insertedId.toHexString();

        await audit({
            tenantId,
            actor: tenantId,
            action: 'gdpr_erase_request.file',
            resource: `crm_erase_requests/${id}`,
            after: {
                subjectKind: input.subjectKind,
                subjectId: input.subjectId,
                scope: input.scope,
                legalHold,
                reason: input.reason ?? null,
            },
        });

        revalidatePath('/dashboard/crm/settings/gdpr/removal-requests');
        return { ok: true, id };
    } catch (e) {
        console.error('[fileEraseRequest] failed:', e);
        return { ok: false, error: 'Failed to file erase request.' };
    }
}

export async function approveEraseRequest(
    id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { ok: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid id.' };

    const guard = await requirePermission('crm_gdpr', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const tenantUserId = new ObjectId(session.user._id as string);
        const tenantId = tenantUserId.toHexString();

        const existing = await db
            .collection<CrmEraseRequest>(COLLECTION)
            .findOne({ _id: new ObjectId(id), tenantUserId });
        if (!existing) return { ok: false, error: 'Erase request not found.' };
        if (existing.status !== 'pending') {
            return {
                ok: false,
                error: `Cannot approve a request in '${existing.status}' state.`,
            };
        }
        if (existing.legalHold) {
            return {
                ok: false,
                error: 'Subject is under legal hold — approval blocked.',
            };
        }

        const now = new Date();
        await db.collection<CrmEraseRequest>(COLLECTION).updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    status: 'approved',
                    approverId: tenantUserId,
                    approverName: (session.user as { name?: string }).name,
                    approvedAt: now,
                },
            },
        );

        await audit({
            tenantId,
            actor: tenantId,
            action: 'gdpr_erase_request.approve',
            resource: `crm_erase_requests/${id}`,
            before: { status: existing.status },
            after: { status: 'approved' },
        });

        revalidatePath('/dashboard/crm/settings/gdpr/removal-requests');
        revalidatePath(`/dashboard/crm/settings/gdpr/removal-requests/${id}`);
        return { ok: true };
    } catch (e) {
        console.error('[approveEraseRequest] failed:', e);
        return { ok: false, error: 'Failed to approve erase request.' };
    }
}

export async function rejectEraseRequest(
    id: string,
    reason: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { ok: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid id.' };
    if (!reason || !reason.trim()) {
        return { ok: false, error: 'Rejection reason is required.' };
    }

    const guard = await requirePermission('crm_gdpr', 'edit');
    if (!guard.ok) return { ok: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const tenantUserId = new ObjectId(session.user._id as string);
        const tenantId = tenantUserId.toHexString();

        const existing = await db
            .collection<CrmEraseRequest>(COLLECTION)
            .findOne({ _id: new ObjectId(id), tenantUserId });
        if (!existing) return { ok: false, error: 'Erase request not found.' };
        if (existing.status !== 'pending' && existing.status !== 'approved') {
            return {
                ok: false,
                error: `Cannot reject a request in '${existing.status}' state.`,
            };
        }

        const now = new Date();
        await db.collection<CrmEraseRequest>(COLLECTION).updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    status: 'rejected',
                    rejectedAt: now,
                    rejectionReason: reason.trim(),
                    approverId: tenantUserId,
                    approverName: (session.user as { name?: string }).name,
                },
            },
        );

        await audit({
            tenantId,
            actor: tenantId,
            action: 'gdpr_erase_request.reject',
            resource: `crm_erase_requests/${id}`,
            before: { status: existing.status },
            after: { status: 'rejected', rejectionReason: reason.trim() },
        });

        revalidatePath('/dashboard/crm/settings/gdpr/removal-requests');
        revalidatePath(`/dashboard/crm/settings/gdpr/removal-requests/${id}`);
        return { ok: true };
    } catch (e) {
        console.error('[rejectEraseRequest] failed:', e);
        return { ok: false, error: 'Failed to reject erase request.' };
    }
}

/* ── Dry run ──────────────────────────────────────────────────────── */

export async function dryRunEraseRequest(
    id: string,
): Promise<{ ok: true; report: EraseDryRunReport } | { ok: false; error: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { ok: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid id.' };

    const guard = await requirePermission('crm_gdpr', 'view');
    if (!guard.ok) return { ok: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const tenantUserId = new ObjectId(session.user._id as string);
        const tenantId = tenantUserId.toHexString();

        const existing = await db
            .collection<CrmEraseRequest>(COLLECTION)
            .findOne({ _id: new ObjectId(id), tenantUserId });
        if (!existing) return { ok: false, error: 'Erase request not found.' };

        const refs = CASCADE_MAP[existing.subjectKind];
        const rowsAffected: EraseDryRunRow[] = [];
        const subjectIdAsOid = ObjectId.isValid(existing.subjectId)
            ? new ObjectId(existing.subjectId)
            : null;

        for (const ref of refs) {
            const matchValues: unknown[] = [existing.subjectId];
            if (subjectIdAsOid) matchValues.push(subjectIdAsOid);

            const filter: Record<string, unknown> = {
                userId: tenantUserId,
                [ref.field]: { $in: matchValues },
            };

            // The owner row is matched by _id, which is always an ObjectId.
            if (ref.field === '_id' && subjectIdAsOid) {
                filter[ref.field] = subjectIdAsOid;
            } else if (ref.field === '_id' && !subjectIdAsOid) {
                // Bad id — skip this collection cleanly.
                continue;
            }

            try {
                const coll = db.collection(ref.collection);
                const count = await coll.countDocuments(filter);
                if (count === 0) {
                    rowsAffected.push({
                        collection: ref.collection,
                        count: 0,
                        sampleIds: [],
                    });
                    continue;
                }
                const sample = await coll
                    .find(filter, { projection: { _id: 1 } })
                    .limit(5)
                    .toArray();
                rowsAffected.push({
                    collection: ref.collection,
                    count,
                    sampleIds: sample
                        .map((d) =>
                            d._id && typeof (d._id as ObjectId).toHexString === 'function'
                                ? (d._id as ObjectId).toHexString()
                                : String(d._id),
                        )
                        .filter(Boolean),
                });
            } catch (e) {
                // Missing collection is OK; nothing to redact / delete.
                console.warn(
                    `[dryRunEraseRequest] skipped ${ref.collection}:`,
                    (e as Error).message,
                );
                rowsAffected.push({
                    collection: ref.collection,
                    count: 0,
                    sampleIds: [],
                });
            }
        }

        const totalRows = rowsAffected.reduce((a, r) => a + r.count, 0);
        const report: EraseDryRunReport = {
            collectionsScanned: refs.length,
            rowsAffected,
            totalRows,
            generatedAt: new Date().toISOString(),
        };

        await db.collection<CrmEraseRequest>(COLLECTION).updateOne(
            { _id: new ObjectId(id) },
            { $set: { dryRunReport: report } },
        );

        await audit({
            tenantId,
            actor: tenantId,
            action: 'gdpr_erase_request.dry_run',
            resource: `crm_erase_requests/${id}`,
            after: { totalRows, collectionsScanned: refs.length },
        });

        revalidatePath(`/dashboard/crm/settings/gdpr/removal-requests/${id}`);
        return { ok: true, report };
    } catch (e) {
        console.error('[dryRunEraseRequest] failed:', e);
        return { ok: false, error: 'Failed to compute dry run.' };
    }
}

/* ── Execution ─────────────────────────────────────────────────────── */

export interface ExecuteEraseOptions {
    confirm: true;
}

export async function executeEraseRequest(
    id: string,
    options: ExecuteEraseOptions,
): Promise<{ ok: true; mode: 'env_gated_logged_only' | 'mutated' } | { ok: false; error: string }> {
    const session = await getSession();
    if (!session?.user?._id) return { ok: false, error: 'Access denied.' };
    if (!ObjectId.isValid(id)) return { ok: false, error: 'Invalid id.' };
    if (options?.confirm !== true) {
        return { ok: false, error: 'Confirmation flag missing.' };
    }

    const guard = await requirePermission('crm_gdpr', 'delete');
    if (!guard.ok) return { ok: false, error: guard.error };

    try {
        const { db } = await connectToDatabase();
        const tenantUserId = new ObjectId(session.user._id as string);
        const tenantId = tenantUserId.toHexString();

        const existing = await db
            .collection<CrmEraseRequest>(COLLECTION)
            .findOne({ _id: new ObjectId(id), tenantUserId });
        if (!existing) return { ok: false, error: 'Erase request not found.' };

        if (existing.status !== 'approved') {
            return {
                ok: false,
                error: `Only approved requests are executable (current: ${existing.status}).`,
            };
        }

        // Re-check legal hold at execution time. A hold may have been
        // applied between approve and execute.
        const stillHeld = await fetchLegalHoldFlag(
            tenantId,
            existing.subjectKind,
            existing.subjectId,
        );
        if (existing.legalHold || stillHeld) {
            const note = 'Legal hold active — execution refused.';
            await db.collection<CrmEraseRequest>(COLLECTION).updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status: 'failed',
                        executionLog: [
                            `[${new Date().toISOString()}] ${note}`,
                        ],
                    },
                },
            );
            await audit({
                tenantId,
                actor: tenantId,
                action: 'gdpr_erase_request.execute.refused_legal_hold',
                resource: `crm_erase_requests/${id}`,
                after: { status: 'failed', reason: note },
            });
            revalidatePath(`/dashboard/crm/settings/gdpr/removal-requests/${id}`);
            return { ok: false, error: note };
        }

        if (!existing.dryRunReport) {
            return {
                ok: false,
                error: 'Dry-run is required before execution.',
            };
        }

        // Mark as executing while we work.
        await db
            .collection<CrmEraseRequest>(COLLECTION)
            .updateOne({ _id: new ObjectId(id) }, { $set: { status: 'executing' } });

        const refs = CASCADE_MAP[existing.subjectKind];
        const subjectIdAsOid = ObjectId.isValid(existing.subjectId)
            ? new ObjectId(existing.subjectId)
            : null;
        const sentinel = `[redacted-gdpr-${id}]`;
        const log: string[] = [];
        const mutating = isExecutionEnabled();
        const mode: 'env_gated_logged_only' | 'mutated' = mutating
            ? 'mutated'
            : 'env_gated_logged_only';

        log.push(
            `[${new Date().toISOString()}] execute begin: scope=${existing.scope} mode=${mode}`,
        );

        for (const ref of refs) {
            const matchValues: unknown[] = [existing.subjectId];
            if (subjectIdAsOid) matchValues.push(subjectIdAsOid);
            const filter: Record<string, unknown> = {
                userId: tenantUserId,
                [ref.field]: { $in: matchValues },
            };
            if (ref.field === '_id' && subjectIdAsOid) {
                filter[ref.field] = subjectIdAsOid;
            } else if (ref.field === '_id' && !subjectIdAsOid) {
                log.push(`  skip ${ref.collection}: subject id not an ObjectId`);
                continue;
            }

            try {
                const coll = db.collection(ref.collection);
                const count = await coll.countDocuments(filter);
                if (count === 0) {
                    log.push(`  ${ref.collection}: 0 rows — nothing to do`);
                    continue;
                }

                if (existing.scope === 'hard_delete' && ref.ownedBySubject) {
                    log.push(`  ${ref.collection}: hard_delete ${count} row(s)`);
                    if (mutating) {
                        const res = await coll.deleteMany(filter);
                        log.push(`    → deleted ${res.deletedCount ?? 0}`);
                    } else {
                        log.push('    → env-gated: skipped mutation');
                    }
                } else if (existing.scope === 'hard_delete') {
                    // Non-owned rows still get deleted on hard_delete — the
                    // cascade target rules in CASCADE_MAP define ownership.
                    log.push(
                        `  ${ref.collection}: hard_delete cascade ${count} row(s)`,
                    );
                    if (mutating) {
                        const res = await coll.deleteMany(filter);
                        log.push(`    → deleted ${res.deletedCount ?? 0}`);
                    } else {
                        log.push('    → env-gated: skipped mutation');
                    }
                } else {
                    // soft_redact: replace PII fields with sentinel.
                    const setOp: Record<string, string> = {};
                    for (const f of PII_FIELDS) setOp[f] = sentinel;
                    setOp.gdprRedactedAt = new Date().toISOString();
                    setOp.gdprRequestId = id;
                    log.push(
                        `  ${ref.collection}: soft_redact ${count} row(s) (${PII_FIELDS.length} fields)`,
                    );
                    if (mutating) {
                        const res = await coll.updateMany(filter, { $set: setOp });
                        log.push(`    → modified ${res.modifiedCount ?? 0}`);
                    } else {
                        log.push('    → env-gated: skipped mutation');
                    }
                }
            } catch (e) {
                log.push(`  ${ref.collection}: error — ${(e as Error).message}`);
            }
        }

        const finishedAt = new Date();
        log.push(`[${finishedAt.toISOString()}] execute end`);

        await db.collection<CrmEraseRequest>(COLLECTION).updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    status: 'executed',
                    executedAt: finishedAt,
                    executionLog: log,
                    executionMode: mode,
                },
            },
        );

        await audit({
            tenantId,
            actor: tenantId,
            action: 'gdpr_erase_request.execute',
            resource: `crm_erase_requests/${id}`,
            before: { status: 'approved' },
            after: {
                status: 'executed',
                scope: existing.scope,
                mode,
                totalRows: existing.dryRunReport.totalRows,
            },
            metadata: { collectionsTouched: refs.length },
        });

        revalidatePath('/dashboard/crm/settings/gdpr/removal-requests');
        revalidatePath(`/dashboard/crm/settings/gdpr/removal-requests/${id}`);
        return { ok: true, mode };
    } catch (e) {
        console.error('[executeEraseRequest] failed:', e);
        try {
            const { db } = await connectToDatabase();
            await db.collection<CrmEraseRequest>(COLLECTION).updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        status: 'failed',
                        executionLog: [
                            `[${new Date().toISOString()}] fatal: ${(e as Error).message}`,
                        ],
                    },
                },
            );
        } catch {
            /* best effort */
        }
        return { ok: false, error: 'Failed to execute erase request.' };
    }
}

