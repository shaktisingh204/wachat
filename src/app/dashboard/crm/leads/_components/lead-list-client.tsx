'use client';

import {
    ZoruAlertDialog,
    ZoruAlertDialogAction,
    ZoruAlertDialogCancel,
    ZoruAlertDialogContent,
    ZoruAlertDialogDescription,
    ZoruAlertDialogFooter,
    ZoruAlertDialogHeader,
    ZoruAlertDialogTitle,
    Badge,
    Button,
    Card,
    Checkbox,
    Input,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    StatCard,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/zoruui';
import {
    useRouter,
    useSearchParams,
    usePathname,
} from 'next/navigation';
import {
    AlertCircle,
    CalendarClock,
    Download,
    ListChecks,
    LoaderCircle,
    Pencil,
    Search,
    TrendingUp,
    Trash2,
    Users,
    X,
} from 'lucide-react';

/**
 * Leads list client — upgraded with KPI strip, status + source
 * filters, bulk-select / bulk-delete, and CSV export.
 *
 * Search is URL-driven (debounced write-back) so the server component
 * re-fetches from Rust. Status and source filters run client-side over
 * the loaded page. KPIs are computed from the page data.
 */

import * as React from 'react';
import Link from 'next/link';

import { PaginationBar } from '@/components/crm/pagination-bar';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { SavedViewsBar } from '@/components/crm/SavedViewsBar';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';
import { deleteLeadAction } from '@/app/actions/crm/leads.actions';
import { useT } from '@/lib/i18n/client';
import type { CrmLeadDoc } from '@/lib/rust-client/crm-leads';
import type { SavedView } from '@/lib/saved-views/types';

interface LeadListClientProps {
    leads: CrmLeadDoc[];
    page: number;
    limit: number;
    hasMore: boolean;
    initialQuery: string;
    error?: string;
}

function fullName(l: CrmLeadDoc, fallback: string): string {
    return (
        [l.firstName, l.lastName].filter(Boolean).join(' ') ||
        l.email ||
        fallback
    );
}

function fmtMoney(
    value: number | undefined,
    currency: string | undefined,
    locale: string,
): string {
    if (typeof value !== 'number') return '—';
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency || 'INR',
            maximumFractionDigits: 0,
        }).format(value);
    } catch {
        return `${currency || 'INR'} ${value}`;
    }
}

function fmtDate(v: string | undefined, locale: string): string {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(locale);
}

/* ─── KPI computation from page data ───────────────────────────────────── */

interface LeadPageKpis {
    total: number;
    withValue: number;
    totalValue: number;
    addedThisMonth: number;
}

function computeLeadKpis(leads: CrmLeadDoc[]): LeadPageKpis {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    let withValue = 0;
    let totalValue = 0;
    let addedThisMonth = 0;
    for (const l of leads) {
        if (typeof l.estimatedValue === 'number' && l.estimatedValue > 0) {
            withValue++;
            totalValue += l.estimatedValue;
        }
        const created = l.createdAt || l.audit?.createdAt;
        if (
            created &&
            new Date(created).getTime() >= startOfMonth.getTime()
        ) {
            addedThisMonth++;
        }
    }
    return { total: leads.length, withValue, totalValue, addedThisMonth };
}

export function LeadListClient({
    leads,
    page,
    limit,
    hasMore,
    initialQuery,
    error,
}: LeadListClientProps) {
    const { toast } = useZoruToast();
    const { t, locale } = useT();
    const router = useRouter();
    const pathname = usePathname();
    const sp = useSearchParams();
    const unnamedLabel = t('crm.leads.list.unnamed');

    /* ─── Search (URL-driven) ──────────────────────────────────── */
    const [query, setQuery] = React.useState(initialQuery);

    React.useEffect(() => {
        if (query === initialQuery) return;
        const handle = setTimeout(() => {
            const params = new URLSearchParams(sp?.toString() ?? '');
            if (query.trim()) params.set('q', query.trim());
            else params.delete('q');
            params.set('page', '1');
            const qs = params.toString();
            router.push(qs ? `${pathname}?${qs}` : pathname);
        }, 300);
        return () => clearTimeout(handle);
    }, [query, initialQuery, sp, pathname, router]);

    /* ─── Client-side filters ──────────────────────────────────── */
    const [statusFilter, setStatusFilter] = React.useState<'all' | string>(
        'all',
    );
    const [sourceFilter, setSourceFilter] = React.useState<'all' | string>(
        'all',
    );

    const statusOptions = React.useMemo(() => {
        const s = new Set<string>();
        for (const l of leads) {
            if (l.status?.name) s.add(l.status.name);
        }
        return Array.from(s).sort();
    }, [leads]);

    const sourceOptions = React.useMemo(() => {
        const s = new Set<string>();
        for (const l of leads) {
            const src = l.attribution?.source || l.subSource;
            if (src) s.add(src);
        }
        return Array.from(s).sort();
    }, [leads]);

    const filtered = React.useMemo(() => {
        return leads.filter((l) => {
            if (statusFilter !== 'all' && l.status?.name !== statusFilter)
                return false;
            const src = l.attribution?.source || l.subSource;
            if (sourceFilter !== 'all' && src !== sourceFilter) return false;
            return true;
        });
    }, [leads, statusFilter, sourceFilter]);

    const hasActiveFilters =
        statusFilter !== 'all' || sourceFilter !== 'all';

    const clearFilters = () => {
        setStatusFilter('all');
        setSourceFilter('all');
    };

    /* ─── KPIs ─────────────────────────────────────────────────── */
    const kpis = React.useMemo(() => computeLeadKpis(leads), [leads]);

    /* ─── Bulk selection ────────────────────────────────────────── */
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [pendingDelete, setPendingDelete] =
        React.useState<CrmLeadDoc | null>(null);
    const [deleting, startDelete] = React.useTransition();
    const [bulkDeleting, startBulkDelete] = React.useTransition();
    const [bulkConfirmOpen, setBulkConfirmOpen] = React.useState(false);

    const headChecked =
        filtered.length > 0 &&
        filtered.every((l) => selected.has(String(l._id)));

    const toggleAll = (all: boolean) =>
        setSelected(
            all ? new Set(filtered.map((l) => String(l._id))) : new Set(),
        );

    const toggleOne = (id: string) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    /* ─── Single delete ─────────────────────────────────────────── */
    const confirmDelete = () => {
        if (!pendingDelete?._id) return;
        const id = String(pendingDelete._id);
        const name = fullName(pendingDelete, unnamedLabel);
        startDelete(async () => {
            const res = await deleteLeadAction(id);
            if (res.success) {
                toast({
                    title: t('crm.leads.list.toast.deleted'),
                    description: t(
                        'crm.leads.list.toast.deletedDescription',
                        { name },
                    ),
                });
                setPendingDelete(null);
                router.refresh();
            } else {
                toast({
                    title: t('crm.leads.list.toast.deleteFailed'),
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    };

    /* ─── Bulk delete ───────────────────────────────────────────── */
    const runBulkDelete = () => {
        if (selected.size === 0) return;
        setBulkConfirmOpen(false);
        const ids = Array.from(selected);
        startBulkDelete(async () => {
            let ok = 0;
            let failed = 0;
            for (const id of ids) {
                const res = await deleteLeadAction(id);
                if (res.success) ok++;
                else failed++;
            }
            toast({
                title:
                    failed === 0
                        ? `${ok} lead${ok === 1 ? '' : 's'} deleted`
                        : `${ok} deleted · ${failed} failed`,
                variant: failed > 0 ? 'destructive' : undefined,
            });
            setSelected(new Set());
            router.refresh();
        });
    };

    /* ─── Export ────────────────────────────────────────────────── */
    const exportCsv = React.useCallback(() => {
        const subset =
            selected.size > 0
                ? filtered.filter((l) => selected.has(String(l._id)))
                : filtered;
        const headers = [
            'Name',
            'Email',
            'Phone',
            'Company',
            'Title',
            'Status',
            'Source',
            'Estimated value',
            'Currency',
            'Created at',
        ];
        const rows = subset.map((l) => ({
            Name: fullName(l, ''),
            Email: l.email || '',
            Phone: l.phone || '',
            Company: l.company || '',
            Title: l.title || '',
            Status: l.status?.name || '',
            Source: l.attribution?.source || l.subSource || '',
            'Estimated value': l.estimatedValue ?? '',
            Currency: l.currency || '',
            'Created at': l.createdAt || l.audit?.createdAt || '',
        }));
        downloadCsv(`leads-${dateStamp()}.csv`, headers, rows);
    }, [filtered, selected]);

    /* ─── Saved views ───────────────────────────────────────────── */
    const savedViewFilters = React.useMemo(() => ({ query }), [query]);
    const handleApplyView = React.useCallback((view: SavedView) => {
        const f = (view.filters ?? {}) as Record<string, unknown>;
        if (typeof f.query === 'string') setQuery(f.query);
    }, []);

    return (
        <div className="flex w-full flex-col gap-4">
            <SavedViewsBar
                entityKind="lead"
                currentFilters={savedViewFilters}
                currentColumns={[]}
                onApplyView={handleApplyView}
            />

            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <StatCard
                    label="Leads (this page)"
                    value={kpis.total.toLocaleString()}
                    icon={<Users className="h-4 w-4" />}
                />
                <StatCard
                    label="With est. value"
                    value={kpis.withValue.toLocaleString()}
                    icon={<TrendingUp className="h-4 w-4" />}
                />
                <StatCard
                    label="Total pipeline"
                    value={fmtMoney(kpis.totalValue, undefined, locale)}
                    icon={<TrendingUp className="h-4 w-4" />}
                />
                <StatCard
                    label="Added this month"
                    value={kpis.addedThisMonth.toLocaleString()}
                    icon={<CalendarClock className="h-4 w-4" />}
                />
            </div>

            {/* Filters row */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={t('crm.leads.list.search.placeholder')}
                        className="h-9 pl-9 text-[13px]"
                    />
                </div>
                <Select
                    value={statusFilter}
                    onValueChange={setStatusFilter}
                >
                    <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
                        <ZoruSelectValue placeholder="Status" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                        {statusOptions.map((s) => (
                            <ZoruSelectItem key={s} value={s}>
                                {s}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </Select>
                <Select
                    value={sourceFilter}
                    onValueChange={setSourceFilter}
                >
                    <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
                        <ZoruSelectValue placeholder="Source" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="all">All sources</ZoruSelectItem>
                        {sourceOptions.map((s) => (
                            <ZoruSelectItem key={s} value={s}>
                                {s}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </Select>
                {hasActiveFilters ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                    >
                        <X className="h-3.5 w-3.5" /> Clear filters
                    </Button>
                ) : null}
            </div>

            {/* Bulk bar */}
            {selected.size > 0 ? (
                <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2 shadow-[var(--zoru-shadow-sm)]">
                    <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
                        <ListChecks className="h-4 w-4 text-zoru-primary" />
                        {selected.size} selected
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={exportCsv}
                        >
                            <Download className="h-3.5 w-3.5" /> Export CSV
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setBulkConfirmOpen(true)}
                            disabled={bulkDeleting}
                        >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelected(new Set())}
                            aria-label="Clear selection"
                        >
                            <X className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>
            ) : null}

            <Card className="overflow-hidden p-0">
                {error ? (
                    <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {error}
                    </div>
                ) : null}

                <Table>
                    <ZoruTableHeader>
                        <ZoruTableRow>
                            <ZoruTableHead className="w-8">
                                <Checkbox
                                    checked={headChecked}
                                    onCheckedChange={(c) =>
                                        toggleAll(Boolean(c))
                                    }
                                    aria-label="Select all leads"
                                />
                            </ZoruTableHead>
                            <ZoruTableHead>
                                {t('crm.leads.list.col.name')}
                            </ZoruTableHead>
                            <ZoruTableHead>
                                {t('crm.leads.list.col.contact')}
                            </ZoruTableHead>
                            <ZoruTableHead>
                                {t('crm.leads.list.col.companyTitle')}
                            </ZoruTableHead>
                            <ZoruTableHead>
                                {t('crm.leads.list.col.status')}
                            </ZoruTableHead>
                            <ZoruTableHead>
                                {t('crm.leads.list.col.source')}
                            </ZoruTableHead>
                            <ZoruTableHead>
                                {t('crm.leads.list.col.value')}
                            </ZoruTableHead>
                            <ZoruTableHead>
                                {t('crm.leads.list.col.created')}
                            </ZoruTableHead>
                            <ZoruTableHead className="text-right">
                                {t('crm.leads.list.col.actions')}
                            </ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {filtered.length === 0 ? (
                            <ZoruTableRow>
                                <ZoruTableCell
                                    colSpan={9}
                                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                >
                                    {hasActiveFilters || initialQuery
                                        ? t('crm.leads.list.empty.search')
                                        : t('crm.leads.list.empty.default')}
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ) : (
                            filtered.map((lead) => {
                                const id = String(lead._id);
                                return (
                                    <ZoruTableRow key={id}>
                                        <ZoruTableCell>
                                            <Checkbox
                                                checked={selected.has(id)}
                                                onCheckedChange={() =>
                                                    toggleOne(id)
                                                }
                                                aria-label={`Select ${fullName(lead, unnamedLabel)}`}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <EntityRowLink
                                                href={`/dashboard/crm/leads/${id}`}
                                                label={fullName(
                                                    lead,
                                                    unnamedLabel,
                                                )}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                            <div className="flex flex-col">
                                                {lead.email ? (
                                                    <span>{lead.email}</span>
                                                ) : null}
                                                {lead.phone ? (
                                                    <span>{lead.phone}</span>
                                                ) : null}
                                                {!lead.email && !lead.phone ? (
                                                    <span>—</span>
                                                ) : null}
                                            </div>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                            <div className="flex flex-col">
                                                {lead.company ? (
                                                    <span>{lead.company}</span>
                                                ) : null}
                                                {lead.title ? (
                                                    <span>{lead.title}</span>
                                                ) : null}
                                                {!lead.company &&
                                                !lead.title ? (
                                                    <span>—</span>
                                                ) : null}
                                            </div>
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            {lead.status?.name ? (
                                                <Badge variant="outline">
                                                    {lead.status.name}
                                                </Badge>
                                            ) : (
                                                <span className="text-[12.5px] text-zoru-ink-muted">
                                                    —
                                                </span>
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                            {lead.attribution?.source ||
                                                lead.subSource ||
                                                '—'}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[12.5px] tabular-nums text-zoru-ink">
                                            {fmtMoney(
                                                lead.estimatedValue,
                                                lead.currency,
                                                locale,
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                                            {fmtDate(
                                                lead.createdAt ||
                                                    lead.audit?.createdAt,
                                                locale,
                                            )}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    asChild
                                                >
                                                    <Link
                                                        href={`/dashboard/crm/leads/${id}/edit`}
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Link>
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        setPendingDelete(lead)
                                                    }
                                                    className="text-zoru-danger-ink"
                                                    aria-label={`Delete ${fullName(lead, unnamedLabel)}`}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                );
                            })
                        )}
                    </ZoruTableBody>
                </Table>

                <PaginationBar page={page} limit={limit} hasMore={hasMore} />
            </Card>

            {/* Single delete confirm */}
            <ZoruAlertDialog
                open={pendingDelete !== null}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                            {t('crm.leads.list.delete.title')}
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            {t('crm.leads.list.delete.description', {
                                name: pendingDelete
                                    ? fullName(pendingDelete, unnamedLabel)
                                    : '',
                            })}
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel disabled={deleting}>
                            {t('crm.leads.list.delete.cancel')}
                        </ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                confirmDelete();
                            }}
                            disabled={deleting}
                            className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
                        >
                            {deleting ? (
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            {t('crm.leads.list.delete.confirm')}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>

            {/* Bulk delete confirm */}
            <ZoruAlertDialog
                open={bulkConfirmOpen}
                onOpenChange={(o) => !o && setBulkConfirmOpen(false)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                            Delete {selected.size} lead
                            {selected.size === 1 ? '' : 's'}?
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            This permanently removes the selected leads. This
                            action cannot be undone.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel disabled={bulkDeleting}>
                            Cancel
                        </ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                runBulkDelete();
                            }}
                            disabled={bulkDeleting}
                            className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
                        >
                            {bulkDeleting ? (
                                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Delete
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </div>
    );
}
