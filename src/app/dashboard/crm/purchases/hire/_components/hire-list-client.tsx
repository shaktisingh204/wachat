'use client';

/**
 * Hire list — client island.
 *
 * §1D experience over `crmPurchaseLeadsApi` (CRM purchase leads):
 *  - KPI strip (open / in flight / awarded / total budget)
 *  - Search across title / category / vendor candidate / owner
 *  - Stage filter
 *  - Table with edit/delete actions
 *  - Bulk-select + bulk delete + CSV export
 *  - Confirm-delete alert
 */

import * as React from 'react';
import Link from 'next/link';
import {
    CheckCircle2,
    Download,
    Edit,
    LoaderCircle,
    PiggyBank,
    Sparkles,
    Trash2,
    X,
    Handshake,
} from 'lucide-react';

import {
    ZoruAlertDialog,
    ZoruAlertDialogAction,
    ZoruAlertDialogCancel,
    ZoruAlertDialogContent,
    ZoruAlertDialogDescription,
    ZoruAlertDialogFooter,
    ZoruAlertDialogHeader,
    ZoruAlertDialogTitle,
    ZoruButton,
    ZoruCheckbox,
    ZoruSelect,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    ZoruStatCard,
    ZoruTable,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    deleteCrmHire,
    getCrmHires,
    type CrmHireRow,
} from '@/app/actions/crm-hire.actions';

const BASE = '/dashboard/crm/purchases/hire';

const STAGE_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'all', label: 'All stages' },
    { value: 'sourcing', label: 'Sourcing' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'negotiation', label: 'Negotiation' },
    { value: 'awarded', label: 'Awarded' },
    { value: 'closed', label: 'Closed' },
];

const STAGE_TONE: Record<string, StatusTone> = {
    sourcing: 'neutral',
    shortlisted: 'blue',
    negotiation: 'amber',
    awarded: 'green',
    closed: 'neutral',
    closed_lost: 'red',
    quotes_received: 'amber',
    negotiating: 'amber',
};

const inr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

function fmtDate(v: unknown): string {
    if (!v) return '—';
    const d = new Date(v as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtMoney(v: number | undefined): string {
    if (typeof v !== 'number' || Number.isNaN(v)) return '—';
    return inr.format(v);
}

function csvCell(v: unknown): string {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
}

function downloadHiresCsv(rows: CrmHireRow[]): void {
    const header = [
        'Title',
        'Category',
        'Vendor Candidate',
        'Required By',
        'Quantity',
        'Estimated Budget',
        'Stage',
        'Owner',
    ].join(',');
    const lines = rows.map((h) =>
        [
            csvCell(h.title),
            csvCell(h.category),
            csvCell(h.vendorCandidate),
            csvCell(fmtDate(h.requiredBy)),
            csvCell(h.quantity),
            csvCell(h.estimatedBudget),
            csvCell(h.stage),
            csvCell(h.owner),
        ].join(','),
    );
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hire-requests.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function HireListClient() {
    const { toast } = useZoruToast();
    const [hires, setHires] = React.useState<CrmHireRow[]>([]);
    const [isLoading, startLoading] = React.useTransition();
    const [search, setSearch] = React.useState('');
    const [stageFilter, setStageFilter] = React.useState<string>('all');
    const [pendingDelete, setPendingDelete] = React.useState<CrmHireRow | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkDeleting, setBulkDeleting] = React.useState(false);

    const refresh = React.useCallback(() => {
        startLoading(async () => {
            const res = await getCrmHires({ limit: 200 });
            setHires(res.items ?? []);
        });
    }, []);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return hires.filter((h) => {
            if (stageFilter !== 'all' && (h.stage ?? '').toString() !== stageFilter) {
                return false;
            }
            if (!q) return true;
            return (
                (h.title ?? '').toLowerCase().includes(q) ||
                (h.category ?? '').toLowerCase().includes(q) ||
                (h.vendorCandidate ?? '').toLowerCase().includes(q) ||
                (h.owner ?? '').toLowerCase().includes(q)
            );
        });
    }, [hires, search, stageFilter]);

    const kpi = React.useMemo(() => {
        const total = hires.length;
        const open = hires.filter(
            (h) => (h.status ?? 'open') === 'open',
        ).length;
        const awarded = hires.filter(
            (h) => (h.stage ?? '').toString() === 'awarded',
        ).length;
        const totalBudget = hires.reduce(
            (acc, h) => acc + (typeof h.estimatedBudget === 'number' ? h.estimatedBudget : 0),
            0,
        );
        return { total, open, awarded, totalBudget };
    }, [hires]);

    const handleDelete = (id: string) => {
        startDeleteTransition(async () => {
            const res = await deleteCrmHire(id);
            if (res.success) {
                toast({ title: 'Hire request deleted.' });
                setPendingDelete(null);
                setSelected((prev) => {
                    const n = new Set(prev);
                    n.delete(id);
                    return n;
                });
                refresh();
            } else {
                toast({
                    title: 'Error',
                    description: res.error ?? 'Could not delete hire request.',
                    variant: 'destructive',
                });
            }
        });
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selected);
        if (ids.length === 0) return;
        setBulkDeleting(true);
        let ok = 0;
        let failed = 0;
        for (const id of ids) {
            try {
                const r = await deleteCrmHire(id);
                if (r.success) ok += 1;
                else failed += 1;
            } catch {
                failed += 1;
            }
        }
        setBulkDeleting(false);
        setSelected(new Set());
        toast({
            title: 'Bulk delete',
            description: `${ok} removed${failed ? `, ${failed} failed` : ''}.`,
            variant: failed ? 'destructive' : undefined,
        });
        refresh();
    };

    const toggleAll = () => {
        setSelected((prev) =>
            prev.size === filtered.length
                ? new Set()
                : new Set(filtered.map((h) => h._id)),
        );
    };
    const toggleOne = (id: string) => {
        setSelected((prev) => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    };

    return (
        <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <ZoruStatCard
                    label="Total requests"
                    value={kpi.total}
                    icon={<Handshake className="h-4 w-4" />}
                />
                <ZoruStatCard
                    label="Open"
                    value={kpi.open}
                    icon={<Sparkles className="h-4 w-4" />}
                />
                <ZoruStatCard
                    label="Awarded"
                    value={kpi.awarded}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                />
                <ZoruStatCard
                    label="Total budget"
                    value={fmtMoney(kpi.totalBudget)}
                    icon={<PiggyBank className="h-4 w-4" />}
                />
            </div>

            <EntityListShell
                title=""
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Search hire requests…',
                }}
                filters={
                    <ZoruSelect value={stageFilter} onValueChange={setStageFilter}>
                        <ZoruSelectTrigger className="h-9 w-[180px]">
                            <ZoruSelectValue placeholder="Stage" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            {STAGE_OPTIONS.map((o) => (
                                <ZoruSelectItem key={o.value} value={o.value}>
                                    {o.label}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center gap-2 text-[13px]">
                            <span className="font-medium text-zoru-ink">
                                {selected.size} selected
                            </span>
                            <span className="text-zoru-ink-muted">·</span>
                            <ZoruButton
                                variant="ghost"
                                size="sm"
                                disabled={bulkDeleting}
                                onClick={handleBulkDelete}
                            >
                                <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                                Delete
                            </ZoruButton>
                            <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    downloadHiresCsv(
                                        filtered.filter((h) => selected.has(h._id)),
                                    )
                                }
                            >
                                <Download className="h-3.5 w-3.5" />
                                Export CSV
                            </ZoruButton>
                            <span className="ml-auto" />
                            <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelected(new Set())}
                            >
                                <X className="h-3.5 w-3.5" />
                                Clear
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={isLoading && hires.length === 0}
            >
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="w-10">
                                    <ZoruCheckbox
                                        checked={
                                            filtered.length > 0 &&
                                            selected.size === filtered.length
                                        }
                                        onCheckedChange={toggleAll}
                                        aria-label="Select all hire requests"
                                    />
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Category
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Vendor candidate
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Required by
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Budget
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Stage</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Owner</ZoruTableHead>
                                <ZoruTableHead className="text-right text-zoru-ink-muted">
                                    Actions
                                </ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading && hires.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={9} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : filtered.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={9}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        {hires.length === 0
                                            ? 'No hire requests yet. Create one to start tracking vendor sourcing.'
                                            : 'No hire requests match this filter.'}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                filtered.map((h) => {
                                    const stage = (h.stage ?? 'sourcing').toString();
                                    const tone = STAGE_TONE[stage] ?? 'neutral';
                                    return (
                                        <ZoruTableRow key={h._id} className="border-zoru-line">
                                            <ZoruTableCell>
                                                <ZoruCheckbox
                                                    checked={selected.has(h._id)}
                                                    onCheckedChange={() => toggleOne(h._id)}
                                                    aria-label={`Select ${h.title}`}
                                                />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="font-medium text-zoru-ink">
                                                <Link
                                                    href={`${BASE}/${h._id}`}
                                                    className="hover:underline"
                                                >
                                                    {h.title || 'Untitled'}
                                                </Link>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {h.category || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {h.vendorCandidate || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {fmtDate(h.requiredBy)}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {fmtMoney(h.estimatedBudget)}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <StatusPill label={stage} tone={tone} />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {h.owner || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <ZoruButton variant="ghost" size="icon" asChild>
                                                    <Link
                                                        href={`${BASE}/${h._id}/edit`}
                                                        aria-label={`Edit ${h.title}`}
                                                    >
                                                        <Edit className="h-4 w-4 text-zoru-ink-muted" />
                                                    </Link>
                                                </ZoruButton>
                                                <ZoruButton
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setPendingDelete(h)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                                                </ZoruButton>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </EntityListShell>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete hire request?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Are you sure you want to delete &ldquo;{pendingDelete?.title}&rdquo;?
                            This cannot be undone.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={() => pendingDelete && handleDelete(pendingDelete._id)}
                            disabled={deletePending}
                        >
                            {deletePending ? 'Deleting…' : 'Delete'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
