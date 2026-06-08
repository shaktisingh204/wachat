'use client';

/**
 * Tabbed inbox: "Awaiting my approval" + "My requests".
 *
 * Filters by blueprint, status, and SLA breach in memory over the lists handed
 * in from the server page (small in practice — about 50 rows per tab). A request
 * row links through to its detail view.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, AlertTriangle } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    EmptyState,
    SearchInput,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Tabs,
    Table,
    THead,
    TBody,
    Tr,
    Th,
    Td,
    type BadgeTone,
} from '@/components/sabcrm/20ui';
import type { RequestBlueprintDoc } from '@/lib/rust-client/sabrequests-blueprints';
import type { RequestInstanceDoc } from '@/lib/rust-client/sabrequests-instances';

interface Props {
    mine: RequestInstanceDoc[];
    awaiting: RequestInstanceDoc[];
    blueprints: RequestBlueprintDoc[];
}

function statusTone(s?: string): BadgeTone {
    switch (s) {
        case 'approved':
            return 'success';
        case 'rejected':
            return 'danger';
        case 'cancelled':
            return 'neutral';
        case 'pending':
            return 'warning';
        default:
            return 'neutral';
    }
}

function isBreached(r: RequestInstanceDoc): boolean {
    if (r.breachedAt) return true;
    if (r.status !== 'pending' || !r.slaDeadlineAt) return false;
    return new Date(r.slaDeadlineAt).getTime() < Date.now();
}

function RequestTable({
    rows,
    showApprover,
}: {
    rows: RequestInstanceDoc[];
    showApprover: boolean;
}) {
    const router = useRouter();

    if (rows.length === 0) {
        return (
            <EmptyState
                icon={Inbox}
                title="Nothing here yet"
                description="Requests that match your filters will show up in this list."
            />
        );
    }

    return (
        <Table hover>
            <THead>
                <Tr>
                    <Th>Request</Th>
                    <Th>Status</Th>
                    <Th>Stage</Th>
                    {showApprover ? <Th>Approver</Th> : null}
                    <Th align="right">SLA</Th>
                    <Th align="right">Created</Th>
                </Tr>
            </THead>
            <TBody>
                {rows.map((r) => {
                    const breached = isBreached(r);
                    return (
                        <Tr
                            key={r._id}
                            onClick={() =>
                                router.push(`/dashboard/sabrequests/${r._id}`)
                            }
                            className="cursor-pointer"
                        >
                            <Td>
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-medium text-[var(--st-text)]">
                                        {r.title || r.blueprintName || 'Untitled request'}
                                    </span>
                                    <span className="text-xs text-[var(--st-text-secondary)]">
                                        {r.blueprintName ?? 'Blueprint'}
                                    </span>
                                </div>
                            </Td>
                            <Td>
                                <div className="flex items-center gap-1.5">
                                    <Badge tone={statusTone(r.status)}>
                                        {r.status ?? 'unknown'}
                                    </Badge>
                                    {breached ? (
                                        <Badge tone="danger" kind="soft" dot>
                                            SLA breached
                                        </Badge>
                                    ) : null}
                                </div>
                            </Td>
                            <Td>
                                <span className="text-[var(--st-text-secondary)]">
                                    Stage {(r.currentStageIdx ?? 0) + 1}
                                    {r.currentStage?.name
                                        ? ` · ${r.currentStage.name}`
                                        : ''}
                                </span>
                            </Td>
                            {showApprover ? (
                                <Td>
                                    <span className="text-[var(--st-text-secondary)]">
                                        {r.currentStage?.approverId
                                            ? `${r.currentStage.approverId.slice(0, 6)}…`
                                            : '—'}
                                    </span>
                                </Td>
                            ) : null}
                            <Td align="right">
                                <span
                                    className={[
                                        'tabular-nums',
                                        breached
                                            ? 'text-[var(--st-danger)]'
                                            : 'text-[var(--st-text-secondary)]',
                                    ].join(' ')}
                                >
                                    {r.slaDeadlineAt
                                        ? new Date(r.slaDeadlineAt).toLocaleDateString()
                                        : '—'}
                                </span>
                            </Td>
                            <Td align="right">
                                <span className="tabular-nums text-[var(--st-text-secondary)]">
                                    {r.createdAt
                                        ? new Date(r.createdAt).toLocaleDateString()
                                        : '—'}
                                </span>
                            </Td>
                        </Tr>
                    );
                })}
            </TBody>
        </Table>
    );
}

export function RequestsInbox({ mine, awaiting, blueprints }: Props) {
    const [tab, setTab] = React.useState<'awaiting' | 'mine'>('awaiting');
    const [q, setQ] = React.useState('');
    const [bpFilter, setBpFilter] = React.useState<string>('all');
    const [statusFilter, setStatusFilter] = React.useState<string>('all');
    const [breachedOnly, setBreachedOnly] = React.useState(false);

    const apply = React.useCallback(
        (rows: RequestInstanceDoc[]) =>
            rows.filter((r) => {
                if (
                    q &&
                    !`${r.title ?? ''} ${r.blueprintName ?? ''}`
                        .toLowerCase()
                        .includes(q.toLowerCase())
                )
                    return false;
                if (bpFilter !== 'all' && r.blueprintId !== bpFilter) return false;
                if (statusFilter !== 'all' && r.status !== statusFilter) return false;
                if (breachedOnly && !isBreached(r)) return false;
                return true;
            }),
        [q, bpFilter, statusFilter, breachedOnly],
    );

    const filteredMine = React.useMemo(() => apply(mine), [apply, mine]);
    const filteredAwaiting = React.useMemo(() => apply(awaiting), [apply, awaiting]);

    const breachedCount = React.useMemo(
        () => [...mine, ...awaiting].filter(isBreached).length,
        [mine, awaiting],
    );

    return (
        <Card padding="md" className="flex flex-col gap-4">
            <Tabs
                value={tab}
                onChange={(v) => setTab(v as 'awaiting' | 'mine')}
                items={[
                    {
                        value: 'awaiting',
                        label: 'Awaiting my approval',
                        badge: awaiting.length,
                    },
                    { value: 'mine', label: 'My requests', badge: mine.length },
                ]}
            />

            <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                    value={q}
                    onValueChange={setQ}
                    placeholder="Search title or blueprint"
                    className="max-w-xs"
                />
                <Select value={bpFilter} onValueChange={setBpFilter}>
                    <SelectTrigger className="w-48" aria-label="Filter by blueprint">
                        <SelectValue placeholder="All blueprints" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All blueprints</SelectItem>
                        {blueprints.map((b) => (
                            <SelectItem key={b._id} value={b._id}>
                                {b.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40" aria-label="Filter by status">
                        <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                </Select>
                <Button
                    variant={breachedOnly ? 'danger' : 'outline'}
                    iconLeft={AlertTriangle}
                    onClick={() => setBreachedOnly((v) => !v)}
                    aria-pressed={breachedOnly}
                >
                    SLA breached{breachedCount ? ` (${breachedCount})` : ''}
                </Button>
            </div>

            {tab === 'awaiting' ? (
                <RequestTable rows={filteredAwaiting} showApprover={false} />
            ) : (
                <RequestTable rows={filteredMine} showApprover />
            )}
        </Card>
    );
}
