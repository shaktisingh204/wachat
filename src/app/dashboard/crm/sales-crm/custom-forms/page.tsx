'use client';

import * as React from 'react';
import Link from 'next/link';
import { useDebouncedCallback } from 'use-debounce';
import {
    Download,
    FileText,
    MoreHorizontal,
    Plus,
    Send,
    Trash2,
    X,
} from 'lucide-react';

import {
    ZoruBadge,
    ZoruButton,
    ZoruCard,
    ZoruCheckbox,
    ZoruDropdownMenu,
    ZoruDropdownMenuContent,
    ZoruDropdownMenuItem,
    ZoruDropdownMenuSeparator,
    ZoruDropdownMenuTrigger,
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

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';

import {
    bulkFormAction,
    deleteCrmForm,
    getCrmFormKpis,
    getCrmForms,
    type CrmFormKpis,
} from '@/app/actions/crm-forms.actions';
import type { CrmForm } from '@/lib/definitions';
import type { WithId } from 'mongodb';

const FORMS_PER_PAGE = 20;

const EMPTY_KPIS: CrmFormKpis = {
    total: 0,
    published: 0,
    drafts: 0,
    totalSubmissions: 0,
};

type StatusFilter = 'all' | 'published' | 'draft';
type SubmissionsFilter = 'all' | 'withSubs' | 'noSubs';

type FormRow = WithId<CrmForm> & { _id: { toString: () => string } | string };

function toIdString(id: unknown): string {
    if (!id) return '';
    if (typeof id === 'string') return id;
    if (typeof (id as { toString?: () => string }).toString === 'function') {
        return (id as { toString: () => string }).toString();
    }
    return String(id);
}

function getFormStatus(f: FormRow): 'published' | 'draft' {
    const s = (f.settings as { status?: string } | undefined)?.status;
    return s === 'published' ? 'published' : 'draft';
}

function formatDate(value: string | Date | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString();
}

export default function CustomFormsPage() {
    const { toast } = useZoruToast();

    // List + KPIs
    const [forms, setForms] = React.useState<FormRow[]>([]);
    const [total, setTotal] = React.useState(0);
    const [page, setPage] = React.useState(1);
    const [isPending, startTransition] = React.useTransition();
    const [kpis, setKpis] = React.useState<CrmFormKpis>(EMPTY_KPIS);

    // Filters
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [submissionsFilter, setSubmissionsFilter] =
        React.useState<SubmissionsFilter>('all');

    // Selection + dialogs
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
    const [bulkConfirm, setBulkConfirm] = React.useState<'delete' | null>(null);

    const fetchData = React.useCallback(() => {
        startTransition(async () => {
            const [{ forms: rows, total: count }, kpiData] = await Promise.all([
                getCrmForms(page, FORMS_PER_PAGE, search),
                getCrmFormKpis(),
            ]);
            setForms(rows as FormRow[]);
            setTotal(count);
            setKpis(kpiData ?? EMPTY_KPIS);
        });
    }, [page, search]);

    React.useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((next: string) => {
        setSearch(next);
        setPage(1);
    }, 300);

    const displayedForms = React.useMemo(() => {
        return forms.filter((f) => {
            if (statusFilter !== 'all' && getFormStatus(f) !== statusFilter) return false;
            const subs = Number(f.submissionCount ?? 0);
            if (submissionsFilter === 'withSubs' && subs <= 0) return false;
            if (submissionsFilter === 'noSubs' && subs > 0) return false;
            return true;
        });
    }, [forms, statusFilter, submissionsFilter]);

    const hasActiveFilters =
        statusFilter !== 'all' || submissionsFilter !== 'all' || !!search;

    const clearFilters = React.useCallback(() => {
        setStatusFilter('all');
        setSubmissionsFilter('all');
        setSearch('');
        setPage(1);
    }, []);

    const handleToggleOne = React.useCallback((id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleToggleAll = React.useCallback(
        (all: boolean) => {
            setSelected(
                all
                    ? new Set(displayedForms.map((f) => toIdString(f._id)))
                    : new Set(),
            );
        },
        [displayedForms],
    );

    const deleteTarget = React.useMemo(
        () => forms.find((f) => toIdString(f._id) === deleteTargetId) ?? null,
        [forms, deleteTargetId],
    );

    const handleConfirmDelete = React.useCallback(async () => {
        if (!deleteTargetId) return;
        const res = await deleteCrmForm(deleteTargetId);
        if (res.message) {
            toast({ title: res.message });
            fetchData();
        } else {
            toast({
                title: 'Delete failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setDeleteTargetId(null);
    }, [deleteTargetId, fetchData, toast]);

    const runBulk = React.useCallback(
        async (op: 'delete' | 'publish' | 'draft') => {
            if (selected.size === 0) return;
            const res = await bulkFormAction(Array.from(selected), op);
            if (res.success) {
                toast({
                    title: `${res.processed ?? 0} form${
                        res.processed === 1 ? '' : 's'
                    } ${
                        op === 'delete'
                            ? 'deleted'
                            : op === 'publish'
                              ? 'published'
                              : 'moved to draft'
                    }`,
                });
                setSelected(new Set());
                fetchData();
            } else {
                toast({
                    title: 'Bulk action failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
            setBulkConfirm(null);
        },
        [selected, fetchData, toast],
    );

    const exportRows = React.useCallback(
        async (format: 'csv' | 'xlsx') => {
            const rows =
                selected.size > 0
                    ? forms.filter((f) => selected.has(toIdString(f._id)))
                    : displayedForms;
            if (rows.length === 0) {
                toast({ title: 'Nothing to export' });
                return;
            }
            const header = [
                'Name',
                'Status',
                'Fields',
                'Submissions',
                'Created At',
                'Updated At',
            ];
            const data = rows.map((f) => [
                f.name ?? '',
                getFormStatus(f),
                Array.isArray(f.fields) ? f.fields.length : 0,
                Number(f.submissionCount ?? 0),
                f.createdAt ? new Date(f.createdAt).toISOString() : '',
                f.updatedAt ? new Date(f.updatedAt).toISOString() : '',
            ]);
            const date = new Date().toISOString().slice(0, 10);
            const filename = `forms-${date}.${format}`;
            if (format === 'csv') {
                const esc = (v: unknown) =>
                    `"${String(v ?? '').replace(/"/g, '""')}"`;
                const csv = [
                    header.join(','),
                    ...data.map((r) => r.map(esc).join(',')),
                ].join('\n');
                triggerDownload(
                    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
                    filename,
                );
                return;
            }
            try {
                const xlsx = await import('xlsx');
                const ws = xlsx.utils.aoa_to_sheet([header, ...data]);
                const wb = xlsx.utils.book_new();
                xlsx.utils.book_append_sheet(wb, ws, 'Forms');
                const buf = xlsx.write(wb, {
                    type: 'array',
                    bookType: 'xlsx',
                }) as ArrayBuffer;
                triggerDownload(
                    new Blob([buf], {
                        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    }),
                    filename,
                );
            } catch {
                toast({
                    title: 'Export failed',
                    description: 'Could not generate XLSX file.',
                    variant: 'destructive',
                });
            }
        },
        [selected, forms, displayedForms, toast],
    );

    const totalPages = Math.max(1, Math.ceil(total / FORMS_PER_PAGE));
    const allSelectedOnPage =
        displayedForms.length > 0 &&
        displayedForms.every((f) => selected.has(toIdString(f._id)));

    return (
        <>
            <EntityListShell
                title="Custom Forms"
                subtitle="Public-facing forms that capture leads, submissions and contact details into your CRM."
                search={{
                    value: search,
                    onChange: handleSearch,
                    placeholder: 'Search by form name…',
                }}
                primaryAction={
                    <div className="flex items-center gap-2">
                        <ZoruDropdownMenu>
                            <ZoruDropdownMenuTrigger asChild>
                                <ZoruButton variant="outline" size="sm">
                                    <Download className="h-4 w-4" /> Export
                                </ZoruButton>
                            </ZoruDropdownMenuTrigger>
                            <ZoruDropdownMenuContent align="end">
                                <ZoruDropdownMenuItem onSelect={() => exportRows('csv')}>
                                    Export as CSV
                                </ZoruDropdownMenuItem>
                                <ZoruDropdownMenuItem onSelect={() => exportRows('xlsx')}>
                                    Export as XLSX
                                </ZoruDropdownMenuItem>
                            </ZoruDropdownMenuContent>
                        </ZoruDropdownMenu>
                        <ZoruButton asChild>
                            <Link href="/dashboard/crm/sales-crm/custom-forms/new">
                                <Plus className="h-4 w-4" /> New form
                            </Link>
                        </ZoruButton>
                    </div>
                }
                filters={
                    <div className="flex flex-wrap items-center gap-2">
                        <ZoruSelect
                            value={statusFilter}
                            onValueChange={(v) => {
                                setStatusFilter(v as StatusFilter);
                                setPage(1);
                            }}
                        >
                            <ZoruSelectTrigger className="w-[150px]">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All status</ZoruSelectItem>
                                <ZoruSelectItem value="published">Published</ZoruSelectItem>
                                <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                        <ZoruSelect
                            value={submissionsFilter}
                            onValueChange={(v) => {
                                setSubmissionsFilter(v as SubmissionsFilter);
                                setPage(1);
                            }}
                        >
                            <ZoruSelectTrigger className="w-[180px]">
                                <ZoruSelectValue placeholder="Submissions" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All forms</ZoruSelectItem>
                                <ZoruSelectItem value="withSubs">
                                    With submissions
                                </ZoruSelectItem>
                                <ZoruSelectItem value="noSubs">No submissions</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                        {hasActiveFilters ? (
                            <ZoruButton
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                            >
                                <X className="h-4 w-4" /> Clear
                            </ZoruButton>
                        ) : null}
                    </div>
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-[13px] text-zoru-ink">
                                <span className="font-medium">{selected.size}</span> selected
                            </div>
                            <div className="flex items-center gap-2">
                                <ZoruButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() => runBulk('publish')}
                                >
                                    <Send className="h-4 w-4" /> Publish
                                </ZoruButton>
                                <ZoruButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() => runBulk('draft')}
                                >
                                    Move to draft
                                </ZoruButton>
                                <ZoruButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportRows('csv')}
                                >
                                    <Download className="h-4 w-4" /> Export CSV
                                </ZoruButton>
                                <ZoruButton
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportRows('xlsx')}
                                >
                                    <Download className="h-4 w-4" /> Export XLSX
                                </ZoruButton>
                                <ZoruButton
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setBulkConfirm('delete')}
                                >
                                    <Trash2 className="h-4 w-4" /> Delete
                                </ZoruButton>
                                <ZoruButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelected(new Set())}
                                >
                                    <X className="h-4 w-4" /> Clear
                                </ZoruButton>
                            </div>
                        </div>
                    ) : null
                }
                empty={
                    !isPending && displayedForms.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <FileText className="h-8 w-8 text-zoru-ink-muted" />
                            <h3 className="text-base font-medium text-zoru-ink">
                                No forms found
                            </h3>
                            <p className="max-w-sm text-sm text-zoru-ink-muted">
                                {hasActiveFilters
                                    ? 'No forms match the current filters.'
                                    : 'Capture leads and submissions by building your first public form.'}
                            </p>
                            <ZoruButton asChild>
                                <Link href="/dashboard/crm/sales-crm/custom-forms/new">
                                    <Plus className="h-4 w-4" /> New form
                                </Link>
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={isPending && forms.length === 0}
                pagination={
                    forms.length > 0 ? (
                        <PaginationBar
                            page={page}
                            limit={FORMS_PER_PAGE}
                            hasMore={page < totalPages}
                            total={total}
                            controlled={{ onChange: (next) => setPage(next.page) }}
                        />
                    ) : null
                }
            >
                <div className="flex flex-col gap-4">
                    {/* KPI strip */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <ZoruStatCard
                            label="Total forms"
                            value={kpis.total.toLocaleString()}
                            icon={<FileText />}
                        />
                        <ZoruStatCard
                            label="Published"
                            value={kpis.published.toLocaleString()}
                        />
                        <ZoruStatCard
                            label="Drafts"
                            value={kpis.drafts.toLocaleString()}
                        />
                        <ZoruStatCard
                            label="Total submissions"
                            value={kpis.totalSubmissions.toLocaleString()}
                        />
                    </div>

                    {/* Table */}
                    <ZoruCard className="p-0">
                        <div className="overflow-x-auto rounded-lg">
                            <ZoruTable>
                                <ZoruTableHeader>
                                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                        <ZoruTableHead className="w-10">
                                            <ZoruCheckbox
                                                checked={allSelectedOnPage}
                                                onCheckedChange={(c) =>
                                                    handleToggleAll(Boolean(c))
                                                }
                                                aria-label="Select all"
                                            />
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">
                                            Name
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">
                                            Status
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-right text-zoru-ink-muted">
                                            Fields
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-right text-zoru-ink-muted">
                                            Submissions
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">
                                            Created
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-zoru-ink-muted">
                                            Updated
                                        </ZoruTableHead>
                                        <ZoruTableHead className="w-10" />
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {displayedForms.map((f) => {
                                        const id = toIdString(f._id);
                                        const status = getFormStatus(f);
                                        const subs = Number(f.submissionCount ?? 0);
                                        return (
                                            <ZoruTableRow
                                                key={id}
                                                className="border-zoru-line"
                                                data-state={
                                                    selected.has(id) ? 'selected' : undefined
                                                }
                                            >
                                                <ZoruTableCell>
                                                    <ZoruCheckbox
                                                        checked={selected.has(id)}
                                                        onCheckedChange={() =>
                                                            handleToggleOne(id)
                                                        }
                                                        aria-label={`Select ${f.name}`}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <EntityRowLink
                                                        href={`/dashboard/crm/sales-crm/custom-forms/${id}`}
                                                        label={f.name || 'Untitled form'}
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    {status === 'published' ? (
                                                        <ZoruBadge variant="success">
                                                            Published
                                                        </ZoruBadge>
                                                    ) : (
                                                        <ZoruBadge variant="ghost">
                                                            Draft
                                                        </ZoruBadge>
                                                    )}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right text-zoru-ink">
                                                    {Array.isArray(f.fields)
                                                        ? f.fields.length
                                                        : 0}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right text-zoru-ink">
                                                    {subs.toLocaleString()}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {formatDate(f.createdAt)}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-zoru-ink">
                                                    {formatDate(f.updatedAt)}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <ZoruDropdownMenu>
                                                        <ZoruDropdownMenuTrigger asChild>
                                                            <ZoruButton
                                                                variant="ghost"
                                                                size="icon"
                                                                aria-label="Row actions"
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </ZoruButton>
                                                        </ZoruDropdownMenuTrigger>
                                                        <ZoruDropdownMenuContent align="end">
                                                            <ZoruDropdownMenuItem asChild>
                                                                <Link
                                                                    href={`/dashboard/crm/sales-crm/custom-forms/${id}`}
                                                                >
                                                                    View
                                                                </Link>
                                                            </ZoruDropdownMenuItem>
                                                            <ZoruDropdownMenuItem asChild>
                                                                <Link
                                                                    href={`/dashboard/crm/sales-crm/custom-forms/${id}/edit`}
                                                                >
                                                                    Edit
                                                                </Link>
                                                            </ZoruDropdownMenuItem>
                                                            <ZoruDropdownMenuItem asChild>
                                                                <Link
                                                                    href={`/dashboard/crm/sales-crm/forms/${id}/submissions`}
                                                                >
                                                                    View submissions
                                                                </Link>
                                                            </ZoruDropdownMenuItem>
                                                            <ZoruDropdownMenuSeparator />
                                                            <ZoruDropdownMenuItem
                                                                onSelect={() =>
                                                                    setDeleteTargetId(id)
                                                                }
                                                                className="text-zoru-danger"
                                                            >
                                                                Delete
                                                            </ZoruDropdownMenuItem>
                                                        </ZoruDropdownMenuContent>
                                                    </ZoruDropdownMenu>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        );
                                    })}
                                </ZoruTableBody>
                            </ZoruTable>
                        </div>
                    </ZoruCard>
                </div>
            </EntityListShell>

            <ConfirmDialog
                open={!!deleteTargetId}
                onOpenChange={(o) => !o && setDeleteTargetId(null)}
                title="Delete this form?"
                description={`"${deleteTarget?.name ?? 'This form'}" and all its submissions will be permanently removed.`}
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleConfirmDelete}
            />
            <ConfirmDialog
                open={bulkConfirm === 'delete'}
                onOpenChange={(o) => !o && setBulkConfirm(null)}
                title={`Delete ${selected.size} form${selected.size === 1 ? '' : 's'}?`}
                description="These forms and all their submissions will be permanently removed."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={() => runBulk('delete')}
            />
        </>
    );
}

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
