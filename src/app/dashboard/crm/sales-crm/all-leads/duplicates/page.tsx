'use client';

/**
 * Lead duplicates — clusters of leads sharing the same (normalised)
 * email or phone within the current tenant. Surfaces a KPI strip, a
 * status filter, and per-cluster bulk-merge UX (pick a survivor,
 * merge the rest) plus an "Ignore" action that hides the cluster on
 * subsequent scans.
 */

import * as React from 'react';
import Link from 'next/link';
import { Copy, GitMerge, Mail, Phone, RefreshCcw, X } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruRadioGroup,
    ZoruRadioGroupItem,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruSkeleton,
    useZoruToast,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import {
    findCrmLeadDuplicates,
    getLeadDuplicateResolutions,
    ignoreLeadDuplicateCluster,
    mergeCrmLeads,
    type DuplicateClusterStatus,
    type DuplicateGroup,
    type DuplicateLeadEntry,
    type DuplicateClusterResolution,
} from '@/app/actions/crm-leads.actions';
import { leadDuplicateSignature } from '@/lib/crm/lead-utils';

type StatusFilter = 'all' | DuplicateClusterStatus;

interface AnnotatedGroup extends DuplicateGroup {
    signature: string;
    status: DuplicateClusterStatus;
    resolvedSurvivorId?: string;
    resolvedMergedIds?: string[];
}

function formatMoney(value: number | undefined, currency: string | undefined): string {
    const ccy = currency || 'INR';
    try {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: ccy,
            maximumFractionDigits: 0,
        }).format(value ?? 0);
    } catch {
        return `${ccy} ${(value ?? 0).toLocaleString('en-IN')}`;
    }
}

function StatCard({ title, value, accent }: { title: string; value: number; accent?: string }) {
    return (
        <ZoruCard>
            <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 text-[28px] font-semibold text-foreground">{value.toLocaleString()}</p>
            {accent ? <p className="mt-1 text-[11.5px] text-muted-foreground">{accent}</p> : null}
        </ZoruCard>
    );
}

interface MergePanelProps {
    group: AnnotatedGroup;
    onMerged: () => void;
}

function MergePanel({ group, onMerged }: MergePanelProps) {
    const { toast } = useZoruToast();
    const [survivor, setSurvivor] = React.useState<string>(group.leads[0]?._id ?? '');
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const [pending, setPending] = React.useState(false);

    const mergedIds = group.leads.map((l) => l._id).filter((id) => id !== survivor);

    const handleMerge = async () => {
        if (!survivor || mergedIds.length === 0) return;
        setPending(true);
        try {
            const res = await mergeCrmLeads({
                survivorId: survivor,
                mergedIds,
                signature: group.signature,
            });
            if (res.success) {
                toast({
                    title: 'Leads merged',
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
        <div className="space-y-3 border-t border-border p-3">
            <p className="text-[12px] font-medium text-foreground">Pick the survivor</p>
            <ZoruRadioGroup value={survivor} onValueChange={setSurvivor} className="space-y-2">
                {group.leads.map((lead) => (
                    <label
                        key={lead._id}
                        htmlFor={`survivor-${group.signature}-${lead._id}`}
                        className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-secondary/40 p-2.5 hover:border-primary"
                    >
                        <ZoruRadioGroupItem id={`survivor-${group.signature}-${lead._id}`} value={lead._id} />
                        <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-medium text-foreground">
                                {lead.title || lead.contactName || 'Untitled'}
                            </p>
                            <p className="truncate text-[11.5px] text-muted-foreground">
                                {lead.contactName ?? ''}
                                {lead.company ? ` · ${lead.company}` : ''}
                            </p>
                            <p className="mt-1 font-mono text-[11.5px] text-muted-foreground">
                                {formatMoney(lead.value, lead.currency)}
                            </p>
                        </div>
                    </label>
                ))}
            </ZoruRadioGroup>
            <div className="flex items-center justify-end gap-2">
                <ZoruButton
                    size="sm"
                    onClick={() => setConfirmOpen(true)}
                    disabled={pending || !survivor || mergedIds.length === 0}
                >
                    <GitMerge className="h-3.5 w-3.5" />
                    Merge {mergedIds.length} into survivor
                </ZoruButton>
            </div>
            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Merge duplicate leads?"
                description={`The survivor will keep its identity. ${mergedIds.length} other lead(s) will be archived with a "mergedInto" reference. This cannot be undone automatically.`}
                confirmLabel="Merge"
                confirmTone="primary"
                onConfirm={handleMerge}
            />
        </div>
    );
}

export default function LeadDuplicatesPage() {
    const { toast } = useZoruToast();
    const [groups, setGroups] = React.useState<DuplicateGroup[]>([]);
    const [resolutions, setResolutions] = React.useState<DuplicateClusterResolution[]>([]);
    const [isPending, startTransition] = React.useTransition();
    const [loaded, setLoaded] = React.useState(false);
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');

    const refresh = React.useCallback(() => {
        startTransition(async () => {
            try {
                const [g, r] = await Promise.all([
                    findCrmLeadDuplicates(),
                    getLeadDuplicateResolutions(),
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

    /* ─── Derived ───────────────────────────────────────────────────── */

    const annotated = React.useMemo<AnnotatedGroup[]>(() => {
        const byId = new Map<string, DuplicateClusterResolution>();
        for (const r of resolutions) byId.set(r.signature, r);
        return groups.map((g) => {
            const signature = leadDuplicateSignature(g.key, g.value);
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

    /* ─── Actions ──────────────────────────────────────────────────── */

    const handleIgnore = async (signature: string) => {
        const res = await ignoreLeadDuplicateCluster(signature);
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

    /* ─── Render ───────────────────────────────────────────────────── */

    return (
        <EntityListShell
            title="Find duplicates"
            subtitle="Leads sharing the same email or phone within your tenant."
            viewSwitcher={
                <ZoruButton variant="outline" size="sm" onClick={refresh} disabled={isPending}>
                    <RefreshCcw
                        className={`h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`}
                    />
                    Rescan
                </ZoruButton>
            }
            primaryAction={
                <ZoruButton asChild variant="outline" size="sm">
                    <Link href="/dashboard/crm/sales-crm/all-leads">Back to leads</Link>
                </ZoruButton>
            }
            empty={
                !isPending && loaded && annotated.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 p-4">
                        <Copy className="h-8 w-8 text-zoru-ink-muted" />
                        <h3 className="text-base font-medium text-zoru-ink">No duplicates found</h3>
                        <p className="max-w-sm text-sm text-zoru-ink-muted">
                            Every lead in your tenant has a unique email and phone (or those fields
                            are blank). Nice job keeping the pipeline tidy.
                        </p>
                    </div>
                ) : null
            }
            loading={isPending && groups.length === 0}
        >
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard title="Duplicate clusters" value={kpis.total} accent="Across email + phone" />
                <StatCard title="Pending" value={kpis.pending} accent="Awaiting review" />
                <StatCard title="Resolved" value={kpis.resolved} accent="Merged via this page" />
                <StatCard title="Ignored" value={kpis.ignored} accent="Hidden from future scans" />
            </div>

            <ZoruCard>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[200px]">
                        <p className="mb-1 text-[12px] font-medium text-foreground">Status</p>
                        <ZoruSelect
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
                        </ZoruSelect>
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                        Showing {visibleGroups.length} of {annotated.length}
                    </p>
                </div>
            </ZoruCard>

            <div className="flex flex-col gap-3">
                {visibleGroups.map((group) => {
                    const isMerged = group.status === 'resolved';
                    const isIgnored = group.status === 'ignored';
                    return (
                        <ZoruCard key={group.signature} className="overflow-hidden p-0">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
                                <span className="inline-flex items-center gap-2 text-[14px]">
                                    {group.key === 'email' ? (
                                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                                    ) : (
                                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                    <span className="truncate font-mono">{group.value}</span>
                                </span>
                                <div className="flex items-center gap-2">
                                    <ZoruBadge variant="info">
                                        {group.leads.length} match{group.leads.length === 1 ? '' : 'es'}
                                    </ZoruBadge>
                                    {isMerged ? (
                                        <ZoruBadge variant="success">Resolved</ZoruBadge>
                                    ) : isIgnored ? (
                                        <ZoruBadge variant="ghost">Ignored</ZoruBadge>
                                    ) : (
                                        <ZoruBadge variant="warning">Pending</ZoruBadge>
                                    )}
                                    {!isMerged && !isIgnored ? (
                                        <ZoruButton
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleIgnore(group.signature)}
                                        >
                                            <X className="h-3.5 w-3.5" /> Ignore
                                        </ZoruButton>
                                    ) : null}
                                </div>
                            </div>

                            {/* Side-by-side compare */}
                            <div className="grid gap-2 p-3 md:grid-cols-2 lg:grid-cols-3">
                                {group.leads.map((lead: DuplicateLeadEntry) => {
                                    const status = lead.status ?? 'New';
                                    const isSurvivor = group.resolvedSurvivorId === lead._id;
                                    const wasMerged = group.resolvedMergedIds?.includes(lead._id);
                                    return (
                                        <div
                                            key={lead._id}
                                            className={`flex flex-col gap-1 rounded-md border p-2.5 ${
                                                isSurvivor
                                                    ? 'border-zoru-success/40 bg-zoru-success/5'
                                                    : wasMerged
                                                      ? 'border-border bg-secondary/40 opacity-60'
                                                      : 'border-border bg-zoru-bg'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <Link
                                                    href={`/dashboard/crm/sales-crm/all-leads/${lead._id}`}
                                                    className="text-[13px] font-medium text-foreground hover:underline"
                                                >
                                                    {lead.title || lead.contactName || 'Untitled'}
                                                </Link>
                                                <StatusPill label={status} tone={statusToTone(status)} />
                                            </div>
                                            <p className="truncate text-[11.5px] text-muted-foreground">
                                                {lead.contactName}
                                                {lead.company ? ` · ${lead.company}` : ''}
                                            </p>
                                            <p className="truncate font-mono text-[11.5px] text-muted-foreground">
                                                {lead.email ?? '—'} · {lead.phone ?? '—'}
                                            </p>
                                            <p className="text-[11.5px] text-muted-foreground">
                                                Value: {formatMoney(lead.value, lead.currency)}
                                            </p>
                                            {isSurvivor ? (
                                                <ZoruBadge variant="success" className="mt-1 self-start">
                                                    Survivor
                                                </ZoruBadge>
                                            ) : null}
                                            {wasMerged ? (
                                                <ZoruBadge variant="ghost" className="mt-1 self-start">
                                                    Merged
                                                </ZoruBadge>
                                            ) : null}
                                        </div>
                                    );
                                })}
                            </div>

                            {!isMerged && !isIgnored ? (
                                <MergePanel group={group} onMerged={refresh} />
                            ) : null}
                        </ZoruCard>
                    );
                })}

                {isPending && groups.length === 0 ? (
                    <ZoruSkeleton className="h-32 w-full" />
                ) : null}
            </div>
        </EntityListShell>
    );
}
