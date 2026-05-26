'use client';

/**
 * Tabbed inbox: "My requests" + "Awaiting my approval".
 *
 * Filters by blueprint, status, and SLA breach. Stateless w.r.t. the
 * server — applies in-memory filters over the lists handed in from the
 * server page. Re-fetching on filter change is deferred (the lists are
 * small in practice — ~50 rows per tab).
 */
import * as React from 'react';
import Link from 'next/link';

import {
    Badge,
    Button,
    Card,
    Input,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
} from '@/components/zoruui';
import type {
    RequestBlueprintDoc,
    RequestInstanceDoc,
} from '@/app/actions/requests.actions';

interface Props {
    mine: RequestInstanceDoc[];
    awaiting: RequestInstanceDoc[];
    blueprints: RequestBlueprintDoc[];
}

function statusVariant(s?: string) {
    switch (s) {
        case 'approved':
            return 'success' as const;
        case 'rejected':
            return 'destructive' as const;
        case 'cancelled':
            return 'secondary' as const;
        default:
            return 'default' as const;
    }
}

function isBreached(r: RequestInstanceDoc): boolean {
    if (r.breachedAt) return true;
    if (r.status !== 'pending' || !r.slaDeadlineAt) return false;
    return new Date(r.slaDeadlineAt).getTime() < Date.now();
}

function TabsToggle({
    mine,
    awaiting,
}: {
    mine: RequestInstanceDoc[];
    awaiting: RequestInstanceDoc[];
}) {
    const [tab, setTab] = React.useState<'awaiting' | 'mine'>('awaiting');
    return (
        <>
            <div className="mb-4 inline-flex gap-1 rounded-md border border-border p-1">
                <Button
                    variant={tab === 'awaiting' ? 'default' : 'ghost'}
                    onClick={() => setTab('awaiting')}
                >
                    Awaiting my approval ({awaiting.length})
                </Button>
                <Button
                    variant={tab === 'mine' ? 'default' : 'ghost'}
                    onClick={() => setTab('mine')}
                >
                    My requests ({mine.length})
                </Button>
            </div>
            {tab === 'awaiting' ? (
                <RequestList rows={awaiting} showApprover={false} />
            ) : (
                <RequestList rows={mine} showApprover />
            )}
        </>
    );
}

function RequestList({
    rows,
    showApprover = false,
}: {
    rows: RequestInstanceDoc[];
    showApprover?: boolean;
}) {
    if (rows.length === 0) {
        return (
            <Card className="p-8 text-center text-sm text-muted-foreground">
                No requests yet.
            </Card>
        );
    }
    return (
        <div className="flex flex-col gap-2">
            {rows.map((r) => (
                <Link
                    key={r._id}
                    href={`/dashboard/requests/${r._id}`}
                    className="block"
                >
                    <Card className="flex items-center justify-between gap-4 p-4 transition hover:bg-muted/40">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">
                                    {r.title || r.blueprintName || 'Untitled request'}
                                </span>
                                <Badge variant={statusVariant(r.status)}>
                                    {r.status}
                                </Badge>
                                {isBreached(r) ? (
                                    <Badge variant="destructive">SLA breached</Badge>
                                ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {r.blueprintName ?? 'Blueprint'} · stage{' '}
                                {(r.currentStageIdx ?? 0) + 1}
                                {r.currentStage?.name
                                    ? ` (${r.currentStage.name})`
                                    : null}
                                {showApprover && r.currentStage?.approverId
                                    ? ` · approver ${r.currentStage.approverId.slice(0, 6)}…`
                                    : null}
                            </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                            {r.slaDeadlineAt ? (
                                <div>
                                    SLA:{' '}
                                    {new Date(r.slaDeadlineAt).toLocaleString()}
                                </div>
                            ) : null}
                            {r.createdAt ? (
                                <div>
                                    Created:{' '}
                                    {new Date(r.createdAt).toLocaleDateString()}
                                </div>
                            ) : null}
                        </div>
                    </Card>
                </Link>
            ))}
        </div>
    );
}

export function RequestsInbox({ mine, awaiting, blueprints }: Props) {
    const [q, setQ] = React.useState('');
    const [bpFilter, setBpFilter] = React.useState<string>('all');
    const [statusFilter, setStatusFilter] = React.useState<string>('all');
    const [breachedOnly, setBreachedOnly] = React.useState(false);

    const apply = React.useCallback(
        (rows: RequestInstanceDoc[]) => {
            return rows.filter((r) => {
                if (q && !`${r.title} ${r.blueprintName}`.toLowerCase().includes(q.toLowerCase()))
                    return false;
                if (bpFilter !== 'all' && r.blueprintId !== bpFilter) return false;
                if (statusFilter !== 'all' && r.status !== statusFilter) return false;
                if (breachedOnly && !isBreached(r)) return false;
                return true;
            });
        },
        [q, bpFilter, statusFilter, breachedOnly],
    );

    const filteredMine = React.useMemo(() => apply(mine), [apply, mine]);
    const filteredAwaiting = React.useMemo(
        () => apply(awaiting),
        [apply, awaiting],
    );

    return (
        <Card className="p-4">
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <Input
                    placeholder="Search title or blueprint…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="max-w-xs"
                />
                <Select value={bpFilter} onValueChange={setBpFilter}>
                    <ZoruSelectTrigger className="w-48">
                        <ZoruSelectValue placeholder="All blueprints" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="all">All blueprints</ZoruSelectItem>
                        {blueprints.map((b) => (
                            <ZoruSelectItem key={b._id} value={b._id}>
                                {b.name}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <ZoruSelectTrigger className="w-36">
                        <ZoruSelectValue placeholder="Status" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                        <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
                        <ZoruSelectItem value="approved">Approved</ZoruSelectItem>
                        <ZoruSelectItem value="rejected">Rejected</ZoruSelectItem>
                        <ZoruSelectItem value="cancelled">Cancelled</ZoruSelectItem>
                    </ZoruSelectContent>
                </Select>
                <Button
                    variant={breachedOnly ? 'default' : 'outline'}
                    onClick={() => setBreachedOnly((v) => !v)}
                >
                    SLA breached only
                </Button>
            </div>
            <TabsToggle
                mine={filteredMine}
                awaiting={filteredAwaiting}
            />
        </Card>
    );
}
