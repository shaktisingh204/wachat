'use client';

import {
  ZoruBadge,
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
} from '@/components/zoruui';
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
 * Lifted onto the canonical `<EntityListShell>`. The Rust BFF for hire
 * hasn't shipped yet, so the server route hands us a pre-hydrated row
 * set (no client-side fetch — async-parallel best practice: the
 * page-level server component fetched everything).
 *
 * Composition:
 *  - KPI strip (Total · Open · Awarded · Total budget)
 *  - Search across title / category / vendor candidate / owner
 *  - Stage filter
 *  - Bulk select + CSV export
 *  - Table (clickable title → detail page)
 *
 * Deferred: bulk delete + inline mutation (need a working hire DTO + a
 * `deleteCrmHire` server action — `crm_purchase_leads` doesn't have one
 * yet). Marked with TODO so it's clear.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

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
    const [search, setSearch] = React.useState('');
    const [stageFilter, setStageFilter] = React.useState<string>('all');
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((h) => {
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
    }, [rows, search, stageFilter]);

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
                title="Vendor Hire & Services"
                subtitle="Track vendor hiring requests, bids, approvals, and onboarding from sourcing to award."
                primaryAction={
                    <ZoruButton size="sm" asChild>
                        <Link href={newHref}>
                            <Plus className="h-4 w-4" />
                            New hire request
                        </Link>
                    </ZoruButton>
                }
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Search hire requests…',
                }}
                filters={
                    <ZoruSelect
                        value={stageFilter}
                        onValueChange={setStageFilter}
                    >
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
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Title
                                </ZoruTableHead>
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
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Stage
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">
                                    Owner
                                </ZoruTableHead>
                                <ZoruTableHead className="text-right text-zoru-ink-muted">
                                    Actions
                                </ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {error ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={9}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        {error}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : filtered.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell
                                        colSpan={9}
                                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                    >
                                        {rows.length === 0
                                            ? 'No hire requests yet. Create one to start tracking vendor sourcing.'
                                            : 'No hire requests match this filter.'}
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                filtered.map((h) => {
                                    const stage = (h.stage ?? 'sourcing').toString();
                                    const tone = STAGE_TONE[stage] ?? 'neutral';
                                    return (
                                        <ZoruTableRow
                                            key={h._id}
                                            className="border-zoru-line"
                                        >
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
                                                <ZoruButton
                                                    variant="ghost"
                                                    size="icon"
                                                    asChild
                                                >
                                                    <Link
                                                        href={`${BASE}/${h._id}/edit`}
                                                        aria-label={`Edit ${h.title}`}
                                                    >
                                                        <Edit className="h-4 w-4 text-zoru-ink-muted" />
                                                    </Link>
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

            {/* TODO §1D.1: bulk-delete + inline mutation actions land once
                `crm_purchase_leads` gets `getCrmHires` + `deleteCrmHire`
                server actions (Rust DTO not shipped — see CRM_REBUILD §1D.5). */}
            <ZoruBadge variant="ghost" className="text-[11px]">
                Hire DTO pending Rust BFF — bulk delete deferred
            </ZoruBadge>
        </>
    );
}
