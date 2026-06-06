'use client';

import { Avatar, AvatarFallback, Badge } from '@/components/sabcrm/20ui';
import { User as UserIcon } from 'lucide-react';

/**
 * <ActivityRow> — one row in the CRM tenant-wide activity feed.
 *
 * Pure presentational client component. Owns:
 *   - The action-verb projection (`'create' → "created a"`, etc.).
 *   - The relative timestamp string (refreshed on the next render — we
 *     don't tick it ourselves; that's overkill for an audit feed).
 *   - The entity-detail href lookup, falling back to a list page when
 *     no dedicated detail route exists yet.
 *
 * Mirrors the row chrome used in `entity-audit-timeline.tsx` so the
 * detail-page footer and the global feed look like cousins, not
 * strangers.
 */

import * as React from 'react';
import Link from 'next/link';

/* ─── Public types ───────────────────────────────────────────────────── */

export interface ActivityRowEntry {
    _id: string;
    createdAt: string;
    actorId: string;
    action: string;
    entityKind: string;
    entityId: string;
    reason: string | null;
}

export interface ActivityRowProps {
    entry: ActivityRowEntry;
    /** Session user id — used to render "You" instead of "User abc123". */
    currentUserId?: string;
    /** Optional display name override for the actor (e.g. employee name). */
    actorLabel?: string;
}

/* ─── Verb / tone projections ────────────────────────────────────────── */

type Tone = 'success' | 'info' | 'danger' | 'warning' | 'neutral';

const VERB_BY_ACTION: Record<string, string> = {
    create: 'created a',
    update: 'updated',
    delete: 'deleted',
    archive: 'archived',
    restore: 'restored',
    status_change: 'changed status of',
    assign: 'assigned',
    convert: 'converted',
    send: 'sent',
    sign: 'signed',
    pay: 'paid',
    void: 'voided',
    refund: 'refunded',
};

const TONE_BY_ACTION: Record<string, Tone> = {
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

function verbFor(action: string): string {
    return VERB_BY_ACTION[action] ?? action.replace(/_/g, ' ');
}

function toneFor(action: string): Tone {
    return TONE_BY_ACTION[action] ?? 'neutral';
}

/* ─── Entity-detail href map ─────────────────────────────────────────── */

/**
 * Best-effort detail-page resolver. The full canonical map lives in
 * `command-palette.tsx` for the picker, but it is keyed on the
 * `EntityKey` union (closed set), whereas `crm_audit_log.entityKind` is
 * open-ended (`'ticket'`, `'proposal'`, etc.). We mirror the common
 * subset here and fall back to a sensible CRM root for the rest.
 */
const ENTITY_HREF: Record<string, (id: string) => string> = {
    lead: (id) => `/dashboard/crm/leads/${id}`,
    deal: (id) => `/dashboard/crm/deals/${id}`,
    client: (id) => `/dashboard/crm/sales/clients/${id}`,
    contact: (id) => `/dashboard/crm/contacts/${id}`,
    vendor: (id) => `/dashboard/crm/purchases/vendors/${id}`,
    invoice: (id) => `/dashboard/crm/sales/invoices/${id}`,
    quotation: (id) => `/dashboard/crm/sales/quotations/${id}`,
    proposal: (id) => `/dashboard/crm/sales/proposals/${id}`,
    project: (id) => `/dashboard/crm/projects/${id}`,
    task: () => `/dashboard/crm/sales-crm/tasks`,
    ticket: (id) => `/dashboard/sabdesk/${id}`,
    item: (id) => `/dashboard/crm/inventory/items/${id}`,
    warehouse: (id) => `/dashboard/crm/inventory/warehouses/${id}`,
    bankAccount: (id) => `/dashboard/crm/banking/bank-accounts/${id}`,
    asset: (id) => `/dashboard/hrm/hr/assets/${id}`,
    employee: (id) => `/dashboard/hrm/payroll/employees/${id}`,
};

function entityHref(kind: string, id: string): string | null {
    const fn = ENTITY_HREF[kind];
    if (fn && id) return fn(id);
    return null;
}

/* ─── Time formatter ─────────────────────────────────────────────────── */

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
    return new Date(iso).toLocaleDateString();
}

function absoluteTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
}

/* ─── Actor naming ──────────────────────────────────────────────────── */

function actorDisplay(
    actorId: string,
    currentUserId: string | undefined,
    override: string | undefined,
): string {
    if (override) return override;
    if (!actorId) return 'System';
    if (currentUserId && actorId === currentUserId) return 'You';
    return `User ${actorId.slice(-6)}`;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function ActivityRow({
    entry,
    currentUserId,
    actorLabel,
}: ActivityRowProps): React.JSX.Element {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => { setMounted(true); }, []);

    const tone = toneFor(entry.action);
    const verb = verbFor(entry.action);
    const actor = actorDisplay(entry.actorId, currentUserId, actorLabel);
    const href = entityHref(entry.entityKind, entry.entityId);
    const entityShortId =
        entry.entityId && entry.entityId.length > 6
            ? entry.entityId.slice(-6)
            : entry.entityId;

    return (
        <li className="flex items-start gap-3 p-4">
            <Avatar className="h-8 w-8">
                <AvatarFallback>
                    <UserIcon className="h-4 w-4" />
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--st-text)]">
                    <span className="font-medium">{actor}</span>
                    <span className="text-[var(--st-text-secondary)]">{verb}</span>
                    <Badge variant={tone === 'neutral' ? 'secondary' : (tone as 'success' | 'info' | 'danger' | 'warning')}>
                        {entry.entityKind}
                    </Badge>
                    {href ? (
                        <Link
                            href={href}
                            className="font-mono text-[11.5px] text-[var(--st-text-secondary)] underline-offset-2 hover:underline"
                        >
                            {entityShortId}
                        </Link>
                    ) : entityShortId ? (
                        <span className="font-mono text-[11.5px] text-[var(--st-text-secondary)]">
                            {entityShortId}
                        </span>
                    ) : null}
                    <span
                        className="ml-auto text-[11.5px] text-[var(--st-text-secondary)]"
                        title={mounted ? absoluteTime(entry.createdAt) : entry.createdAt}
                    >
                        {mounted ? relativeTime(entry.createdAt) : entry.createdAt.slice(0, 10)}
                    </span>
                </div>
                {entry.reason ? (
                    <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">
                        {entry.reason}
                    </p>
                ) : null}
            </div>
        </li>
    );
}

export default ActivityRow;
