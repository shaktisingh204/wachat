import { Badge, Card, ZoruCardContent, ZoruCardHeader, ZoruCardTitle } from '@/components/sabcrm/20ui/compat';
import {
  ObjectId } from 'mongodb';

import { getSession } from '@/app/actions/user.actions';

/**
 * <EntityAuditTimeline /> — server component that renders the audit history
 * for a single CRM entity instance (per `docs/ecosystem/CRM_PLAN.md` §A7).
 *
 * Data source: `crm_audit_log` Mongo collection (written by
 * `src/lib/audit-log.ts::writeAuditEntry`). We read directly from Mongo —
 * there is no rust client for this read path today.
 *
 * Tenant-scoped: filters by `userId == session.user._id`.
 *
 * Caller wraps in <Suspense> if they want a loading skeleton; this server
 * component renders synchronously after its single Mongo query.
 */

import { connectToDatabase } from '@/lib/mongodb';

/* ─── Types ──────────────────────────────────────────────────────────── */

interface AuditEntry {
    _id: string;
    createdAt: string;
    actorId: string;
    action: string;
    entityKind: string;
    entityId: string;
    reason: string | null;
    diff: Record<string, { before?: unknown; after?: unknown }> | null;
}

export interface ReceiptAuditTimelineProps {
    entityKind: string;
    entityId: string;
    /** Max number of rows to fetch. Defaults to 50. */
    limit?: number;
    /** Optional override; if absent, falls back to the heading "Activity". */
    title?: string;
    filterType?: 'all' | 'manual' | 'system';
}

/* ─── Action → tone mapping ──────────────────────────────────────────── */

type Tone = 'success' | 'info' | 'danger' | 'warning' | 'neutral';

const ACTION_TONE: Record<string, Tone> = {
    create: 'success',
    update: 'info',
    delete: 'danger',
    archive: 'warning',
    restore: 'success',
    status_change: 'warning',
    assign: 'info',
    convert: 'info',
    send: 'info',
    sign: 'success',
    pay: 'success',
    void: 'danger',
    refund: 'warning',
};

function toneFor(action: string): Tone {
    return ACTION_TONE[action] ?? 'neutral';
}

function actionLabel(action: string): string {
    return action.replace(/_/g, ' ');
}

/* ─── Time helpers ──────────────────────────────────────────────────── */

const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diffSec = Math.round((then - Date.now()) / 1000);
    const abs = Math.abs(diffSec);
    if (abs < 60) return RTF.format(diffSec, 'second');
    if (abs < 3600) return RTF.format(Math.round(diffSec / 60), 'minute');
    if (abs < 86_400) return RTF.format(Math.round(diffSec / 3600), 'hour');
    if (abs < 604_800) return RTF.format(Math.round(diffSec / 86_400), 'day');
    return new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC' });
}

function absoluteTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.toLocaleDateString('en-US', { timeZone: 'UTC' })} ${d.toLocaleTimeString('en-US', { timeZone: 'UTC' })}`;
}

/* ─── Actor naming ──────────────────────────────────────────────────── */

function actorLabel(actorId: string, sessionUserId: string): string {
    if (!actorId) return 'System';
    if (actorId === sessionUserId) return 'You';
    return `User ${actorId.slice(-6)}`;
}

/* ─── Diff renderer ─────────────────────────────────────────────────── */

function stringifyFragment(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'string') return value.length > 80 ? value.slice(0, 80) + '…' : value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    try {
        const json = JSON.stringify(value);
        return json.length > 80 ? json.slice(0, 80) + '…' : json;
    } catch {
        return '[unserializable]';
    }
}

function DiffTable({ diff }: { diff: NonNullable<AuditEntry['diff']> }) {
    const entries = Object.entries(diff).filter(([, change]) => {
        return change.before !== undefined || change.after !== undefined;
    });
    if (entries.length === 0) return null;
    return (
        <div className="mt-2 overflow-hidden rounded border border-[var(--st-border)] dark:border-[var(--st-border)]">
            <table className="w-full text-xs">
                <thead className="bg-[var(--st-bg-muted)] dark:bg-[var(--st-text)]/50">
                    <tr>
                        <th className="px-2 py-1 text-left font-medium text-[var(--st-text)]">Field</th>
                        <th className="px-2 py-1 text-left font-medium text-[var(--st-text)]">Before</th>
                        <th className="px-2 py-1 text-left font-medium text-[var(--st-text)]">After</th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map(([field, change]) => (
                        <tr key={field} className="border-t border-[var(--st-border)] dark:border-[var(--st-border)]">
                            <td className="px-2 py-1 align-top font-medium">{field}</td>
                            <td className="px-2 py-1 align-top text-[var(--st-text)]">
                                {stringifyFragment(change.before)}
                            </td>
                            <td className="px-2 py-1 align-top">
                                {stringifyFragment(change.after)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

/* ─── Main component ─────────────────────────────────────────────────── */

export async function ReceiptAuditTimeline({
    entityKind,
    entityId,
    limit = 50,
    title = 'Activity',
    filterType = 'all',
}: ReceiptAuditTimelineProps) {
    const session = await getSession();
    if (!session?.user?._id) {
        return (
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>{title}</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <p className="text-sm text-[var(--st-text)]">Login required to view activity.</p>
                </ZoruCardContent>
            </Card>
        );
    }

    const userId = String(session.user._id);
    let entries: AuditEntry[] = [];

    if (entityKind && entityId && ObjectId.isValid(userId)) {
        try {
            const { db } = await connectToDatabase();
            const docs = await db
                .collection('crm_audit_log')
                .find({
                    userId: new ObjectId(userId),
                    entityKind,
                    entityId,
                } as any)
                .sort({ createdAt: -1 })
                .limit(Math.max(1, Math.min(200, limit)))
                .toArray();
            
            // Filter by actorId depending on the `filterType`
            const unfilteredEntries = JSON.parse(JSON.stringify(docs)) as AuditEntry[];
            entries = unfilteredEntries.filter(entry => {
                const isSystem = !entry.actorId;
                if (filterType === 'manual') return !isSystem;
                if (filterType === 'system') return isSystem;
                return true;
            });
        } catch (e) {
            console.error('[ReceiptAuditTimeline] read failed:', e);
        }
    }

    if (entries.length === 0) {
        return (
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>{title}</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <p className="text-sm text-[var(--st-text)]">No activity yet.</p>
                </ZoruCardContent>
            </Card>
        );
    }

    return (
        <Card>
            <ZoruCardHeader>
                <ZoruCardTitle>{title}</ZoruCardTitle>
            </ZoruCardHeader>
            <ZoruCardContent>
                <ol className="relative space-y-4 border-l border-[var(--st-border)] pl-4 dark:border-[var(--st-border)]">
                    {entries.map((entry) => {
                        const tone = toneFor(entry.action);
                        const id = typeof entry._id === 'string' ? entry._id : String(entry._id);
                        return (
                            <li key={id} className="relative">
                                <span
                                    className="absolute -left-[21px] top-1.5 inline-block size-2.5 rounded-full border border-white bg-[var(--st-bg-muted)] dark:border-[var(--st-border)]"
                                    aria-hidden
                                />
                                <div className="flex flex-wrap items-baseline gap-2 text-sm">
                                    <span className="font-medium">
                                        {actorLabel(String(entry.actorId ?? ''), userId)}
                                    </span>
                                    <Badge variant={tone as any}>
                                        {actionLabel(entry.action)}
                                    </Badge>
                                    <span className="text-[var(--st-text)]">{entry.entityKind}</span>
                                    <span
                                        className="ml-auto text-xs text-[var(--st-text)]"
                                        title={absoluteTime(entry.createdAt)}
                                    >
                                        {relativeTime(entry.createdAt)}
                                    </span>
                                </div>
                                {entry.reason ? (
                                    <p className="mt-1 text-xs text-[var(--st-text)]">{entry.reason}</p>
                                ) : null}
                                {entry.diff ? <DiffTable diff={entry.diff} /> : null}
                            </li>
                        );
                    })}
                </ol>
            </ZoruCardContent>
        </Card>
    );
}
