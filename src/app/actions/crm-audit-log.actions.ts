'use server';

/**
 * Audit-log read-side actions.
 *
 * The audit-log page is the only consumer today. We keep the wire shape
 * stable with `_components/audit-log-browser.tsx` and use
 * `normalizeAuditDiff` from `src/lib/compliance/audit-log.ts` to flatten
 * `before` / `after` payloads for CSV export.
 *
 * Reads are tenant-scoped (`userId === session.user._id`) — the shape
 * of `crm_audit_log` is owned by `writeAuditEntry` in
 * `src/lib/audit-log.ts` and is NOT changed here.
 *
 * RBAC: no dedicated `crm_audit_log` module key exists yet. We gate on
 * the presence of a session — every signed-in tenant user can view
 * their own audit log. Cross-actor visibility within the same tenant
 * is implicit (the audit log is intentionally tenant-wide so admins
 * can investigate). A future tightening can add a `crm_audit_log`
 * permission key without changing this file's exported shape.
 */

import { ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';
import { connectToDatabase } from '@/lib/mongodb';
import { normalizeAuditDiff } from '@/lib/compliance/audit-log';

/** Wire shape returned to the audit-log browser. */
export interface AuditLogRow {
    _id: string;
    createdAt?: string;
    actorId?: string;
    actorName?: string;
    action?: string;
    entityKind?: string;
    entityId?: string;
    reason?: string | null;
    diff?: Record<string, { before?: unknown; after?: unknown }> | null;
    ip?: string;
}

/** Filters accepted by the read query. */
export interface AuditLogQuery {
    entityKind?: string;
    actorId?: string;
    action?: string;
    /** ISO date (yyyy-mm-dd or full ISO timestamp). Inclusive. */
    from?: string;
    /** ISO date (yyyy-mm-dd or full ISO timestamp). Inclusive. */
    to?: string;
    /** Free-text — `$text` if a text index exists, otherwise regex on `reason` + diff fields. */
    search?: string;
    /** Hard cap. Defaults to 500, max 5000. */
    limit?: number;
    /** 1-based page number for pagination (page size = limit). Defaults to 1. */
    page?: number;
}

/** KPI summary for the audit log header strip. */
export interface AuditLogKpis {
    eventsToday: number;
    eventsThisWeek: number;
    uniqueActorsToday: number;
    errorEvents: number;
    total: number;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function toStr(v: { toString(): string } | string | null | undefined): string | undefined {
    if (v == null) return undefined;
    return typeof v === 'string' ? v : v.toString();
}

function parseDateBound(value: string | undefined, endOfDay: boolean): Date | undefined {
    if (!value) return undefined;
    // Accept yyyy-mm-dd OR full ISO.
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const iso = isDateOnly
        ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
        : value;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Best-effort: did the caller's tenant text-index `crm_audit_log`? */
async function hasTextIndex(
    db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
): Promise<boolean> {
    try {
        const idx = await db.collection('crm_audit_log').indexes();
        return idx.some((i) => Object.values(i.key ?? {}).includes('text'));
    } catch {
        return false;
    }
}

interface RawAuditDoc {
    _id?: { toString(): string } | string;
    createdAt?: string | Date;
    actorId?: { toString(): string } | string;
    actorName?: string;
    action?: string;
    entityKind?: string;
    entityId?: { toString(): string } | string;
    reason?: string | null;
    diff?: Record<string, { before?: unknown; after?: unknown }> | null;
    ip?: string;
}

function projectRow(d: RawAuditDoc, idx: number): AuditLogRow {
    return {
        _id: toStr(d._id) ?? String(idx),
        createdAt:
            d.createdAt instanceof Date
                ? d.createdAt.toISOString()
                : typeof d.createdAt === 'string'
                  ? d.createdAt
                  : undefined,
        actorId: toStr(d.actorId),
        actorName: d.actorName,
        action: d.action,
        entityKind: d.entityKind,
        entityId: toStr(d.entityId),
        reason: d.reason ?? null,
        diff: d.diff ?? null,
        ip: d.ip,
    };
}

/* ── Reads ─────────────────────────────────────────────────────────── */

/**
 * Tenant-scoped query against `crm_audit_log`. Always sorted by
 * `createdAt desc`. Filters that don't match any rows return an empty
 * array (never throws).
 */
/** Paginated result returned by `getAuditLogPage`. */
export interface AuditLogPageResult {
    rows: AuditLogRow[];
    total: number;
    page: number;
    pageSize: number;
}

function buildAuditQuery(
    userObjectId: ObjectId,
    query: AuditLogQuery,
): Record<string, unknown> {
    const q: Record<string, unknown> = { userId: userObjectId };

    if (query.entityKind) q.entityKind = query.entityKind;
    if (query.action) q.action = query.action;
    if (query.actorId && ObjectId.isValid(query.actorId)) {
        q.actorId = new ObjectId(query.actorId);
    } else if (query.actorId) {
        q.actorId = query.actorId;
    }

    const from = parseDateBound(query.from, false);
    const to = parseDateBound(query.to, true);
    if (from || to) {
        const range: Record<string, Date> = {};
        if (from) range.$gte = from;
        if (to) range.$lte = to;
        q.createdAt = range;
    }

    return q;
}

export async function getAuditLogEntries(query: AuditLogQuery = {}): Promise<AuditLogRow[]> {
    const session = await getSession();
    if (!session?.user?._id) return [];

    const limit = Math.min(Math.max(query.limit ?? 500, 1), 5000);
    const page = Math.max(1, query.page ?? 1);
    const skip = (page - 1) * limit;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const q = buildAuditQuery(userObjectId, query);

        const search = (query.search ?? '').trim();
        if (search) {
            const useText = await hasTextIndex(db);
            if (useText) {
                q.$text = { $search: search };
            } else {
                const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const rx = { $regex: escaped, $options: 'i' };
                q.$or = [
                    { reason: rx },
                    { entityId: rx },
                    { entityKind: rx },
                    { actorName: rx },
                    { 'diff.$**': rx } as Record<string, unknown>,
                ];
            }
        }

        const docs = (await db
            .collection('crm_audit_log')
            .find(q)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray()) as RawAuditDoc[];

        return docs.map((d, i) => projectRow(d, i));
    } catch (e) {
        console.error('[getAuditLogEntries] query failed:', e);
        return [];
    }
}

/** Paginated read with a total count (for 50-per-page pagination UI). */
export async function getAuditLogPage(
    query: AuditLogQuery & { pageSize?: number },
): Promise<AuditLogPageResult> {
    const session = await getSession();
    if (!session?.user?._id) return { rows: [], total: 0, page: 1, pageSize: 50 };

    const pageSize = Math.min(Math.max(query.pageSize ?? 50, 1), 200);
    const page = Math.max(1, query.page ?? 1);
    const skip = (page - 1) * pageSize;

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id as string);
        const q = buildAuditQuery(userObjectId, query);

        const search = (query.search ?? '').trim();
        if (search) {
            const useText = await hasTextIndex(db);
            if (useText) {
                q.$text = { $search: search };
            } else {
                const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const rx = { $regex: escaped, $options: 'i' };
                q.$or = [
                    { reason: rx },
                    { entityId: rx },
                    { entityKind: rx },
                    { actorName: rx },
                    { 'diff.$**': rx } as Record<string, unknown>,
                ];
            }
        }

        const coll = db.collection('crm_audit_log');
        const [docs, total] = await Promise.all([
            coll
                .find(q)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(pageSize)
                .toArray() as Promise<RawAuditDoc[]>,
            coll.countDocuments(q),
        ]);

        return {
            rows: docs.map((d, i) => projectRow(d, i)),
            total,
            page,
            pageSize,
        };
    } catch (e) {
        console.error('[getAuditLogPage] query failed:', e);
        return { rows: [], total: 0, page, pageSize };
    }
}

/**
 * Server-side KPIs for the audit log header strip.
 * Runs in parallel with getAuditLogPage in the page server component.
 */
export async function getAuditLogKpis(): Promise<AuditLogKpis> {
    const empty: AuditLogKpis = {
        eventsToday: 0,
        eventsThisWeek: 0,
        uniqueActorsToday: 0,
        errorEvents: 0,
        total: 0,
    };
    const session = await getSession();
    if (!session?.user?._id) return empty;

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id as string);
        const now = new Date();
        const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const [
            eventsToday,
            eventsThisWeek,
            errorEvents,
            total,
            actorAgg,
        ] = await Promise.all([
            db
                .collection('crm_audit_log')
                .countDocuments({ userId, createdAt: { $gte: startToday } } as Record<string, unknown>),
            db
                .collection('crm_audit_log')
                .countDocuments({ userId, createdAt: { $gte: startWeek } } as Record<string, unknown>),
            db
                .collection('crm_audit_log')
                .countDocuments({ userId, action: { $in: ['error', 'fail', 'denied'] } } as Record<string, unknown>),
            db
                .collection('crm_audit_log')
                .countDocuments({ userId } as Record<string, unknown>),
            db
                .collection('crm_audit_log')
                .aggregate([
                    { $match: { userId, createdAt: { $gte: startToday } } },
                    { $group: { _id: '$actorId' } },
                    { $count: 'n' },
                ])
                .toArray(),
        ]);

        return {
            eventsToday: Number(eventsToday) || 0,
            eventsThisWeek: Number(eventsThisWeek) || 0,
            uniqueActorsToday: Number((actorAgg[0] as { n?: number } | undefined)?.n ?? 0),
            errorEvents: Number(errorEvents) || 0,
            total: Number(total) || 0,
        };
    } catch (e) {
        console.error('[getAuditLogKpis] failed:', e);
        return empty;
    }
}

/* ── CSV export ────────────────────────────────────────────────────── */

function csvEscape(v: unknown): string {
    return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

/** Flatten a normalized diff side into "key=value; key=value" for CSV. */
function summarizeDiffSide(
    diff: Record<string, { before?: unknown; after?: unknown }> | null | undefined,
    side: 'before' | 'after',
): string {
    if (!diff) return '';
    const normalized = normalizeAuditDiff(
        Object.fromEntries(
            Object.entries(diff).map(([k, v]) => [k, v?.[side]]),
        ),
    ) as Record<string, unknown> | null;
    if (!normalized) return '';
    return Object.entries(normalized)
        .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        .join('; ');
}

/**
 * Stream-friendly CSV export — returned as a single string (the page
 * route handler wraps it in a `Response`). Columns:
 *   ts, actor, action, entityKind, entityId, before_summary, after_summary
 */
export async function exportAuditLogCsv(query: AuditLogQuery = {}): Promise<string> {
    // For CSV, allow a wider window than the on-screen list.
    const rows = await getAuditLogEntries({ ...query, limit: query.limit ?? 5000 });
    const header = [
        'ts',
        'actor',
        'action',
        'entityKind',
        'entityId',
        'before_summary',
        'after_summary',
    ];
    const lines: string[] = [header.join(',')];
    for (const r of rows) {
        lines.push(
            [
                csvEscape(r.createdAt ?? ''),
                csvEscape(r.actorName || r.actorId || ''),
                csvEscape(r.action ?? ''),
                csvEscape(r.entityKind ?? ''),
                csvEscape(r.entityId ?? ''),
                csvEscape(summarizeDiffSide(r.diff, 'before')),
                csvEscape(summarizeDiffSide(r.diff, 'after')),
            ].join(','),
        );
    }
    return lines.join('\n');
}
