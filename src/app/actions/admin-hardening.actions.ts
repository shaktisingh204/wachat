'use server';

/**
 * Admin "hardening" actions — Phase 0 follow-up controls layered on top of the
 * existing admin pages. All actions go through Mongo directly via
 * `connectToDatabase()` (the marketplace + sabsms admin pages follow the same
 * pattern). Every mutation is gated by `getAdminSession()`.
 *
 * Naming: each export is `<verb><Subject>` and returns `{ success, error? }`
 * so the matching client component can render a toast on either branch.
 */

import 'server-only';
import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getAdminSession } from '@/lib/admin-session';
import { getErrorMessage } from '@/lib/utils';

type Result = { success: boolean; error?: string };

async function requireAdmin(): Promise<Result | null> {
    const s = await getAdminSession();
    if (!s.isAdmin) return { success: false, error: 'Permission denied.' };
    return null;
}

function objectIdOrError(id: string): { id: ObjectId } | Result {
    try {
        return { id: new ObjectId(id) };
    } catch {
        return { success: false, error: 'Invalid id.' };
    }
}

/* ============================================================ */
/*  USERS — suspend / activate / force-logout / reset 2FA       */
/* ============================================================ */

export async function setUserSuspended(
    userId: string,
    suspended: boolean,
): Promise<Result> {
    const auth = await requireAdmin();
    if (auth) return auth;
    const oid = objectIdOrError(userId);
    if ('success' in oid) return oid;

    try {
        const { db } = await connectToDatabase();
        const res = await db.collection('users').updateOne(
            { _id: oid.id },
            {
                $set: {
                    isSuspended: suspended,
                    suspendedAt: suspended ? new Date() : null,
                },
            },
        );
        if (res.matchedCount === 0) {
            return { success: false, error: 'User not found.' };
        }
        revalidatePath('/admin/dashboard/users');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function forceUserLogout(userId: string): Promise<Result> {
    const auth = await requireAdmin();
    if (auth) return auth;
    const oid = objectIdOrError(userId);
    if ('success' in oid) return oid;

    try {
        const { db } = await connectToDatabase();
        // Bump the user's `sessionEpoch` so any JWT issued before this
        // moment is rejected by the verifier. Verifiers that check the
        // epoch will deny all in-flight sessions for this user.
        const epoch = Date.now();
        const res = await db.collection('users').updateOne(
            { _id: oid.id },
            { $set: { sessionEpoch: epoch, lastForcedLogoutAt: new Date() } },
        );
        if (res.matchedCount === 0) {
            return { success: false, error: 'User not found.' };
        }
        revalidatePath('/admin/dashboard/users');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function resetUserTwoFactor(userId: string): Promise<Result> {
    const auth = await requireAdmin();
    if (auth) return auth;
    const oid = objectIdOrError(userId);
    if ('success' in oid) return oid;

    try {
        const { db } = await connectToDatabase();
        const res = await db.collection('users').updateOne(
            { _id: oid.id },
            {
                $unset: {
                    twoFactorSecret: '',
                    twoFactorBackupCodes: '',
                },
                $set: {
                    'preferences.twoFactorEnabled': false,
                    twoFactorResetAt: new Date(),
                },
            },
        );
        if (res.matchedCount === 0) {
            return { success: false, error: 'User not found.' };
        }
        revalidatePath('/admin/dashboard/users');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ============================================================ */
/*  PLANS — create / duplicate                                  */
/* ============================================================ */

export async function createPlan(formData: FormData): Promise<Result & { planId?: string }> {
    const auth = await requireAdmin();
    if (auth) return auth;

    const name = (formData.get('name') as string | null)?.trim();
    const priceRaw = formData.get('price') as string | null;
    const currency = ((formData.get('currency') as string | null)?.trim() || 'INR').toUpperCase();
    const signupCreditsRaw = formData.get('signupCredits') as string | null;
    const projectLimitRaw = formData.get('projectLimit') as string | null;
    const agentLimitRaw = formData.get('agentLimit') as string | null;
    const isPublic = formData.get('isPublic') === 'on';

    if (!name) return { success: false, error: 'Plan name is required.' };
    const price = Number(priceRaw ?? '0');
    if (!Number.isFinite(price) || price < 0) {
        return { success: false, error: 'Invalid price.' };
    }

    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const insert = await db.collection('plans').insertOne({
            name,
            price,
            currency,
            signupCredits: Number(signupCreditsRaw ?? '0') || 0,
            projectLimit: Number(projectLimitRaw ?? '0') || 0,
            agentLimit: Number(agentLimitRaw ?? '0') || 0,
            isPublic,
            isDefault: false,
            permissions: {},
            createdAt: now,
            updatedAt: now,
        });
        revalidatePath('/admin/dashboard/plans');
        return { success: true, planId: insert.insertedId.toHexString() };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function duplicatePlan(planId: string): Promise<Result & { planId?: string }> {
    const auth = await requireAdmin();
    if (auth) return auth;
    const oid = objectIdOrError(planId);
    if ('success' in oid) return oid;

    try {
        const { db } = await connectToDatabase();
        const src = await db.collection('plans').findOne({ _id: oid.id });
        if (!src) return { success: false, error: 'Plan not found.' };

        const { _id, createdAt, updatedAt, isDefault, ...rest } = src;
        const now = new Date();
        const insert = await db.collection('plans').insertOne({
            ...rest,
            name: `${rest.name} (Copy)`,
            isPublic: false,
            isDefault: false,
            createdAt: now,
            updatedAt: now,
        });
        revalidatePath('/admin/dashboard/plans');
        return { success: true, planId: insert.insertedId.toHexString() };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ============================================================ */
/*  TEMPLATES — bulk delete                                     */
/* ============================================================ */

export async function bulkDeleteLibraryTemplates(
    templateIds: string[],
): Promise<Result & { deleted?: number }> {
    const auth = await requireAdmin();
    if (auth) return auth;

    if (!Array.isArray(templateIds) || templateIds.length === 0) {
        return { success: false, error: 'No templates selected.' };
    }

    const oids: ObjectId[] = [];
    for (const id of templateIds) {
        try {
            oids.push(new ObjectId(id));
        } catch {
            return { success: false, error: `Invalid template id: ${id}` };
        }
    }

    try {
        const { db } = await connectToDatabase();
        const res = await db.collection('library_templates').deleteMany({
            _id: { $in: oids },
        });
        revalidatePath('/admin/dashboard/template-library');
        return { success: true, deleted: res.deletedCount };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ============================================================ */
/*  BROADCASTS — retry failed                                   */
/* ============================================================ */

export async function retryFailedBroadcast(broadcastId: string): Promise<Result> {
    const auth = await requireAdmin();
    if (auth) return auth;
    const oid = objectIdOrError(broadcastId);
    if ('success' in oid) return oid;

    try {
        const { db } = await connectToDatabase();
        // Move failed contacts back to queued so the next worker pass picks
        // them up. The actual sender (Rust / worker) is responsible for the
        // network call — admin just resets the row state.
        const now = new Date();
        const broadcastRes = await db.collection('broadcasts').updateOne(
            { _id: oid.id, status: { $in: ['Failed', 'Partial Failure', 'Completed'] } },
            {
                $set: {
                    status: 'Queued',
                    retriedAt: now,
                    errorCount: 0,
                },
            },
        );

        if (broadcastRes.matchedCount === 0) {
            return { success: false, error: 'Broadcast not found or not retryable.' };
        }

        await db.collection('broadcast_contacts').updateMany(
            { broadcastId: oid.id, status: { $in: ['failed', 'error'] } },
            { $set: { status: 'pending', retriedAt: now }, $unset: { error: '' } },
        );

        revalidatePath('/admin/dashboard/broadcast-log');
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ============================================================ */
/*  FLOW LOGS — replay a single failed run                      */
/* ============================================================ */

export async function replayFlowLog(logId: string): Promise<Result> {
    const auth = await requireAdmin();
    if (auth) return auth;
    const oid = objectIdOrError(logId);
    if ('success' in oid) return oid;

    try {
        const { db } = await connectToDatabase();
        const log = await db.collection('flow_logs').findOne({ _id: oid.id });
        if (!log) return { success: false, error: 'Flow log not found.' };

        // Queue a replay task — the SabFlow worker polls `flow_replay_queue`.
        await db.collection('flow_replay_queue').insertOne({
            sourceLogId: oid.id,
            flowId: log.flowId,
            contactId: log.contactId,
            projectId: log.projectId,
            status: 'pending',
            requestedAt: new Date(),
        });
        revalidatePath('/admin/dashboard/flow-logs');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ============================================================ */
/*  WHATSAPP PROJECTS — archive / restore                       */
/* ============================================================ */

export async function setProjectArchived(
    projectId: string,
    archived: boolean,
): Promise<Result> {
    const auth = await requireAdmin();
    if (auth) return auth;
    const oid = objectIdOrError(projectId);
    if ('success' in oid) return oid;

    try {
        const { db } = await connectToDatabase();
        const res = await db.collection('projects').updateOne(
            { _id: oid.id },
            {
                $set: {
                    isArchived: archived,
                    archivedAt: archived ? new Date() : null,
                },
            },
        );
        if (res.matchedCount === 0) {
            return { success: false, error: 'Project not found.' };
        }
        revalidatePath('/admin/dashboard/whatsapp-projects');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ============================================================ */
/*  SYSTEM — queue & worker health (read-only)                  */
/* ============================================================ */

export type QueueSnapshot = {
    name: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
};

/**
 * Aggregate `job_queue` rows by queue name + state. SabNode stores BullMQ-like
 * job state in Mongo (`job_queue`) as a portable mirror. This is intentionally
 * a Mongo-only read so it works in environments where Redis isn't reachable
 * from Next.js (PM2-isolated workers).
 */
export async function getQueueSnapshots(): Promise<QueueSnapshot[]> {
    try {
        const { db } = await connectToDatabase();
        const rows = await db
            .collection('job_queue')
            .aggregate<{
                _id: { queue: string; state: string };
                count: number;
            }>([
                {
                    $group: {
                        _id: { queue: '$queue', state: '$state' },
                        count: { $sum: 1 },
                    },
                },
            ])
            .toArray();

        const map = new Map<string, QueueSnapshot>();
        for (const r of rows) {
            const name = r._id.queue || 'default';
            const state = (r._id.state || '').toLowerCase();
            const snap =
                map.get(name) ??
                ({
                    name,
                    waiting: 0,
                    active: 0,
                    completed: 0,
                    failed: 0,
                    delayed: 0,
                } as QueueSnapshot);
            if (state === 'waiting' || state === 'pending') snap.waiting += r.count;
            else if (state === 'active' || state === 'processing') snap.active += r.count;
            else if (state === 'completed' || state === 'succeeded') snap.completed += r.count;
            else if (state === 'failed') snap.failed += r.count;
            else if (state === 'delayed' || state === 'scheduled') snap.delayed += r.count;
            map.set(name, snap);
        }
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
        console.error('[admin] getQueueSnapshots failed:', e);
        return [];
    }
}

export type CronRunSummary = {
    name: string;
    lastRunAt: string | null;
    lastStatus: 'success' | 'failed' | 'running' | 'unknown';
    lastDurationMs: number | null;
    runs24h: number;
    failures24h: number;
};

export async function getCronRunSummary(): Promise<CronRunSummary[]> {
    try {
        const { db } = await connectToDatabase();
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const rows = await db
            .collection('cron_runs')
            .aggregate<{
                _id: string;
                lastRunAt: Date | null;
                lastStatus: string | null;
                lastDurationMs: number | null;
                runs24h: number;
                failures24h: number;
            }>([
                { $sort: { startedAt: -1 } },
                {
                    $group: {
                        _id: '$name',
                        lastRunAt: { $first: '$startedAt' },
                        lastStatus: { $first: '$status' },
                        lastDurationMs: { $first: '$durationMs' },
                        runs24h: {
                            $sum: { $cond: [{ $gte: ['$startedAt', since] }, 1, 0] },
                        },
                        failures24h: {
                            $sum: {
                                $cond: [
                                    {
                                        $and: [
                                            { $gte: ['$startedAt', since] },
                                            { $eq: ['$status', 'failed'] },
                                        ],
                                    },
                                    1,
                                    0,
                                ],
                            },
                        },
                    },
                },
                { $sort: { _id: 1 } },
            ])
            .toArray();

        return rows.map((r) => ({
            name: r._id,
            lastRunAt: r.lastRunAt ? new Date(r.lastRunAt).toISOString() : null,
            lastStatus: (r.lastStatus as CronRunSummary['lastStatus']) ?? 'unknown',
            lastDurationMs: r.lastDurationMs ?? null,
            runs24h: r.runs24h ?? 0,
            failures24h: r.failures24h ?? 0,
        }));
    } catch (e) {
        console.error('[admin] getCronRunSummary failed:', e);
        return [];
    }
}

export type DbStats = {
    collections: number;
    dataSize: number;
    storageSize: number;
    indexes: number;
    indexSize: number;
};

export async function getDbStats(): Promise<DbStats | null> {
    try {
        const { db } = await connectToDatabase();
        const s = (await db.command({ dbStats: 1 })) as Record<string, number>;
        return {
            collections: s.collections ?? 0,
            dataSize: s.dataSize ?? 0,
            storageSize: s.storageSize ?? 0,
            indexes: s.indexes ?? 0,
            indexSize: s.indexSize ?? 0,
        };
    } catch (e) {
        console.error('[admin] getDbStats failed:', e);
        return null;
    }
}

/* ============================================================ */
/*  AUDIT — paginated raw rows + CSV export                     */
/* ============================================================ */

export type AuditRow = {
    id: string;
    timestamp: string;
    tenantId: string;
    actor: string;
    action: string;
    resource: string;
    success: boolean;
    metadata?: string;
};

export type AuditFilters = {
    tenantId?: string;
    actor?: string;
    action?: string;
    resource?: string;
    onlyFailures?: boolean;
    from?: string;
    to?: string;
};

function buildAuditFilter(f: AuditFilters): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (f.tenantId) filter.tenantId = f.tenantId;
    if (f.actor) filter.actor = { $regex: f.actor, $options: 'i' };
    if (f.action) filter.action = { $regex: f.action, $options: 'i' };
    if (f.resource) filter.resource = { $regex: f.resource, $options: 'i' };
    if (f.onlyFailures) filter.success = false;
    if (f.from || f.to) {
        const range: Record<string, Date> = {};
        if (f.from) range.$gte = new Date(f.from);
        if (f.to) range.$lte = new Date(f.to);
        filter.timestamp = range;
    }
    return filter;
}

export async function listAuditRows(
    filters: AuditFilters,
    page: number = 1,
    limit: number = 50,
): Promise<{ rows: AuditRow[]; total: number }> {
    const auth = await requireAdmin();
    if (auth) return { rows: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const filter = buildAuditFilter(filters);
        const skip = Math.max(0, (page - 1) * limit);

        const [docs, total] = await Promise.all([
            db
                .collection('crm_audit_log')
                .find(filter)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('crm_audit_log').countDocuments(filter),
        ]);

        const rows: AuditRow[] = docs.map((d) => ({
            id: d._id?.toString() ?? '',
            timestamp:
                d.timestamp instanceof Date
                    ? d.timestamp.toISOString()
                    : String(d.timestamp ?? ''),
            tenantId: d.tenantId ?? '',
            actor: d.actor ?? '',
            action: d.action ?? '',
            resource: d.resource ?? '',
            success: d.success !== false,
            metadata: d.metadata ? JSON.stringify(d.metadata) : undefined,
        }));

        return { rows, total };
    } catch (e) {
        console.error('[admin] listAuditRows failed:', e);
        return { rows: [], total: 0 };
    }
}

export async function exportAuditCsv(
    filters: AuditFilters,
    cap: number = 10_000,
): Promise<{ success: boolean; csv?: string; error?: string }> {
    const auth = await requireAdmin();
    if (auth) return auth;

    try {
        const { db } = await connectToDatabase();
        const filter = buildAuditFilter(filters);
        const docs = await db
            .collection('crm_audit_log')
            .find(filter)
            .sort({ timestamp: -1 })
            .limit(cap)
            .toArray();

        const header = 'timestamp,tenantId,actor,action,resource,success,metadata';
        const escape = (v: unknown) => {
            const s = v === undefined || v === null ? '' : String(v);
            return s.includes(',') || s.includes('"') || s.includes('\n')
                ? `"${s.replace(/"/g, '""')}"`
                : s;
        };
        const lines = docs.map((d) =>
            [
                d.timestamp instanceof Date
                    ? d.timestamp.toISOString()
                    : String(d.timestamp ?? ''),
                d.tenantId ?? '',
                d.actor ?? '',
                d.action ?? '',
                d.resource ?? '',
                d.success !== false ? 'true' : 'false',
                d.metadata ? JSON.stringify(d.metadata) : '',
            ]
                .map(escape)
                .join(','),
        );
        return { success: true, csv: [header, ...lines].join('\n') };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

/* ============================================================ */
/*  MARKETPLACE QUEUE — bulk approve / reject                   */
/* ============================================================ */

export async function bulkUpdateSubmissionStatus(
    submissionIds: string[],
    status: 'approved' | 'rejected',
    reason?: string,
): Promise<Result & { updated?: number }> {
    const auth = await requireAdmin();
    if (auth) return auth;
    if (!submissionIds.length) {
        return { success: false, error: 'No submissions selected.' };
    }
    if (status === 'rejected' && !reason) {
        return { success: false, error: 'Rejection reason is required.' };
    }

    const oids: ObjectId[] = [];
    for (const id of submissionIds) {
        try {
            oids.push(new ObjectId(id));
        } catch {
            return { success: false, error: `Invalid submission id: ${id}` };
        }
    }

    try {
        const { db } = await connectToDatabase();
        const set: Record<string, unknown> = {
            status,
            reviewedAt: new Date(),
        };
        if (status === 'rejected' && reason) set.rejectionReason = reason;
        const res = await db
            .collection('sabflow_marketplace_submissions')
            .updateMany({ _id: { $in: oids } }, { $set: set });
        revalidatePath('/admin/dashboard/marketplace/queue');
        return { success: true, updated: res.modifiedCount };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
