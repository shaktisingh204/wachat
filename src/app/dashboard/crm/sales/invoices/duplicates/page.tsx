'use client';

/**
 * Invoice duplicates — `/dashboard/crm/sales/invoices/duplicates`.
 *
 * Lists clusters of invoices that share a customer + an invoice number OR
 * a near-identical total within ±7 days. Now ships with a side-by-side
 * merge UI: pick the survivor per cluster, the losers are cancelled and
 * tagged with `duplicateOf` via the server action. Multi-tenant — every
 * server action scopes to the current session user.
 */

import * as React from 'react';
import Link from 'next/link';
import {
    AlertTriangle,
    CheckCircle2,
    Copy,
    Layers,
    Loader2,
    RefreshCcw,
    Sparkles,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
    Badge,
    Button,
    Card,
    useZoruToast,
} from '@/components/zoruui';
import { findInvoiceDuplicates, type InvoiceDuplicateGroup } from '@/app/actions/crm/invoices.actions';
import {
    getInvoiceDuplicatesDeepKpis,
    resolveInvoiceDuplicates,
    type InvoiceDuplicatesDeepKpis,
} from '@/app/actions/crm-invoices.actions';

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

const KPI_EMPTY: InvoiceDuplicatesDeepKpis = {
    clusters: 0,
    resolved: 0,
    pending: 0,
    totalDuplicateValue: 0,
};

function KpiTile({
    label,
    value,
    sub,
    icon: Icon,
}: {
    label: string;
    value: string;
    sub?: string;
    icon: React.ElementType;
}): React.JSX.Element {
    return (
        <ZoruCard>
            <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-medium text-zoru-ink-muted">{label}</p>
                <Icon className="h-4 w-4 text-zoru-ink-muted" strokeWidth={1.75} />
            </div>
            <p className="mt-2 truncate text-[22px] font-semibold text-zoru-ink">{value}</p>
            {sub ? <p className="mt-0.5 truncate text-[11.5px] text-zoru-ink-muted">{sub}</p> : null}
        </ZoruCard>
    );
}

type Member = InvoiceDuplicateGroup['members'][number];

function MergeClusterCard({
    group,
    onMerged,
}: {
    group: InvoiceDuplicateGroup;
    onMerged: () => void;
}): React.JSX.Element {
    const { toast } = useZoruToast();
    const [survivorId, setSurvivorId] = React.useState<string>(
        () => group.members[0]?._id ?? '',
    );
    const [confirmOpen, setConfirmOpen] = React.useState(false);
    const [isPending, startTransition] = React.useTransition();

    const survivor = React.useMemo(
        () => group.members.find((m) => m._id === survivorId) ?? group.members[0],
        [group.members, survivorId],
    );
    const losers = React.useMemo(
        () => group.members.filter((m) => m._id !== survivor?._id),
        [group.members, survivor],
    );

    const handleConfirm = (): Promise<void> =>
        new Promise<void>((resolve, reject) => {
            startTransition(async () => {
                try {
                    const res = await resolveInvoiceDuplicates(
                        survivor._id,
                        losers.map((m) => m._id),
                    );
                    if (!res.success) {
                        toast({
                            title: 'Merge failed',
                            description: res.error ?? 'Unknown error',
                            variant: 'destructive',
                        });
                        reject(new Error(res.error ?? 'Merge failed'));
                        return;
                    }
                    toast({
                        title: 'Duplicates resolved',
                        description: `Cancelled ${res.resolved} duplicate invoice(s).`,
                    });
                    onMerged();
                    resolve();
                } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Unknown error';
                    toast({ title: 'Merge failed', description: msg, variant: 'destructive' });
                    reject(e);
                }
            });
        });

    return (
        <ZoruCard className="overflow-hidden p-0">
            <div className="flex items-center justify-between gap-2 border-b border-zoru-line p-3">
                <h3 className="flex items-center gap-2 text-[13px] font-medium text-zoru-ink">
                    <Layers className="h-3.5 w-3.5 text-zoru-ink-muted" />
                    {group.members[0]?.clientId ? (
                        <EntityPickerChip entity="client" id={group.members[0].clientId} />
                    ) : (
                        'Cluster'
                    )}
                    <ZoruBadge variant="outline">{group.members.length} invoices</ZoruBadge>
                </h3>
                <ZoruButton
                    size="sm"
                    variant="default"
                    disabled={isPending || losers.length === 0}
                    onClick={() => setConfirmOpen(true)}
                >
                    {isPending ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Sparkles className="mr-1 h-3.5 w-3.5" />
                    )}
                    Merge {losers.length} into survivor
                </ZoruButton>
            </div>

            <div className="grid grid-cols-1 gap-px bg-zoru-line md:grid-cols-2">
                {group.members.map((m: Member) => {
                    const isSurvivor = m._id === survivor?._id;
                    return (
                        <div
                            key={m._id}
                            className={`flex flex-col gap-2 bg-zoru-surface p-3 ${
                                isSurvivor ? 'ring-2 ring-inset ring-primary' : ''
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <EntityRowLink
                                    href={`/dashboard/crm/sales/invoices/${m._id}`}
                                    label={m.invoiceNo || m._id.slice(-6)}
                                    subtitle={fmtDate(m.date)}
                                />
                                <label className="flex items-center gap-1.5 text-[11.5px] text-zoru-ink-muted">
                                    <input
                                        type="radio"
                                        name={`survivor-${group.key}`}
                                        checked={isSurvivor}
                                        onChange={() => setSurvivorId(m._id)}
                                        className="accent-primary"
                                    />
                                    Keep as survivor
                                </label>
                            </div>

                            <dl className="grid grid-cols-2 gap-1 text-[11.5px]">
                                <dt className="text-zoru-ink-muted">Total</dt>
                                <dd className="text-right font-mono tabular-nums text-zoru-ink">
                                    {fmtMoney(m.total, m.currency ?? 'INR')}
                                </dd>
                                <dt className="text-zoru-ink-muted">Status</dt>
                                <dd className="text-right text-zoru-ink">
                                    {m.status ? (
                                        <ZoruBadge variant="outline">{m.status}</ZoruBadge>
                                    ) : (
                                        '—'
                                    )}
                                </dd>
                            </dl>
                        </div>
                    );
                })}
            </div>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title={`Merge ${losers.length} duplicate invoice(s)?`}
                description={`Survivor ${survivor?.invoiceNo || survivor?._id.slice(-6)} will stay active; ${losers.length} other invoice(s) in this cluster will be cancelled and tagged as duplicates. This cannot be undone in bulk.`}
                confirmLabel="Merge duplicates"
                confirmTone="primary"
                onConfirm={handleConfirm}
            />
        </ZoruCard>
    );
}

export default function InvoiceDuplicatesPage(): React.JSX.Element {
    const { toast } = useZoruToast();
    const [groups, setGroups] = React.useState<InvoiceDuplicateGroup[]>([]);
    const [kpis, setKpis] = React.useState<InvoiceDuplicatesDeepKpis>(KPI_EMPTY);
    const [isPending, startTransition] = React.useTransition();
    const [loaded, setLoaded] = React.useState(false);

    const refresh = React.useCallback(() => {
        startTransition(async () => {
            try {
                const [nextGroups, nextKpis] = await Promise.all([
                    findInvoiceDuplicates(),
                    getInvoiceDuplicatesDeepKpis(),
                ]);
                setGroups(nextGroups ?? []);
                setKpis({
                    ...nextKpis,
                    clusters: nextGroups?.length ?? 0,
                    pending: nextGroups?.length ?? 0,
                });
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

    return (
        <EntityListShell
            title="Find duplicates"
            subtitle="Suspected duplicate invoices — same customer, same invoice number or similar amount within ±7 days."
            viewSwitcher={
                <ZoruButton
                    variant="outline"
                    size="sm"
                    onClick={refresh}
                    disabled={isPending}
                >
                    <RefreshCcw
                        className={['mr-1 h-3.5 w-3.5', isPending ? 'animate-spin' : ''].join(' ')}
                    />
                    Rescan
                </ZoruButton>
            }
            primaryAction={
                <ZoruButton asChild variant="outline" size="sm">
                    <Link href="/dashboard/crm/sales/invoices">Back to invoices</Link>
                </ZoruButton>
            }
        >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <KpiTile
                    label="Open clusters"
                    value={kpis.clusters.toLocaleString('en-IN')}
                    sub="Awaiting review"
                    icon={Layers}
                />
                <KpiTile
                    label="Pending review"
                    value={kpis.pending.toLocaleString('en-IN')}
                    sub="Same as open clusters"
                    icon={AlertTriangle}
                />
                <KpiTile
                    label="Already resolved"
                    value={kpis.resolved.toLocaleString('en-IN')}
                    sub="Cancelled + tagged duplicateOf"
                    icon={CheckCircle2}
                />
                <KpiTile
                    label="Duplicate value"
                    value={fmtMoney(kpis.totalDuplicateValue)}
                    sub="Total ₹ in cancelled duplicates"
                    icon={Copy}
                />
            </div>

            {loaded && groups.length === 0 ? (
                <ZoruCard className="mt-4 p-6">
                    <div className="flex flex-col items-center gap-3 text-center">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                        <h3 className="text-base font-medium text-zoru-ink">No duplicate clusters</h3>
                        <p className="max-w-sm text-[13px] text-zoru-ink-muted">
                            Invoices are matched when they share a customer and either have the
                            same invoice number or have totals within ±1% and an invoice date
                            within ±7 days.
                        </p>
                    </div>
                </ZoruCard>
            ) : (
                <div className="mt-4 space-y-4">
                    {groups.map((group) => (
                        <MergeClusterCard key={group.key} group={group} onMerged={refresh} />
                    ))}
                </div>
            )}
        </EntityListShell>
    );
}
