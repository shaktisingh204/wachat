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

import { Badge, Button, Card, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';

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
    const { toast } = useToast();

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
                const ExcelJS = (await import('exceljs')).default;
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Forms');
                [header, ...data].forEach((row) => worksheet.addRow(row));
                const buf = await workbook.xlsx.writeBuffer();
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
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Download className="h-4 w-4" /> Export
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => exportRows('csv')}>
                                    Export as CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => exportRows('xlsx')}>
                                    Export as XLSX
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button asChild>
                            <Link href="/dashboard/crm/sales-crm/custom-forms/new">
                                <Plus className="h-4 w-4" /> New form
                            </Link>
                        </Button>
                    </div>
                }
                filters={
                    <div className="flex flex-wrap items-center gap-2">
                        <Select
                            value={statusFilter}
                            onValueChange={(v) => {
                                setStatusFilter(v as StatusFilter);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All status</SelectItem>
                                <SelectItem value="published">Published</SelectItem>
                                <SelectItem value="draft">Draft</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select
                            value={submissionsFilter}
                            onValueChange={(v) => {
                                setSubmissionsFilter(v as SubmissionsFilter);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Submissions" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All forms</SelectItem>
                                <SelectItem value="withSubs">
                                    With submissions
                                </SelectItem>
                                <SelectItem value="noSubs">No submissions</SelectItem>
                            </SelectContent>
                        </Select>
                        {hasActiveFilters ? (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={clearFilters}
                            >
                                <X className="h-4 w-4" /> Clear
                            </Button>
                        ) : null}
                    </div>
                }
                bulkBar={
                    selected.size > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-[13px] text-[var(--st-text)]">
                                <span className="font-medium">{selected.size}</span> selected
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => runBulk('publish')}
                                >
                                    <Send className="h-4 w-4" /> Publish
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => runBulk('draft')}
                                >
                                    Move to draft
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportRows('csv')}
                                >
                                    <Download className="h-4 w-4" /> Export CSV
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportRows('xlsx')}
                                >
                                    <Download className="h-4 w-4" /> Export XLSX
                                </Button>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => setBulkConfirm('delete')}
                                >
                                    <Trash2 className="h-4 w-4" /> Delete
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelected(new Set())}
                                >
                                    <X className="h-4 w-4" /> Clear
                                </Button>
                            </div>
                        </div>
                    ) : null
                }
                empty={
                    !isPending && displayedForms.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 p-4">
                            <FileText className="h-8 w-8 text-[var(--st-text-secondary)]" />
                            <h3 className="text-base font-medium text-[var(--st-text)]">
                                No forms found
                            </h3>
                            <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                                {hasActiveFilters
                                    ? 'No forms match the current filters.'
                                    : 'Capture leads and submissions by building your first public form.'}
                            </p>
                            <Button asChild>
                                <Link href="/dashboard/crm/sales-crm/custom-forms/new">
                                    <Plus className="h-4 w-4" /> New form
                                </Link>
                            </Button>
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
                        <StatCard
                            label="Total forms"
                            value={kpis.total.toLocaleString()}
                            icon={<FileText />}
                        />
                        <StatCard
                            label="Published"
                            value={kpis.published.toLocaleString()}
                        />
                        <StatCard
                            label="Drafts"
                            value={kpis.drafts.toLocaleString()}
                        />
                        <StatCard
                            label="Total submissions"
                            value={kpis.totalSubmissions.toLocaleString()}
                        />
                    </div>

                    {/* Table */}
                    <Card className="p-0">
                        <div className="overflow-x-auto rounded-lg">
                            <Table>
                                <THead>
                                    <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                        <Th className="w-10">
                                            <Checkbox
                                                checked={allSelectedOnPage}
                                                onCheckedChange={(c) =>
                                                    handleToggleAll(Boolean(c))
                                                }
                                                aria-label="Select all"
                                            />
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Name
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Status
                                        </Th>
                                        <Th className="text-right text-[var(--st-text-secondary)]">
                                            Fields
                                        </Th>
                                        <Th className="text-right text-[var(--st-text-secondary)]">
                                            Submissions
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Created
                                        </Th>
                                        <Th className="text-[var(--st-text-secondary)]">
                                            Updated
                                        </Th>
                                        <Th className="w-10" />
                                    </Tr>
                                </THead>
                                <TBody>
                                    {displayedForms.map((f) => {
                                        const id = toIdString(f._id);
                                        const status = getFormStatus(f);
                                        const subs = Number(f.submissionCount ?? 0);
                                        return (
                                            <Tr
                                                key={id}
                                                className="border-[var(--st-border)]"
                                                data-state={
                                                    selected.has(id) ? 'selected' : undefined
                                                }
                                            >
                                                <Td>
                                                    <Checkbox
                                                        checked={selected.has(id)}
                                                        onCheckedChange={() =>
                                                            handleToggleOne(id)
                                                        }
                                                        aria-label={`Select ${f.name}`}
                                                    />
                                                </Td>
                                                <Td>
                                                    <EntityRowLink
                                                        href={`/dashboard/crm/sales-crm/custom-forms/${id}`}
                                                        label={f.name || 'Untitled form'}
                                                    />
                                                </Td>
                                                <Td>
                                                    {status === 'published' ? (
                                                        <Badge variant="success">
                                                            Published
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="ghost">
                                                            Draft
                                                        </Badge>
                                                    )}
                                                </Td>
                                                <Td className="text-right text-[var(--st-text)]">
                                                    {Array.isArray(f.fields)
                                                        ? f.fields.length
                                                        : 0}
                                                </Td>
                                                <Td className="text-right text-[var(--st-text)]">
                                                    {subs.toLocaleString()}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {formatDate(f.createdAt)}
                                                </Td>
                                                <Td className="text-[var(--st-text)]">
                                                    {formatDate(f.updatedAt)}
                                                </Td>
                                                <Td>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                aria-label="Row actions"
                                                            >
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem asChild>
                                                                <Link
                                                                    href={`/dashboard/crm/sales-crm/custom-forms/${id}`}
                                                                >
                                                                    View
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem asChild>
                                                                <Link
                                                                    href={`/dashboard/crm/sales-crm/custom-forms/${id}/edit`}
                                                                >
                                                                    Edit
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem asChild>
                                                                <Link
                                                                    href={`/dashboard/crm/sales-crm/forms/${id}/submissions`}
                                                                >
                                                                    View submissions
                                                                </Link>
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onSelect={() =>
                                                                    setDeleteTargetId(id)
                                                                }
                                                                className="text-[var(--st-danger)]"
                                                            >
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </Td>
                                            </Tr>
                                        );
                                    })}
                                </TBody>
                            </Table>
                        </div>
                    </Card>
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
