'use client';

import { Badge, Button, Card, StatCard, cn, useZoruToast } from '@/components/zoruui';
import {
  AlertTriangle,
  AtSign,
  Bell,
  Check,
  CheckCheck,
  Clock,
  ExternalLink,
  Inbox,
  UserPlus,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

/**
 * §5.3 — CRM Notifications Hub (client island).
 *
 * Renders the audit-log-backed notification feed. Reads the initial
 * payload from a Server Component parent so first paint is server-
 * rendered; subsequent re-fetches (after mark-read) round-trip via
 * `getCrmNotifications`.
 *
 * Why a client island and not pure server: mark-read needs optimistic
 * updates + filter chips need local state. Keeping it scoped to the
 * feed (not the whole page) preserves the server-rendered chrome.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    getCrmNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    type CrmNotificationKind,
    type CrmNotificationRow,
    type CrmNotificationKpis,
} from '@/app/actions/crm-notifications.actions';

export interface NotificationsClientProps {
    initialItems: CrmNotificationRow[];
    initialKpis: CrmNotificationKpis;
}

type KindFilter = CrmNotificationKind | 'all';
type StatusFilter = 'all' | 'unread' | 'read';

const KIND_CHIPS: Array<{ value: KindFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'assignment', label: 'Assignments' },
    { value: 'mention', label: 'Mentions' },
    { value: 'due', label: 'Due' },
    { value: 'sla', label: 'SLA' },
    { value: 'status_change', label: 'Status' },
];

const STATUS_CHIPS: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'unread', label: 'Unread' },
    { value: 'read', label: 'Read' },
];

const KIND_ICON: Record<CrmNotificationKind, React.ComponentType<{ className?: string }>> = {
    assignment: UserPlus,
    mention: AtSign,
    due: Clock,
    sla: AlertTriangle,
    status_change: Bell,
};

const ACTION_VERB: Record<string, string> = {
    create: 'created',
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

function verbFor(action: string): string {
    return ACTION_VERB[action] ?? action.replace(/_/g, ' ');
}

function actorLabel(actorId: string | null, actorIsYou: boolean): string {
    if (actorIsYou) return 'You';
    if (!actorId) return 'System';
    return `User ${actorId.slice(-6)}`;
}

const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
function relative(iso: string): string {
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

export function NotificationsClient({
    initialItems,
    initialKpis,
}: NotificationsClientProps): React.JSX.Element {
    const { toast } = useZoruToast();
    const [rows, setRows] = React.useState<CrmNotificationRow[]>(initialItems);
    const [kpis, setKpis] = React.useState<CrmNotificationKpis>(initialKpis);
    const [kindFilter, setKindFilter] = React.useState<KindFilter>('all');
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
    const [pending, startTransition] = React.useTransition();

    const filtered = React.useMemo(() => {
        return rows.filter((row) => {
            if (kindFilter !== 'all' && row.kind !== kindFilter) return false;
            if (statusFilter === 'unread' && row.read) return false;
            if (statusFilter === 'read' && !row.read) return false;
            return true;
        });
    }, [rows, kindFilter, statusFilter]);

    const refresh = React.useCallback(async () => {
        const res = await getCrmNotifications();
        if ('error' in res) {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
            return;
        }
        setRows(res.items);
        setKpis(res.kpis);
    }, [toast]);

    const handleMarkOne = React.useCallback(
        (id: string) => {
            // Optimistic — flip the flag immediately, then reconcile on
            // server response.
            setRows((prev) => prev.map((r) => (r._id === id ? { ...r, read: true } : r)));
            setKpis((prev) => ({ ...prev, unread: Math.max(0, prev.unread - 1) }));
            startTransition(async () => {
                const res = await markNotificationRead(id);
                if (!res.success) {
                    toast({ title: 'Error', description: res.error, variant: 'destructive' });
                    // Revert.
                    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, read: false } : r)));
                    setKpis((prev) => ({ ...prev, unread: prev.unread + 1 }));
                }
            });
        },
        [toast],
    );

    const handleMarkAll = React.useCallback(() => {
        if (kpis.unread === 0) return;
        startTransition(async () => {
            const res = await markAllNotificationsRead();
            if (!res.success) {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
                return;
            }
            toast({ title: 'All notifications marked read' });
            await refresh();
        });
    }, [kpis.unread, refresh, toast]);

    const empty =
        filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
                <Inbox className="h-10 w-10 text-zoru-ink-muted" />
                <h3 className="text-base font-medium text-zoru-ink">
                    {rows.length === 0
                        ? "You're all caught up!"
                        : 'No notifications match the filters'}
                </h3>
                <p className="max-w-sm text-sm text-zoru-ink-muted">
                    {rows.length === 0
                        ? 'When teammates assign you work, @-mention you, or SLA timers fire, you’ll see them here.'
                        : 'Try the chips above to widen your view.'}
                </p>
            </div>
        ) : null;

    return (
        <>
            <Modal open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <div className="p-6">
                    <h2 className="text-lg font-medium mb-4">Notification Settings</h2>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Email Notifications</span>
                            <input type="checkbox" className="toggle" defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Push Notifications</span>
                            <input type="checkbox" className="toggle" defaultChecked />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm">Mentions Only</span>
                            <input type="checkbox" className="toggle" />
                        </div>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button onClick={() => setIsSettingsOpen(false)}>Save</Button>
                    </div>
                </div>
            </Modal>
        <EntityListShell
            title="Notifications"
            subtitle="Audit-log events that need your attention — assignments, mentions, SLA breaches, status changes."
            primaryAction={
                <div className="flex gap-2">
                <Button
                    variant="ghost"
                    onClick={() => setIsSettingsOpen(true)}
                >
                    <Settings className="h-4 w-4 mr-1" />
                    Settings
                </Button>
                <Button
                    variant="ghost"
                    onClick={handleMarkAll}
                    disabled={pending || kpis.unread === 0}
                >
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Mark all read
                </Button>
                </div>
            }
            filters={
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap items-center gap-1">
                        {KIND_CHIPS.map((chip) => (
                            <Button
                                key={chip.value}
                                variant={kindFilter === chip.value ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setKindFilter(chip.value)}
                            >
                                {chip.label}
                            </Button>
                        ))}
                    </div>
                    <span className="h-4 w-px bg-zoru-line" aria-hidden />
                    <div className="flex flex-wrap items-center gap-1">
                        {STATUS_CHIPS.map((chip) => (
                            <Button
                                key={chip.value}
                                variant={statusFilter === chip.value ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setStatusFilter(chip.value)}
                            >
                                {chip.label}
                            </Button>
                        ))}
                    </div>
                </div>
            }
            empty={empty}
        >
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <StatCard label="Unread" value={kpis.unread.toLocaleString()} />
                    <StatCard label="Today" value={kpis.today.toLocaleString()} />
                    <StatCard label="This week" value={kpis.thisWeek.toLocaleString()} />
                    <StatCard label="Overdue tasks" value={kpis.overdue.toLocaleString()} />
                    <StatCard label="SLA at risk" value={kpis.slaAtRisk.toLocaleString()} />
                </div>

                {filtered.length > 0 ? (
                    <div className="flex flex-col gap-6">
                        {(() => {
                            const today = new Date();
                            today.setHours(0,0,0,0);
                            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                            
                            const groups: Record<string, typeof filtered> = {
                                'Today': [],
                                'This Week': [],
                                'Older': []
                            };
                            
                            filtered.forEach(row => {
                                const ts = new Date(row.ts);
                                if (ts >= today) groups['Today'].push(row);
                                else if (ts >= weekAgo) groups['This Week'].push(row);
                                else groups['Older'].push(row);
                            });
                            
                            return Object.entries(groups).filter(([_, items]) => items.length > 0).map(([label, items]) => (
                                <div key={label}>
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2 px-2">{label}</h4>
                                    <Card className="p-0">
                                        <ul className="divide-y divide-zoru-line">
                                            {items.map((row) => {
                                const Icon = KIND_ICON[row.kind] ?? Bell;
                                return (
                                    <li
                                        key={row._id}
                                        className={cn(
                                            'flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between',
                                            !row.read && 'bg-zoru-warning-bg/20',
                                        )}
                                    >
                                        <div className="flex min-w-0 flex-1 items-start gap-3">
                                            <Icon className="mt-1 h-4 w-4 shrink-0 text-zoru-ink-muted" />
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <Badge variant="secondary">
                                                        {row.entityKind}
                                                    </Badge>
                                                    <Badge variant="secondary">
                                                        {row.kind}
                                                    </Badge>
                                                    <p className="text-[13px] text-zoru-ink">
                                                        <span className="font-medium">
                                                            {actorLabel(row.actorId, row.actorIsYou)}
                                                        </span>{' '}
                                                        {verbFor(row.action)}{' '}
                                                        <span className="font-medium">
                                                            {row.entityKind} {row.entityId.slice(-6)}
                                                        </span>
                                                    </p>
                                                </div>
                                                {row.reason ? (
                                                    <p className="mt-1 text-[12.5px] text-zoru-ink-muted">
                                                        {row.reason}
                                                    </p>
                                                ) : null}
                                                <p className="mt-1 text-[11.5px] text-zoru-ink-muted">
                                                    {relative(row.ts)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-1">
                                            {row.entityHref ? (
                                                <Button asChild variant="ghost" size="sm">
                                                    <Link href={row.entityHref}>
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                        Open
                                                    </Link>
                                                </Button>
                                            ) : null}
                                            {!row.read ? (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleMarkOne(row._id)}
                                                    disabled={pending}
                                                >
                                                    <Check className="h-3.5 w-3.5" />
                                                    Read
                                                </Button>
                                            ) : null}
                                        </div>
                                    </li>
                                );
                                            })}
                                        </ul>
                                    </Card>
                                </div>
                            ));
                        })()}
                    </div>
                ) : null}
            </div>
        </EntityListShell>
        </>
    );
}
