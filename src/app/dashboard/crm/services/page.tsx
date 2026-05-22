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
  Checkbox,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
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
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Archive,
  ArchiveRestore,
  Award,
  Briefcase,
  CheckCircle2,
  DollarSign,
  Download,
  Edit,
  FileSpreadsheet,
  Layers,
  LoaderCircle,
  Plus,
  Trash2,
} from 'lucide-react';

/**
 * Service Catalog — settings-style page.
 *
 * Inline-create/edit dialog mirroring `crm/projects/task-tags/page.tsx`
 * and `crm/accounting/groups/page.tsx`. Backed by the `crm_services`
 * Mongo collection (no Rust crate).
 *
 *   - Search + status filter + billable-by filter
 *   - Inline Dialog for create/edit
 *   - SabFiles picker for the service image (no free-text URLs)
 *   - ZoruAlertDialog soft-delete confirm
 *   - Per-tenant unique code guard enforced server-side
 */

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { SabFileUrlInput } from '@/components/sabfiles';
import { downloadCsv, downloadXlsx, dateStamp } from '@/lib/crm-list-export';

import {
    bulkServiceAction,
    deleteCrmService,
    getCrmServiceKpis,
    getCrmServices,
    saveCrmService,
    type CrmServiceBillableBy,
    type CrmServiceDoc,
    type CrmServiceKpis,
    type CrmServiceStatus,
} from '@/app/actions/crm-service-catalog.actions';

const STATUS_TONE: Record<CrmServiceStatus, StatusTone> = {
    active: 'green',
    archived: 'neutral',
};

const STATUS_OPTIONS: Array<{ value: CrmServiceStatus | 'all'; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'active', label: 'Active' },
    { value: 'archived', label: 'Archived' },
];

const BILLABLE_LABELS: Record<CrmServiceBillableBy, string> = {
    hour: 'Per hour',
    fixed: 'Fixed price',
    project: 'Per project',
};

const BILLABLE_OPTIONS: Array<{ value: CrmServiceBillableBy | 'all'; label: string }> = [
    { value: 'all', label: 'All billing modes' },
    { value: 'hour', label: 'Per hour' },
    { value: 'fixed', label: 'Fixed price' },
    { value: 'project', label: 'Per project' },
];

const initialState: { message?: string; error?: string; id?: string } = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Save changes' : 'Create service'}
        </ZoruButton>
    );
}

function ServiceDialog({
    isOpen,
    onOpenChange,
    onSave,
    initialData,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    initialData: CrmServiceDoc | null;
}) {
    const isEditing = !!initialData?._id;
    const [state, formAction] = useActionState(saveCrmService, initialState);
    const { toast } = useZoruToast();
    const [status, setStatus] = React.useState<CrmServiceStatus>(
        (initialData?.status as CrmServiceStatus) || 'active',
    );
    const [billableBy, setBillableBy] = React.useState<CrmServiceBillableBy>(
        (initialData?.billableBy as CrmServiceBillableBy) || 'hour',
    );
    const [imageUrl, setImageUrl] = React.useState<string>(
        initialData?.imageUrl || '',
    );

    React.useEffect(() => {
        setStatus((initialData?.status as CrmServiceStatus) || 'active');
        setBillableBy(
            (initialData?.billableBy as CrmServiceBillableBy) || 'hour',
        );
        setImageUrl(initialData?.imageUrl || '');
    }, [initialData]);

    React.useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
            onSave();
            onOpenChange(false);
        }
        if (state.error) {
            toast({
                title: 'Error',
                description: state.error,
                variant: 'destructive',
            });
        }
    }, [state, toast, onSave, onOpenChange]);

    return (
        <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-2xl">
                <form action={formAction}>
                    {isEditing ? (
                        <input
                            type="hidden"
                            name="serviceId"
                            value={String(initialData!._id)}
                        />
                    ) : null}
                    <input type="hidden" name="status" value={status} />
                    <input type="hidden" name="billableBy" value={billableBy} />

                    <ZoruDialogHeader>
                        <ZoruDialogTitle>
                            {isEditing ? 'Edit' : 'Create new'} service
                        </ZoruDialogTitle>
                    </ZoruDialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="name">Name *</ZoruLabel>
                                <ZoruInput
                                    id="name"
                                    name="name"
                                    placeholder="e.g. UX consultation"
                                    required
                                    defaultValue={initialData?.name}
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="code">Code</ZoruLabel>
                                <ZoruInput
                                    id="code"
                                    name="code"
                                    placeholder="e.g. UX-CONSULT"
                                    defaultValue={initialData?.code ?? ''}
                                />
                                <p className="text-[11.5px] text-zoru-ink-muted">
                                    Optional, unique per tenant.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel htmlFor="description">Description</ZoruLabel>
                            <ZoruTextarea
                                id="description"
                                name="description"
                                rows={2}
                                placeholder="What does this service include?"
                                defaultValue={initialData?.description ?? ''}
                            />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="category">Category</ZoruLabel>
                                <ZoruInput
                                    id="category"
                                    name="category"
                                    placeholder="e.g. Consulting"
                                    defaultValue={initialData?.category ?? ''}
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="billableBy-trigger">
                                    Billable by
                                </ZoruLabel>
                                <ZoruSelect
                                    value={billableBy}
                                    onValueChange={(v) =>
                                        setBillableBy(v as CrmServiceBillableBy)
                                    }
                                >
                                    <ZoruSelectTrigger id="billableBy-trigger">
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="hour">
                                            Per hour
                                        </ZoruSelectItem>
                                        <ZoruSelectItem value="fixed">
                                            Fixed price
                                        </ZoruSelectItem>
                                        <ZoruSelectItem value="project">
                                            Per project
                                        </ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="defaultPrice">
                                    Default price
                                </ZoruLabel>
                                <ZoruInput
                                    id="defaultPrice"
                                    name="defaultPrice"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    defaultValue={initialData?.defaultPrice ?? ''}
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="currency">Currency</ZoruLabel>
                                <ZoruInput
                                    id="currency"
                                    name="currency"
                                    placeholder="INR"
                                    maxLength={3}
                                    defaultValue={initialData?.currency ?? 'INR'}
                                />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="taxRate">Tax rate %</ZoruLabel>
                                <ZoruInput
                                    id="taxRate"
                                    name="taxRate"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0"
                                    defaultValue={initialData?.taxRate ?? ''}
                                />
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="durationMinutes">
                                    Duration (minutes)
                                </ZoruLabel>
                                <ZoruInput
                                    id="durationMinutes"
                                    name="durationMinutes"
                                    type="number"
                                    step="1"
                                    min="0"
                                    placeholder="e.g. 60"
                                    defaultValue={initialData?.durationMinutes ?? ''}
                                />
                                <p className="text-[11.5px] text-zoru-ink-muted">
                                    Typical session length, when applicable.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="status-trigger">Status</ZoruLabel>
                                <ZoruSelect
                                    value={status}
                                    onValueChange={(v) =>
                                        setStatus(v as CrmServiceStatus)
                                    }
                                >
                                    <ZoruSelectTrigger id="status-trigger">
                                        <ZoruSelectValue />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="active">
                                            Active
                                        </ZoruSelectItem>
                                        <ZoruSelectItem value="archived">
                                            Archived
                                        </ZoruSelectItem>
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel>Image</ZoruLabel>
                            <SabFileUrlInput
                                name="imageUrl"
                                accept="image"
                                value={imageUrl}
                                onChange={(v) => setImageUrl(v || '')}
                                pickerTitle="Choose service image"
                                placeholder="No image chosen"
                            />
                            <p className="text-[11.5px] text-zoru-ink-muted">
                                Files come from SabFiles — pick from library or
                                upload fresh.
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            <ZoruCheckbox
                                id="isActive"
                                name="isActive"
                                defaultChecked={initialData?.isActive ?? true}
                            />
                            <ZoruLabel htmlFor="isActive" className="cursor-pointer">
                                Active (visible in proposals & invoices)
                            </ZoruLabel>
                        </div>
                    </div>

                    <ZoruDialogFooter>
                        <ZoruButton
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </ZoruButton>
                        <SubmitButton isEditing={isEditing} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

const SERVICES_PER_PAGE = 20;

const EMPTY_SERVICE_KPIS: CrmServiceKpis = {
    total: 0,
    active: 0,
    archived: 0,
    totalBilled: 0,
    topRevenueService: null,
};

export default function ServicesPage() {
    const { toast } = useZoruToast();
    const [rows, setRows] = React.useState<CrmServiceDoc[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [kpis, setKpis] = React.useState<CrmServiceKpis>(EMPTY_SERVICE_KPIS);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<
        CrmServiceStatus | 'all'
    >('all');
    const [billableFilter, setBillableFilter] = React.useState<
        CrmServiceBillableBy | 'all'
    >('all');
    const [categoryFilter, setCategoryFilter] = React.useState<string>('');
    const [editing, setEditing] = React.useState<CrmServiceDoc | null>(null);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [pendingDelete, setPendingDelete] = React.useState<CrmServiceDoc | null>(
        null,
    );
    const [deletePending, startDeleteTransition] = React.useTransition();

    /* ─── Selection + pagination ─────────────────────────────── */
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [page, setPage] = React.useState(1);
    const [bulkArchiveOpen, setBulkArchiveOpen] = React.useState(false);
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        try {
            const [data, kpiData] = await Promise.all([
                getCrmServices(),
                getCrmServiceKpis(),
            ]);
            setRows(data);
            setKpis(kpiData ?? EMPTY_SERVICE_KPIS);
        } catch {
            setRows([]);
            setKpis(EMPTY_SERVICE_KPIS);
        } finally {
            setIsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter((r) => {
            if (statusFilter !== 'all' && r.status !== statusFilter) return false;
            if (billableFilter !== 'all' && r.billableBy !== billableFilter) {
                return false;
            }
            if (categoryFilter && (r.category ?? '') !== categoryFilter) {
                return false;
            }
            if (!q) return true;
            return `${r.name} ${r.code ?? ''} ${r.category ?? ''} ${
                r.description ?? ''
            }`
                .toLowerCase()
                .includes(q);
        });
    }, [rows, search, statusFilter, billableFilter, categoryFilter]);

    // Reset to page 1 whenever filter set changes
    React.useEffect(() => {
        setPage(1);
    }, [search, statusFilter, billableFilter, categoryFilter]);

    const totalFiltered = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / SERVICES_PER_PAGE));
    const paged = React.useMemo(
        () =>
            filtered.slice(
                (page - 1) * SERVICES_PER_PAGE,
                page * SERVICES_PER_PAGE,
            ),
        [filtered, page],
    );

    const categoryOptions = React.useMemo(() => {
        const set = new Set<string>();
        for (const r of rows) {
            if (r.category) set.add(r.category);
        }
        return Array.from(set).sort();
    }, [rows]);

    const hasActiveFilters =
        statusFilter !== 'all' || billableFilter !== 'all' || !!categoryFilter;

    const clearFilters = () => {
        setSearch('');
        setStatusFilter('all');
        setBillableFilter('all');
        setCategoryFilter('');
    };

    const handleOpenDialog = (row: CrmServiceDoc | null) => {
        setEditing(row);
        setIsDialogOpen(true);
    };

    const handleDelete = () => {
        if (!pendingDelete?._id) return;
        const id = String(pendingDelete._id);
        startDeleteTransition(async () => {
            const result = await deleteCrmService(id);
            if (result.success) {
                toast({ title: 'Service archived' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not archive service.',
                    variant: 'destructive',
                });
            }
        });
    };

    /* ─── Selection ────────────────────────────────────────── */
    const toggleOne = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const toggleAll = (all: boolean) => {
        setSelected(
            all ? new Set(paged.map((r) => String(r._id))) : new Set(),
        );
    };

    /* ─── Bulk actions ─────────────────────────────────────── */
    const runBulk = React.useCallback(
        async (op: 'archive' | 'unarchive' | 'delete') => {
            if (selected.size === 0) return;
            const res = await bulkServiceAction(Array.from(selected), op);
            if (res.success) {
                toast({
                    title: `${res.processed} service${
                        res.processed === 1 ? '' : 's'
                    } ${op === 'delete' ? 'deleted' : op === 'archive' ? 'archived' : 'restored'}`,
                });
                setSelected(new Set());
                setBulkArchiveOpen(false);
                setBulkDeleteOpen(false);
                await refresh();
            } else {
                toast({
                    title: 'Bulk action failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        },
        [selected, refresh, toast],
    );

    /* ─── Export ──────────────────────────────────────────── */
    const exportHeaders = React.useMemo<string[]>(
        () => [
            'Name',
            'Code',
            'Category',
            'BillableBy',
            'DefaultPrice',
            'Currency',
            'TaxRate',
            'DurationMinutes',
            'Status',
            'CreatedAt',
        ],
        [],
    );

    const exportRows = React.useMemo(() => {
        const source =
            selected.size > 0
                ? rows.filter((r) => selected.has(String(r._id)))
                : filtered;
        return source.map((r) => ({
            Name: r.name,
            Code: r.code ?? '',
            Category: r.category ?? '',
            BillableBy: r.billableBy ?? '',
            DefaultPrice: r.defaultPrice ?? 0,
            Currency: r.currency ?? '',
            TaxRate: r.taxRate ?? 0,
            DurationMinutes: r.durationMinutes ?? '',
            Status: r.status ?? 'active',
            CreatedAt: r.createdAt
                ? new Date(r.createdAt as unknown as string).toISOString()
                : '',
        }));
    }, [rows, selected, filtered]);

    const exportCsv = () => {
        downloadCsv(`services-${dateStamp()}.csv`, exportHeaders, exportRows);
    };
    const exportXlsx = () => {
        void downloadXlsx(
            `services-${dateStamp()}.xlsx`,
            exportHeaders,
            exportRows,
            'Services',
        );
    };

    return (
        <>
            <ServiceDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={refresh}
                initialData={editing}
            />

            <EntityListShell
                    title="Service Catalog"
                    subtitle="Reusable, non-tangible offerings — billed by hour, fixed price, or per project."
                    primaryAction={
                        <ZoruButton onClick={() => handleOpenDialog(null)}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> New service
                        </ZoruButton>
                    }
                    search={{
                        value: search,
                        onChange: setSearch,
                        placeholder: 'Search services…',
                    }}
                    filters={
                        <div className="flex flex-wrap items-center gap-2">
                            <ZoruSelect
                                value={statusFilter}
                                onValueChange={(v) =>
                                    setStatusFilter(v as CrmServiceStatus | 'all')
                                }
                            >
                                <ZoruSelectTrigger className="h-9 w-[160px]">
                                    <ZoruSelectValue placeholder="Status" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {STATUS_OPTIONS.map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                            <ZoruSelect
                                value={billableFilter}
                                onValueChange={(v) =>
                                    setBillableFilter(
                                        v as CrmServiceBillableBy | 'all',
                                    )
                                }
                            >
                                <ZoruSelectTrigger className="h-9 w-[180px]">
                                    <ZoruSelectValue placeholder="Billing" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {BILLABLE_OPTIONS.map((o) => (
                                        <ZoruSelectItem key={o.value} value={o.value}>
                                            {o.label}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                            <ZoruSelect
                                value={categoryFilter || 'all'}
                                onValueChange={(v) =>
                                    setCategoryFilter(v === 'all' ? '' : v)
                                }
                            >
                                <ZoruSelectTrigger className="h-9 w-[180px]">
                                    <ZoruSelectValue placeholder="Category" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="all">
                                        All categories
                                    </ZoruSelectItem>
                                    {categoryOptions.map((c) => (
                                        <ZoruSelectItem key={c} value={c}>
                                            {c}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                            {hasActiveFilters ? (
                                <ZoruButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearFilters}
                                >
                                    Clear filters
                                </ZoruButton>
                            ) : null}
                        </div>
                    }
                    bulkBar={
                        selected.size > 0 ? (
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
                                    <ZoruBadge variant="info">
                                        {selected.size} selected
                                    </ZoruBadge>
                                    <button
                                        type="button"
                                        onClick={() => setSelected(new Set())}
                                        className="text-zoru-ink-muted hover:text-zoru-ink"
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <ZoruButton
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void runBulk('archive')}
                                    >
                                        <Archive className="h-3.5 w-3.5" /> Archive
                                    </ZoruButton>
                                    <ZoruButton
                                        variant="outline"
                                        size="sm"
                                        onClick={() => void runBulk('unarchive')}
                                    >
                                        <ArchiveRestore className="h-3.5 w-3.5" />{' '}
                                        Restore
                                    </ZoruButton>
                                    <ZoruButton
                                        variant="outline"
                                        size="sm"
                                        onClick={exportCsv}
                                    >
                                        <Download className="h-3.5 w-3.5" /> Export CSV
                                    </ZoruButton>
                                    <ZoruButton
                                        variant="outline"
                                        size="sm"
                                        onClick={exportXlsx}
                                    >
                                        <FileSpreadsheet className="h-3.5 w-3.5" />{' '}
                                        Export XLSX
                                    </ZoruButton>
                                    <ZoruButton
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setBulkDeleteOpen(true)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" /> Delete
                                    </ZoruButton>
                                </div>
                            </div>
                        ) : null
                    }
                    loading={isLoading && rows.length === 0}
                    pagination={
                        totalFiltered > SERVICES_PER_PAGE ? (
                            <PaginationBar
                                page={page}
                                limit={SERVICES_PER_PAGE}
                                hasMore={page < totalPages}
                                total={totalFiltered}
                                controlled={{
                                    onChange: (next) => setPage(next.page),
                                }}
                            />
                        ) : null
                    }
                >
                    <div className="flex flex-col gap-4">
                        {/* KPI strip */}
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <ZoruStatCard
                                label="Total services"
                                value={kpis.total.toLocaleString()}
                                icon={<Layers className="h-4 w-4" />}
                            />
                            <ZoruStatCard
                                label="Active"
                                value={kpis.active.toLocaleString()}
                                icon={<CheckCircle2 className="h-4 w-4" />}
                            />
                            <ZoruStatCard
                                label="Total billed"
                                value={`${kpis.totalBilled.toLocaleString()}`}
                                icon={<DollarSign className="h-4 w-4" />}
                            />
                            <ZoruStatCard
                                label="Top revenue service"
                                value={
                                    <span className="text-[13px] font-medium leading-tight">
                                        {kpis.topRevenueService
                                            ? `${kpis.topRevenueService.name} (${kpis.topRevenueService.defaultPrice.toLocaleString()})`
                                            : '—'}
                                    </span>
                                }
                                icon={<Award className="h-4 w-4" />}
                            />
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-zoru-line">
                            <ZoruTable>
                                <ZoruTableHeader>
                                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                        <ZoruTableHead className="w-10">
                                            <input
                                                type="checkbox"
                                                aria-label="Select all visible services"
                                                checked={
                                                    paged.length > 0 &&
                                                    paged.every((r) =>
                                                        selected.has(String(r._id)),
                                                    )
                                                }
                                                onChange={(e) =>
                                                    toggleAll(e.target.checked)
                                                }
                                            />
                                        </ZoruTableHead>
                                        <ZoruTableHead>Name</ZoruTableHead>
                                        <ZoruTableHead>Code</ZoruTableHead>
                                        <ZoruTableHead>Category</ZoruTableHead>
                                        <ZoruTableHead>Billing</ZoruTableHead>
                                        <ZoruTableHead className="text-right">
                                            Default price
                                        </ZoruTableHead>
                                        <ZoruTableHead>Status</ZoruTableHead>
                                        <ZoruTableHead className="text-right">
                                            Actions
                                        </ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {isLoading ? (
                                        <ZoruTableRow className="border-zoru-line">
                                            <ZoruTableCell
                                                colSpan={8}
                                                className="h-20 text-center"
                                            >
                                                <LoaderCircle className="mx-auto h-5 w-5 animate-spin text-zoru-ink-muted" />
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ) : paged.length === 0 ? (
                                        <ZoruTableRow className="border-zoru-line">
                                            <ZoruTableCell
                                                colSpan={8}
                                                className="h-20 text-center text-[13px] text-zoru-ink-muted"
                                            >
                                                No services match this filter.
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ) : (
                                        paged.map((r) => {
                                            const id = String(r._id);
                                            const status = (r.status ??
                                                'active') as CrmServiceStatus;
                                            const tone =
                                                STATUS_TONE[status] ?? 'neutral';
                                            const billable = (r.billableBy ??
                                                'hour') as CrmServiceBillableBy;
                                            return (
                                                <ZoruTableRow
                                                    key={id}
                                                    className="border-zoru-line"
                                                >
                                                    <ZoruTableCell>
                                                        <input
                                                            type="checkbox"
                                                            aria-label={`Select ${r.name}`}
                                                            checked={selected.has(
                                                                id,
                                                            )}
                                                            onChange={() =>
                                                                toggleOne(id)
                                                            }
                                                        />
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="font-medium text-zoru-ink">
                                                        <div className="flex items-center gap-2">
                                                            {r.imageUrl ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img
                                                                    src={r.imageUrl}
                                                                    alt=""
                                                                    className="h-6 w-6 rounded object-cover"
                                                                />
                                                            ) : (
                                                                <div className="flex h-6 w-6 items-center justify-center rounded bg-zoru-surface-2">
                                                                    <Briefcase
                                                                        className="h-3 w-3 text-zoru-ink-muted"
                                                                        strokeWidth={
                                                                            1.75
                                                                        }
                                                                    />
                                                                </div>
                                                            )}
                                                            <span>{r.name}</span>
                                                        </div>
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="font-mono text-[12px] text-zoru-ink-muted">
                                                        {r.code || '—'}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                                                        {r.category || '—'}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-[12.5px] text-zoru-ink">
                                                        {BILLABLE_LABELS[billable]}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                                        {r.defaultPrice != null
                                                            ? `${r.currency ?? 'INR'} ${(
                                                                  r.defaultPrice ?? 0
                                                              ).toFixed(2)}`
                                                            : '—'}
                                                    </ZoruTableCell>
                                                    <ZoruTableCell>
                                                        <StatusPill
                                                            label={status}
                                                            tone={tone}
                                                        />
                                                    </ZoruTableCell>
                                                    <ZoruTableCell className="text-right">
                                                        <ZoruButton
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                handleOpenDialog(r)
                                                            }
                                                            aria-label={`Edit ${r.name}`}
                                                        >
                                                            <Edit className="h-4 w-4" />
                                                        </ZoruButton>
                                                        <ZoruButton
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() =>
                                                                setPendingDelete(r)
                                                            }
                                                            aria-label={`Archive ${r.name}`}
                                                        >
                                                            <Trash2 className="h-4 w-4 text-destructive" />
                                                        </ZoruButton>
                                                    </ZoruTableCell>
                                                </ZoruTableRow>
                                            );
                                        })
                                    )}
                                </ZoruTableBody>
                            </ZoruTable>
                        </div>
                    </div>
            </EntityListShell>

            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Archive service?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Archiving &ldquo;{pendingDelete?.name}&rdquo; flips it to
                            archived. Existing line items keep the service name, but
                            you won&rsquo;t be able to add it to new quotes or
                            invoices.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            {deletePending ? 'Archiving…' : 'Archive'}
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>

            <ConfirmDialog
                open={bulkArchiveOpen}
                onOpenChange={(o) => !o && setBulkArchiveOpen(false)}
                title={`Archive ${selected.size} service${selected.size === 1 ? '' : 's'}?`}
                description="Selected services will be archived. Existing line items keep their name, but the services won't be addable to new quotes or invoices."
                confirmLabel="Archive"
                confirmTone="primary"
                onConfirm={() => void runBulk('archive')}
            />

            <ConfirmDialog
                open={bulkDeleteOpen}
                onOpenChange={(o) => !o && setBulkDeleteOpen(false)}
                title={`Delete ${selected.size} service${selected.size === 1 ? '' : 's'}?`}
                description="This permanently removes the selected services. This action cannot be undone."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={() => void runBulk('delete')}
            />
        </>
    );
}
