'use client';

import {
  Badge,
  Button,
  StatCard,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  CheckCircle2,
  Download,
  Edit,
  Handshake,
  PiggyBank,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';

/**
 * Hire list — client island (P1.1B Wave 3 — Purchases rebuild · §1D.1).
 *
 * Upgraded to use spreadsheet-style CrmBulkyGrid and useCrmBulkyState.
 * The Rust BFF for hire hasn't shipped yet, so the server route hands us a
 * pre-hydrated row set.
 *
 * Composition:
 *  - KPI strip (Total · Open · Awarded · Total budget)
 *  - Search across title / category / vendor candidate / owner
 *  - Stage filter
 *  - Bulk select + CSV export
 *  - CrmBulkyGrid (clickable title → detail page)
 *
 * Deferred: bulk delete + inline mutation (need a working hire DTO + a
 * `deleteCrmHire` server action — `crm_purchase_leads` doesn't have one
 * yet). Stage edit is kept as local-state change only.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { EnumFilterField } from '@/components/crm/enum-filter-field';
import { CrmBulkyGrid, type ColumnDef } from '@/components/crm/crm-bulky-grid';
import { useCrmBulkyState } from '@/components/crm/use-crm-bulky-state';

const BASE = '/dashboard/crm/purchases/hire';

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

export interface HireListRow {
    _id: string;
    title?: string;
    category?: string;
    vendorCandidate?: string;
    requiredBy?: string;
    estimatedBudget?: number;
    stage?: string;
    status?: string;
    owner?: string;
    createdAt?: string;
}

interface HireListClientProps {
    rows: HireListRow[];
    error?: string | null;
    newHref: string;
}

function downloadHiresCsv(rows: HireListRow[]): void {
    const header = [
        'Title',
        'Category',
        'Vendor Candidate',
        'Required By',
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

export function HireListClient({ rows, error, newHref }: HireListClientProps) {
    const { toast } = useZoruToast();
    const [search, setSearch] = React.useState('');
    const [stageFilter, setStageFilter] = React.useState<string>('all');

    const bulky = useCrmBulkyState<HireListRow>({
        initialData: rows,
    });

    React.useEffect(() => {
        bulky.setData(rows);
    }, [rows]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return bulky.data.filter((h) => {
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
    }, [bulky.data, search, stageFilter]);

    const kpi = React.useMemo(() => {
        const total = rows.length;
        const open = rows.filter((h) => (h.status ?? 'open') === 'open').length;
        const awarded = rows.filter(
            (h) => (h.stage ?? '').toString() === 'awarded',
        ).length;
        const totalBudget = rows.reduce(
            (acc, h) =>
                acc + (typeof h.estimatedBudget === 'number' ? h.estimatedBudget : 0),
            0,
        );
        return { total, open, awarded, totalBudget };
    }, [rows]);

    const handleSaveInlineEdit = async (id: string, updatedFields: Partial<HireListRow>) => {
        bulky.setData((prev) =>
            prev.map((row) => (row._id === id ? { ...row, ...updatedFields } : row))
        );
        bulky.cancelInlineEdit();
        toast({
            title: 'Stage updated locally',
            description: 'Vendor hire requests require Rust BFF integration for persistent updates.',
        });
    };

    const columns = React.useMemo<ColumnDef<HireListRow>[]>(() => [
        {
            key: 'title',
            header: 'Title',
            sortable: true,
            render: (row) => (
                <EntityRowLink
                    href={`${BASE}/${row._id}`}
                    label={row.title || 'Untitled'}
                    subtitle={row.category || row.vendorCandidate || undefined}
                />
            ),
        },
        {
            key: 'category',
            header: 'Category',
            sortable: true,
            render: (row) => <span className="text-[var(--st-text)]">{row.category || '—'}</span>,
        },
        {
            key: 'vendorCandidate',
            header: 'Vendor candidate',
            sortable: true,
            render: (row) => <span className="text-[var(--st-text)]">{row.vendorCandidate || '—'}</span>,
        },
        {
            key: 'requiredBy',
            header: 'Required by',
            sortable: true,
            render: (row) => <span className="text-[var(--st-text)]">{fmtDate(row.requiredBy)}</span>,
        },
        {
            key: 'estimatedBudget',
            header: 'Budget',
            sortable: true,
            render: (row) => <span className="text-[var(--st-text)]">{fmtMoney(row.estimatedBudget)}</span>,
        },
        {
            key: 'stage',
            header: 'Stage',
            sortable: true,
            render: (row) => {
                const stage = (row.stage ?? 'sourcing').toString();
                const tone = STAGE_TONE[stage] ?? 'neutral';
                return <StatusPill label={stage} tone={tone} />;
            },
            editRender: (row, value, onChange) => (
                <select
                    className="bg-[var(--st-bg-muted)] border border-[var(--st-border)] rounded px-1.5 py-0.5 text-xs text-[var(--st-text)] focus:outline-none"
                    value={value || 'sourcing'}
                    onChange={(e) => onChange(e.target.value)}
                >
                    <option value="sourcing">Sourcing</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="quotes_received">Quotes Received</option>
                    <option value="negotiating">Negotiating</option>
                    <option value="awarded">Awarded</option>
                    <option value="closed">Closed</option>
                    <option value="closed_lost">Closed Lost</option>
                </select>
            ),
        },
        {
            key: 'owner',
            header: 'Owner',
            sortable: true,
            render: (row) => <span className="text-[var(--st-text)]">{row.owner || '—'}</span>,
        },
        {
            key: 'actions',
            header: '',
            render: (row) => (
                <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href={`${BASE}/${row._id}/edit`}>
                            <Edit className="h-4 w-4 text-[var(--st-text-secondary)]" />
                        </Link>
                    </Button>
                </div>
            ),
        },
    ], [toast]);

    return (
        <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                    label="Total requests"
                    value={kpi.total}
                    icon={<Handshake className="h-4 w-4" />}
                />
                <StatCard
                    label="Open"
                    value={kpi.open}
                    icon={<Sparkles className="h-4 w-4" />}
                />
                <StatCard
                    label="Awarded"
                    value={kpi.awarded}
                    icon={<CheckCircle2 className="h-4 w-4" />}
                />
                <StatCard
                    label="Total budget"
                    value={fmtMoney(kpi.totalBudget)}
                    icon={<PiggyBank className="h-4 w-4" />}
                />
            </div>

            <EntityListShell
                title="Vendor Hire & Services"
                subtitle="Track vendor hiring requests, bids, approvals, and onboarding from sourcing to award."
                primaryAction={
                    <Button size="sm" asChild>
                        <Link href={newHref}>
                            <Plus className="h-4 w-4" />
                            New hire request
                        </Link>
                    </Button>
                }
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Search hire requests…',
                }}
                filters={
                    <EnumFilterField
                        enumName="hireStage"
                        value={stageFilter}
                        onChange={(v) => setStageFilter(v)}
                        placeholder="All stages"
                    />
                }
                bulkBar={
                    bulky.selected.size > 0 ? (
                        <div className="flex flex-wrap items-center gap-2 text-[13px]">
                            <span className="font-medium text-[var(--st-text)]">
                                {bulky.selected.size} selected
                            </span>
                            <span className="text-[var(--st-text-secondary)]">·</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                    downloadHiresCsv(
                                        filtered.filter((h) => bulky.selected.has(h._id)),
                                    )
                                }
                            >
                                <Download className="h-3.5 w-3.5" />
                                Export CSV
                            </Button>
                            <span className="ml-auto" />
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={bulky.clearSelection}
                            >
                                <X className="h-3.5 w-3.5" />
                                Clear
                            </Button>
                        </div>
                    ) : null
                }
            >
                <div className="overflow-hidden rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
                    {error ? (
                        <div className="h-24 flex items-center justify-center text-[13px] text-[var(--st-text-secondary)]">
                            {error}
                        </div>
                    ) : (
                        <CrmBulkyGrid<HireListRow>
                            columns={columns}
                            data={filtered}
                            selectedIds={bulky.selected}
                            onSelectOne={(id) => bulky.toggleSelectOne(id)}
                            onSelectAll={(checked) =>
                                bulky.toggleSelectAll(
                                    filtered.map((d) => String(d._id)),
                                    checked
                                )
                            }
                            density="comfortable"
                            inlineEditRowId={bulky.inlineEditRowId}
                            editBuffer={bulky.editBuffer}
                            onStartInlineEdit={bulky.startInlineEdit}
                            onCancelInlineEdit={bulky.cancelInlineEdit}
                            onSaveInlineEdit={handleSaveInlineEdit}
                            onUpdateEditBuffer={bulky.updateEditBuffer}
                        />
                    )}
                </div>
            </EntityListShell>

            {/* TODO §1D.1: bulk-delete + inline mutation actions land once
                `crm_purchase_leads` gets `getCrmHires` + `deleteCrmHire`
                server actions (Rust DTO not shipped — see CRM_REBUILD §1D.5). */}
            <div className="mt-3">
                <Badge variant="ghost" className="text-[11px]">
                    Hire DTO pending Rust BFF — bulk delete deferred
                </Badge>
            </div>
        </>
    );
}

