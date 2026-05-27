'use client';

/**
 * Deal duplicates — `/dashboard/crm/sales-crm/deals/duplicates`.
 *
 * Surfaces clusters of deals matched on (clientId, amount within ±5%,
 * expectedClose within ±7d). KPI strip + status filter + per-cluster
 * survivor-picker that calls `mergeCrmDeals`, plus an Ignore action
 * that hides the cluster from future scans.
 */

import * as React from 'react';
import Link from 'next/link';
import { Copy, GitMerge, RefreshCcw, X } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    RadioGroup,
    ZoruRadioGroupItem,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    Skeleton,
    useZoruToast,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import {
    findCrmDealDuplicates,
    getDealDuplicateResolutions,
    ignoreDealDuplicateCluster,
    mergeCrmDeals,
    type DealDuplicateClusterStatus,
    type DealDuplicateGroup,
    type DealDuplicateResolution,
} from '@/app/actions/crm-deals.actions';

type StatusFilter = 'all' | DealDuplicateClusterStatus;

interface AnnotatedDealGroup extends DealDuplicateGroup {
    signature: string;
    status: DealDuplicateClusterStatus;
    resolvedSurvivorId?: string;
    resolvedMergedIds?: string[];
}

function fmtMoney(value: number, currency = 'INR'): string {
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `${currency} ${value}`;
    }
}

function fmtDate(v?: string | null): string {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function StatCard({ title, value, accent }: { title: string; value: number; accent?: string }) {
    return (
        <Card>
            <p className="text-[13px] font-medium text-zoru-ink-muted">{title}</p>
            <p className="mt-1 text-[28px] font-semibold text-zoru-ink">{value.toLocaleString()}</p>
            {accent ? <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{accent}</p> : null}
        </Card>
    );
}

interface MergePanelProps {
    group: AnnotatedDealGroup;
    onMerged: () => void;
}

function MergePanel({ group, onMerged }: MergePanelProps) {
    const { toast } = useZoruToast();
    const [survivor, setSurvivor] = React.useState<string>(group.members[0]?._id ?? '');
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const [pending, setPending] = React.useState(false);

    const mergedIds = group.members.map((m) => m._id).filter((id) => id !== survivor);

    const handleMerge = async () => {
        if (!survivor || mergedIds.length === 0) return;
        setPending(true);
        try {
            const res = await mergeCrmDeals({
                survivorId: survivor,
                mergedIds,
                signature: group.signature,
            });
            if (res.success) {
                toast({
                    title: 'Deals merged',
                    description: `${res.merged ?? mergedIds.length} duplicate(s) archived into the survivor.`,
                });
                onMerged();
            } else {
                toast({
                    title: 'Merge failed',
                    description: res.error ?? 'Unknown error',
                    variant: 'destructive',
                });
            }
        } finally {
            setPending(false);
            setConfirmOpen(false);
        }
    };

    return (
        <div className="space-y-3 border-t border-zoru-line p-3">
            <p className="text-[12px] font-medium text-zoru-ink">Pick the survivor</p>
            <RadioGroup value={survivor} onValueChange={setSurvivor} className="space-y-2">
                {group.members.map((m) => (
                    <label
                        key={m._id}
                        htmlFor={`survivor-${group.signature}-${m._id}`}
                        className="flex cursor-pointer items-start gap-3 rounded-md border border-zoru-line bg-zoru-surface-2/40 p-2.5 hover:border-primary"
                    >
                        <ZoruRadioGroupItem id={`survivor-${group.signature}-${m._id}`} value={m._id} />
                        <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-zoru-ink">{m.name}</p>
                            <p className="truncate text-[11.5px] text-zoru-ink-muted">
                                {m.stage ?? '—'} · close {fmtDate(m.expectedClose)}
                            </p>
                            <p className="mt-1 font-mono text-[11.5px] text-zoru-ink-muted">
                                {fmtMoney(m.value, m.currency ?? 'INR')}
                            </p>
                        </div>
                    </label>
                ))}
            </RadioGroup>
            <div className="flex items-center justify-end gap-2">
                <Button
                    size="sm"
                    onClick={() => setConfirmOpen(true)}
                    disabled={pending || !survivor || mergedIds.length === 0}
                >
                    <GitMerge className="h-3.5 w-3.5" />
                    Merge {mergedIds.length} into survivor
                </Button>
            </div>
            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Merge duplicate deals?"
                description={`The survivor keeps its identity. ${mergedIds.length} other deal(s) will be archived with a "mergedInto" reference. This cannot be undone automatically.`}
                confirmLabel="Merge"
                confirmTone="primary"
                onConfirm={handleMerge}
            />
        </div>
    );
}

export default function DealDuplicatesPage() {
    const { toast } = useZoruToast();
    const [groups, setGroups] = React.useState<DealDuplicateGroup[]>([]);
    const [resolutions, setResolutions] = React.useState<DealDuplicateResolution[]>([]);
    const [isPending, startTransition] = React.useTransition();
    const [loaded, setLoaded] = React.useState(false);
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');

    const refresh = React.useCallback(() => {
        startTransition(async () => {
            try {
                const [g, r] = await Promise.all([
                    findCrmDealDuplicates(),
                    getDealDuplicateResolutions(),
                ]);
                setGroups(g ?? []);
                setResolutions(r ?? []);
                setLoaded(true);
            } catch (e) {
                toast({
                    title: 'Could not load duplicates',
                    description: e instanceof Error ? e.message : 'Unknown error',
                    variant: 'destructive',
                });
            }
        });
    }, [toast]);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    const annotated = React.useMemo<AnnotatedDealGroup[]>(() => {
        const byId = new Map<string, DealDuplicateResolution>();
        for (const r of resolutions) byId.set(r.signature, r);
        return groups.map((g) => {
            // Cluster signature: stable across rescans. The server-side
            // `findCrmDealDuplicates` synthesises `key` as
            // `<clientId>-<idx>`; the index is non-deterministic across
            // runs, so we re-derive a stable signature from the cluster's
            // member ids.
            const memberIds = [...g.members.map((m) => m._id)].sort();
            const signature = `deal:${memberIds.join('+')}`;
            const r = byId.get(signature);
            return {
                ...g,
                signature,
                status: r?.status ?? 'pending',
                resolvedSurvivorId: r?.survivorId,
                resolvedMergedIds: r?.mergedIds,
            };
        });
    }, [groups, resolutions]);

    const visibleGroups = React.useMemo(() => {
        if (statusFilter === 'all') return annotated;
        return annotated.filter((g) => g.status === statusFilter);
    }, [annotated, statusFilter]);

    const kpis = React.useMemo(() => {
        let pending = 0;
        let ignored = 0;
        let resolved = 0;
        for (const g of annotated) {
            if (g.status === 'ignored') ignored += 1;
            else if (g.status === 'resolved') resolved += 1;
            else pending += 1;
        }
        return { total: annotated.length, pending, ignored, resolved };
    }, [annotated]);

    const handleIgnore = async (signature: string) => {
        const res = await ignoreDealDuplicateCluster(signature);
        if (res.success) {
            toast({ title: 'Cluster ignored', description: 'It will be hidden from future scans.' });
            refresh();
        } else {
            toast({
                title: 'Could not ignore',
                description: res.error ?? 'Unknown error',
                variant: 'destructive',
            });
        }
    };

    return (
        <EntityListShell
            title="Find duplicates"
            subtitle="Possible duplicate deals — same client, similar amount, close-by expected-close dates."
            viewSwitcher={
                <Button variant="outline" size="sm" onClick={refresh} disabled={isPending}>
                    <RefreshCcw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
                    Rescan
                </Button>
            }
            primaryAction={
                <Button asChild variant="outline" size="sm">
                    <Link href="/dashboard/crm/sales-crm/deals">Back to deals</Link>
                </Button>
            }
            empty={
                !isPending && loaded && annotated.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 p-4">
                        <Copy className="h-8 w-8 text-zoru-ink-muted" />
                        <h3 className="text-base font-medium text-zoru-ink">No duplicate clusters</h3>
                        <p className="max-w-sm text-sm text-zoru-ink-muted">
                            Deals are matched when they share a client, have an amount within ±5%,
                            and expected-close dates within ±7 days.
                        </p>
                    </div>
                ) : null
            }
            loading={isPending && groups.length === 0}
        >
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard title="Duplicate clusters" value={kpis.total} accent="Same client, similar amount" />
                <StatCard title="Pending" value={kpis.pending} accent="Awaiting review" />
                <StatCard title="Resolved" value={kpis.resolved} accent="Merged via this page" />
                <StatCard title="Ignored" value={kpis.ignored} accent="Hidden from future scans" />
            </div>

            <Card>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[200px]">
                        <p className="mb-1 text-[12px] font-medium text-zoru-ink">Status</p>
                        <Select
                            value={statusFilter}
                            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                        >
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="All" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All</ZoruSelectItem>
                                <ZoruSelectItem value="pending">Pending</ZoruSelectItem>
                                <ZoruSelectItem value="resolved">Resolved</ZoruSelectItem>
                                <ZoruSelectItem value="ignored">Ignored</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    <p className="text-[12px] text-zoru-ink-muted">
                        Showing {visibleGroups.length} of {annotated.length}
                    </p>
                </div>
            </Card>

            <div className="space-y-4">
                {visibleGroups.map((group) => {
                    const isMerged = group.status === 'resolved';
                    const isIgnored = group.status === 'ignored';
                    return (
                        <Card key={group.signature} className="overflow-hidden p-0">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zoru-line p-3">
                                <h3 className="text-[13px] font-medium text-zoru-ink">
                                    {group.members[0]?.clientLabel || 'Cluster'}
                                </h3>
                                <div className="flex items-center gap-2">
                                    <Badge variant="info">{group.members.length} deals</Badge>
                                    {isMerged ? (
                                        <Badge variant="success">Resolved</Badge>
                                    ) : isIgnored ? (
                                        <Badge variant="ghost">Ignored</Badge>
                                    ) : (
                                        <Badge variant="warning">Pending</Badge>
                                    )}
                                    {!isMerged && !isIgnored ? (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleIgnore(group.signature)}
                                        >
                                            <X className="h-3.5 w-3.5" /> Ignore
                                        </Button>
                                    ) : null}
                                </div>
                            </div>

                            {/* Side-by-side compare */}
                            <div className="grid gap-2 p-3 md:grid-cols-2 lg:grid-cols-3">
                                {group.members.map((m) => {
                                    const isSurvivor = group.resolvedSurvivorId === m._id;
                                    const wasMerged = group.resolvedMergedIds?.includes(m._id);
                                    return (
                                        <div
                                            key={m._id}
                                            className={`flex flex-col gap-1 rounded-md border p-2.5 ${
                                                isSurvivor
                                                    ? 'border-zoru-success/40 bg-zoru-success/5'
                                                    : wasMerged
                                                      ? 'border-zoru-line bg-zoru-surface-2/40 opacity-60'
                                                      : 'border-zoru-line bg-zoru-bg'
                                            }`}
                                        >
                                            <Link
                                                href={`/dashboard/crm/sales-crm/deals/${m._id}`}
                                                className="text-[13px] font-medium text-zoru-ink hover:underline"
                                            >
                                                {m.name}
                                            </Link>
                                            <p className="font-mono text-[11.5px] text-zoru-ink-muted">
                                                {fmtMoney(m.value, m.currency ?? 'INR')}
                                            </p>
                                            <p className="text-[11.5px] text-zoru-ink-muted">
                                                Stage: {m.stage ?? '—'}
                                            </p>
                                            <p className="text-[11.5px] text-zoru-ink-muted">
                                                Close: {fmtDate(m.expectedClose)}
                                            </p>
                                            <p className="text-[11.5px] text-zoru-ink-muted">
                                                Created: {fmtDate(m.createdAt)}
                                            </p>
                                            {isSurvivor ? (
                                                <Badge variant="success" className="mt-1 self-start">
                                                    Survivor
                                                </Badge>
                                            ) : null}
                                            {wasMerged ? (
                                                <Badge variant="ghost" className="mt-1 self-start">
                                                    Merged
                                                </Badge>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>

                            {!isMerged && !isIgnored ? (
                                <MergePanel group={group} onMerged={refresh} />
                            ) : null}
                        </Card>
                    );
                })}

                {isPending && groups.length === 0 ? (
                    <Skeleton className="h-32 w-full" />
                ) : null}
            </div>
        </EntityListShell>
    );
}
