'use client';

/**
 * Pricing rules list — `/dashboard/crm/store/pricing`
 *
 * KPI strip (total, active, draft, expired), filter (status, type,
 * storefront), bulk activate/delete, export CSV, RowDrawer on name.
 */

import * as React from 'react';
import Link from 'next/link';
import { Download, Plus, Tag, Trash2 } from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruCardContent,
    ZoruCheckbox,
    ZoruDropdownMenu,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuTrigger,
    ZoruLabel,
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
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { RowDrawer } from '@/components/crm/row-drawer';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import {
    deletePricingRule,
    getPricingRuleList,
    getStorefrontList,
    savePricingRule,
} from '@/app/actions/crm-store.actions';

type PricingRuleItem = Record<string, unknown>;
type StatusFilter = 'all' | 'active' | 'draft' | 'archived';

function statusVariant(status?: string): 'success' | 'warning' | 'danger' | 'ghost' {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'success';
    if (s === 'archived') return 'danger';
    return 'ghost';
}

function rId(r: PricingRuleItem): string {
    return String(r._id ?? '');
}
function rStatus(r: PricingRuleItem): string {
    return String(r.status ?? 'draft');
}

export default function PricingRulesPage(): React.JSX.Element {
    const { toast } = useZoruToast();

    const [items, setItems] = React.useState<PricingRuleItem[]>([]);
    const [storefronts, setStorefronts] = React.useState<Array<{ id: string; name: string }>>([]);
    const [isPending, startTransition] = React.useTransition();
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [kindFilter, setKindFilter] = React.useState('');
    const [storefrontFilter, setStorefrontFilter] = React.useState('');
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [{ items: rules }, { items: sfList }] = await Promise.all([
                getPricingRuleList(storefrontFilter || undefined),
                getStorefrontList(),
            ]);
            setItems(Array.isArray(rules) ? rules : []);
            setStorefronts(
                (Array.isArray(sfList) ? sfList : []).map((sf) => ({
                    id: String((sf as Record<string, unknown>)._id ?? ''),
                    name: String((sf as Record<string, unknown>).name ?? 'Untitled'),
                })),
            );
        });
    }, [storefrontFilter]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const kinds = React.useMemo(() => {
        const set = new Set<string>();
        for (const r of items) {
            const k = String(r.kind ?? '');
            if (k) set.add(k);
        }
        return Array.from(set).sort();
    }, [items]);

    const kpis = React.useMemo(() => {
        const total = items.length;
        const active = items.filter((r) => rStatus(r) === 'active').length;
        const draft = items.filter((r) => rStatus(r) === 'draft').length;
        const archived = items.filter((r) => rStatus(r) === 'archived').length;
        return { total, active, draft, archived };
    }, [items]);

    const filtered = React.useMemo(() => {
        return items.filter((r) => {
            if (statusFilter !== 'all' && rStatus(r) !== statusFilter) return false;
            if (kindFilter && String(r.kind ?? '') !== kindFilter) return false;
            return true;
        });
    }, [items, statusFilter, kindFilter]);

    const allSelected =
        filtered.length > 0 && filtered.every((r) => selected.has(rId(r)));

    const toggleOne = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const toggleAll = React.useCallback(
        (all: boolean) => {
            setSelected(all ? new Set(filtered.map(rId)) : new Set());
        },
        [filtered],
    );

    const handleBulkActivate = React.useCallback(async () => {
        let ok = 0;
        for (const id of Array.from(selected)) {
            const target = items.find((r) => rId(r) === id);
            if (!target) continue;
            const fd = new FormData();
            fd.set('pricingRuleId', id);
            fd.set('status', 'active');
            fd.set('name', String(target.name ?? ''));
            fd.set('kind', String(target.kind ?? 'percent_off'));
            fd.set('storefrontId', String(target.storefrontId ?? target.storefront_id ?? ''));
            const res = await savePricingRule(undefined, fd);
            if (!res?.error) ok++;
        }
        toast({ title: `${ok} rule(s) activated` });
        setSelected(new Set());
        fetchData();
    }, [selected, items, fetchData, toast]);

    const handleBulkDelete = React.useCallback(async () => {
        let ok = 0;
        for (const id of Array.from(selected)) {
            const res = await deletePricingRule(id);
            if (res.ok) ok++;
        }
        toast({ title: `${ok} rule(s) deleted` });
        setSelected(new Set());
        setBulkDeleteOpen(false);
        fetchData();
    }, [selected, fetchData, toast]);

    const exportCsv = React.useCallback(() => {
        const rows = selected.size > 0 ? filtered.filter((r) => selected.has(rId(r))) : filtered;
        const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            'Name,Kind,Value,Priority,Status',
            ...rows.map((r) =>
                [
                    escape(r.name),
                    escape(r.kind),
                    escape(r.value),
                    escape(r.priority ?? 0),
                    escape(rStatus(r)),
                ].join(','),
            ),
        ].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pricing-rules-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }, [filtered, selected]);

    const newHref = storefrontFilter
        ? `/dashboard/crm/store/pricing/new?storefrontId=${storefrontFilter}`
        : '/dashboard/crm/store/pricing/new';

    const hasActiveFilters = statusFilter !== 'all' || !!kindFilter;

    return (
        <>
            <EntityListShell
                title="Pricing rules"
                subtitle="Discount engine — percent off, fixed off, BXGY and bundles."
                primaryAction={
                    <ZoruButton variant="outline" asChild>
                        <Link href={newHref}>
                            <Plus className="h-4 w-4" /> New rule
                        </Link>
                    </ZoruButton>
                }
                filters={
                    <ZoruCard>
                        <ZoruCardContent className="flex flex-wrap items-end gap-3 pt-4">
                            <div className="min-w-[180px] space-y-1">
                                <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                                    Storefront
                                </ZoruLabel>
                                <ZoruSelect value={storefrontFilter} onValueChange={setStorefrontFilter}>
                                    <ZoruSelectTrigger>
                                        <ZoruSelectValue placeholder="All storefronts" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="">All storefronts</ZoruSelectItem>
                                        {storefronts.map((sf) => (
                                            <ZoruSelectItem key={sf.id} value={sf.id}>
                                                {sf.name}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="min-w-[160px] space-y-1">
                                <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                                    Status
                                </ZoruLabel>
                                <ZoruSelect
                                    value={statusFilter}
                                    onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                                >
                                    <ZoruSelectTrigger>
                                        <ZoruSelectValue placeholder="All" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="all">All</ZoruSelectItem>
                                        <ZoruSelectItem value="active">Active</ZoruSelectItem>
                                        <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                                        <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            {kinds.length > 0 ? (
                                <div className="min-w-[160px] space-y-1">
                                    <ZoruLabel className="text-[11.5px] uppercase tracking-wide text-zoru-ink-subtle">
                                        Type
                                    </ZoruLabel>
                                    <ZoruSelect value={kindFilter} onValueChange={setKindFilter}>
                                        <ZoruSelectTrigger>
                                            <ZoruSelectValue placeholder="All types" />
                                        </ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            <ZoruSelectItem value="">All types</ZoruSelectItem>
                                            {kinds.map((k) => (
                                                <ZoruSelectItem key={k} value={k}>
                                                    {k}
                                                </ZoruSelectItem>
                                            ))}
                                        </ZoruSelectContent>
                                    </ZoruSelect>
                                </div>
                            ) : null}
                            {hasActiveFilters ? (
                                <ZoruButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setStatusFilter('all');
                                        setKindFilter('');
                                    }}
                                >
                                    Clear filters
                                </ZoruButton>
                            ) : null}
                        </ZoruCardContent>
                    </ZoruCard>
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-zoru-ink">{selected.size} selected</span>
                            <span className="flex-1" />
                            <ZoruButton size="sm" variant="outline" onClick={handleBulkActivate}>
                                Activate
                            </ZoruButton>
                            <ZoruDropdownMenu>
                                <ZoruDropdownMenuTrigger asChild>
                                    <ZoruButton size="sm" variant="outline">
                                        <Download className="h-3.5 w-3.5" /> Export
                                    </ZoruButton>
                                </ZoruDropdownMenuTrigger>
                                <ZoruDropdownMenuContent align="end">
                                    <ZoruDropdownMenuItem onClick={exportCsv}>Export as CSV</ZoruDropdownMenuItem>
                                </ZoruDropdownMenuContent>
                            </ZoruDropdownMenu>
                            <ZoruButton size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                            </ZoruButton>
                            <ZoruButton size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                                Clear
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={isPending && items.length === 0}
                empty={
                    !isPending && filtered.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-8">
                            <Tag className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">No pricing rules found</h3>
                            <ZoruButton variant="outline" asChild>
                                <Link href={newHref}>
                                    <Plus className="h-4 w-4" /> New rule
                                </Link>
                            </ZoruButton>
                        </div>
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    {/* KPI strip */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <ZoruStatCard label="Total rules" value={kpis.total.toLocaleString()} icon={<Tag />} />
                        <ZoruStatCard label="Active" value={kpis.active.toLocaleString()} icon={<Tag />} period="live discounts" />
                        <ZoruStatCard label="Draft" value={kpis.draft.toLocaleString()} icon={<Tag />} period="not scheduled" />
                        <ZoruStatCard label="Archived" value={kpis.archived.toLocaleString()} icon={<Tag />} period="expired / removed" />
                    </div>

                    {filtered.length > 0 ? (
                        <ZoruCard className="overflow-hidden p-0">
                            <ZoruTable>
                                <ZoruTableHeader>
                                    <ZoruTableRow>
                                        <ZoruTableHead className="w-10">
                                            <ZoruCheckbox
                                                aria-label="Select all"
                                                checked={allSelected}
                                                onCheckedChange={(c) => toggleAll(c === true)}
                                            />
                                        </ZoruTableHead>
                                        <ZoruTableHead>Name</ZoruTableHead>
                                        <ZoruTableHead>Kind</ZoruTableHead>
                                        <ZoruTableHead>Value</ZoruTableHead>
                                        <ZoruTableHead>Priority</ZoruTableHead>
                                        <ZoruTableHead>Status</ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {filtered.map((r) => {
                                        const id = rId(r);
                                        const status = rStatus(r);
                                        return (
                                            <ZoruTableRow
                                                key={id}
                                                data-state={selected.has(id) ? 'selected' : undefined}
                                            >
                                                <ZoruTableCell>
                                                    <ZoruCheckbox
                                                        aria-label={`Select ${String(r.name ?? '')}`}
                                                        checked={selected.has(id)}
                                                        onCheckedChange={() => toggleOne(id)}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <RowDrawer
                                                        label={String(r.name ?? 'Untitled')}
                                                        subtitle={String(r.kind ?? '')}
                                                        title={`Rule: ${String(r.name ?? '')}`}
                                                        description="View and edit this pricing rule's details."
                                                    >
                                                        <EntityRowLink
                                                            href={`/dashboard/crm/store/pricing/${id}`}
                                                            label={String(r.name ?? 'Untitled')}
                                                            subtitle={String(r.kind ?? '')}
                                                        />
                                                    </RowDrawer>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {String(r.kind ?? '—')}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {String(r.value ?? '—')}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {String(r.priority ?? 0)}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <ZoruBadge variant={statusVariant(status)}>{status}</ZoruBadge>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })}
                                </ZoruTableBody>
                            </ZoruTable>
                        </ZoruCard>
                    ) : null}
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={setBulkDeleteOpen}
                title={`Delete ${selected.size} rule${selected.size === 1 ? '' : 's'}?`}
                description="This permanently removes the selected pricing rules. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleBulkDelete}
            />
        </>
    );
}
