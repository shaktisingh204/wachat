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
  ZoruButton,
  ZoruCheckbox,
  ZoruColorPicker,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruIconPicker,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruStatCard,
  ZoruSwitch,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Download, Edit, LoaderCircle, Plus, Trash2 } from 'lucide-react';

/**
 * Expense Categories — settings-style list.
 *
 * Additions over the original:
 *  - ZoruCheckbox multi-select column
 *  - Bulk bar: delete with confirm + activate + deactivate
 */

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { RowDrawer } from '@/components/crm/row-drawer';
import { StatusPill } from '@/components/crm/status-pill';

import {
    bulkActivateExpenseCategories,
    bulkDeactivateExpenseCategories,
    bulkDeleteExpenseCategories,
    deleteExpenseCategory,
    getExpenseCategories,
    saveExpenseCategory,
} from '@/app/actions/crm-expense-categories.actions';
import type { CrmExpenseCategoryDoc } from '@/lib/rust-client/crm-expense-categories';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

/* ─── Types ──────────────────────────────────────────────────── */

type Category = CrmExpenseCategoryDoc;

type BoolFilter = 'all' | 'true' | 'false';
type StatusFilter = 'all' | 'active' | 'archived';

const saveInitialState: {
    message?: string;
    error?: string;
    id?: string;
} = {};

/* ─── Submit button ─────────────────────────────────────────── */

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Save changes' : 'Create category'}
        </ZoruButton>
    );
}

/* ─── Dialog ────────────────────────────────────────────────── */

function ExpenseCategoryDialog({
    isOpen,
    onOpenChange,
    onSave,
    initialData,
    parents,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    initialData: Category | null;
    parents: Category[];
}) {
    const isEditing = !!initialData;
    const [state, formAction] = useActionState(saveExpenseCategory, saveInitialState);
    const { toast } = useZoruToast();

    const [parentId, setParentId] = React.useState<string>(initialData?.parentId ?? '');
    const [defaultAccountId, setDefaultAccountId] = React.useState<string>(
        initialData?.defaultAccountId ?? '',
    );
    const [isBillable, setIsBillable] = React.useState<boolean>(
        initialData?.isBillable ?? false,
    );
    const [isReimbursable, setIsReimbursable] = React.useState<boolean>(
        initialData?.isReimbursable ?? false,
    );
    const [isActive, setIsActive] = React.useState<boolean>(initialData?.isActive ?? true);
    const [color, setColor] = React.useState<string>(initialData?.color ?? '#7C3AED');
    const [icon, setIcon] = React.useState<string>(initialData?.icon ?? '');

    React.useEffect(() => {
        setParentId(initialData?.parentId ?? '');
        setDefaultAccountId(initialData?.defaultAccountId ?? '');
        setIsBillable(initialData?.isBillable ?? false);
        setIsReimbursable(initialData?.isReimbursable ?? false);
        setIsActive(initialData?.isActive ?? true);
        setColor(initialData?.color ?? '#7C3AED');
        setIcon(initialData?.icon ?? '');
    }, [initialData]);

    React.useEffect(() => {
        if (state.message) {
            toast({ title: 'Success', description: state.message });
            onSave();
            onOpenChange(false);
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onSave, onOpenChange]);

    const parentOptions = React.useMemo(
        () => parents.filter((p) => !initialData || p._id !== initialData._id),
        [parents, initialData],
    );

    return (
        <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-2xl">
                <form action={formAction}>
                    {isEditing ? (
                        <input type="hidden" name="_id" value={initialData!._id} />
                    ) : null}
                    <input type="hidden" name="isBillable" value={isBillable ? 'true' : 'false'} />
                    <input
                        type="hidden"
                        name="isReimbursable"
                        value={isReimbursable ? 'true' : 'false'}
                    />
                    <input type="hidden" name="isActive" value={isActive ? 'true' : 'false'} />
                    <input type="hidden" name="parentId" value={parentId} />
                    <input type="hidden" name="defaultAccountId" value={defaultAccountId} />
                    <input type="hidden" name="color" value={color} />
                    <input type="hidden" name="icon" value={icon} />

                    <ZoruDialogHeader>
                        <ZoruDialogTitle>
                            {isEditing ? 'Edit' : 'Create new'} expense category
                        </ZoruDialogTitle>
                    </ZoruDialogHeader>

                    <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                            <ZoruLabel htmlFor="name">Name *</ZoruLabel>
                            <ZoruInput
                                id="name"
                                name="name"
                                placeholder="e.g. Travel & Transport"
                                required
                                defaultValue={initialData?.name}
                            />
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel htmlFor="code">Code</ZoruLabel>
                            <ZoruInput
                                id="code"
                                name="code"
                                placeholder="e.g. TRV"
                                defaultValue={initialData?.code}
                            />
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel htmlFor="parentId">Parent category</ZoruLabel>
                            <ZoruSelect
                                value={parentId || 'none'}
                                onValueChange={(v) => setParentId(v === 'none' ? '' : v)}
                            >
                                <ZoruSelectTrigger id="parentId">
                                    <ZoruSelectValue placeholder="Top-level…" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="none">Top-level (none)</ZoruSelectItem>
                                    {parentOptions.map((p) => (
                                        <ZoruSelectItem key={p._id} value={p._id}>
                                            {p.name}
                                        </ZoruSelectItem>
                                    ))}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                            <ZoruLabel htmlFor="description">Description</ZoruLabel>
                            <ZoruTextarea
                                id="description"
                                name="description"
                                rows={2}
                                placeholder="Short note about what this category covers."
                                defaultValue={initialData?.description}
                            />
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                            <ZoruLabel>Default GL account</ZoruLabel>
                            <EntityFormField
                                entity="account"
                                name="__defaultAccountId_picker"
                                initialId={defaultAccountId || null}
                                onChange={(id) => setDefaultAccountId(id ?? '')}
                                placeholder="Pick a GL account…"
                            />
                            <p className="text-xs text-muted-foreground">
                                Posts to this account when an expense in this category is
                                booked.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel htmlFor="taxRate">Tax rate (%)</ZoruLabel>
                            <ZoruInput
                                id="taxRate"
                                name="taxRate"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                defaultValue={initialData?.taxRate}
                            />
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel htmlFor="maxAmount">Max amount</ZoruLabel>
                            <ZoruInput
                                id="maxAmount"
                                name="maxAmount"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                defaultValue={initialData?.maxAmount}
                            />
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                            <ZoruLabel htmlFor="requiresReceiptAbove">
                                Requires receipt above
                            </ZoruLabel>
                            <ZoruInput
                                id="requiresReceiptAbove"
                                name="requiresReceiptAbove"
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                defaultValue={initialData?.requiresReceiptAbove}
                            />
                            <p className="text-xs text-muted-foreground">
                                Submissions over this amount need a receipt attachment.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel>Color</ZoruLabel>
                            <ZoruColorPicker value={color} onChange={setColor} />
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel>Icon</ZoruLabel>
                            <ZoruIconPicker value={icon} onChange={setIcon} color={color} />
                        </div>

                        <div className="flex items-center justify-between rounded-md border border-border p-3">
                            <div>
                                <ZoruLabel htmlFor="isBillable">Billable</ZoruLabel>
                                <p className="text-xs text-muted-foreground">
                                    Pass-through to customers.
                                </p>
                            </div>
                            <ZoruSwitch
                                id="isBillable"
                                checked={isBillable}
                                onCheckedChange={setIsBillable}
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-md border border-border p-3">
                            <div>
                                <ZoruLabel htmlFor="isReimbursable">Reimbursable</ZoruLabel>
                                <p className="text-xs text-muted-foreground">
                                    Refundable to employees.
                                </p>
                            </div>
                            <ZoruSwitch
                                id="isReimbursable"
                                checked={isReimbursable}
                                onCheckedChange={setIsReimbursable}
                            />
                        </div>

                        <div className="flex items-center justify-between rounded-md border border-border p-3 sm:col-span-2">
                            <div>
                                <ZoruLabel htmlFor="isActive">Active</ZoruLabel>
                                <p className="text-xs text-muted-foreground">
                                    Inactive categories are hidden from expense forms.
                                </p>
                            </div>
                            <ZoruSwitch
                                id="isActive"
                                checked={isActive}
                                onCheckedChange={setIsActive}
                            />
                        </div>
                    </div>

                    <ZoruDialogFooter>
                        <ZoruButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </ZoruButton>
                        <SubmitButton isEditing={isEditing} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

/* ─── Page ──────────────────────────────────────────────────── */

export default function ExpenseCategoriesPage() {
    const [categories, setCategories] = React.useState<Category[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [editing, setEditing] = React.useState<Category | null>(null);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [billableFilter, setBillableFilter] = React.useState<BoolFilter>('all');
    const [reimbursableFilter, setReimbursableFilter] = React.useState<BoolFilter>('all');
    const [pendingDelete, setPendingDelete] = React.useState<Category | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const [bulkPending, startBulkTransition] = React.useTransition();
    const { toast } = useZoruToast();

    // Selection
    const [selected, setSelected] = React.useState<Set<string>>(new Set());

    // Bulk dialog state
    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        const list = await getExpenseCategories();
        setCategories(list);
        setIsLoading(false);
    }, []);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    const parentNameById = React.useMemo(() => {
        const m = new Map<string, string>();
        for (const c of categories) m.set(c._id, c.name);
        return m;
    }, [categories]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return categories.filter((c) => {
            if (statusFilter !== 'all' && c.status !== statusFilter) return false;
            if (billableFilter !== 'all') {
                const want = billableFilter === 'true';
                if (c.isBillable !== want) return false;
            }
            if (reimbursableFilter !== 'all') {
                const want = reimbursableFilter === 'true';
                if (c.isReimbursable !== want) return false;
            }
            if (!q) return true;
            return `${c.name} ${c.code ?? ''} ${c.description ?? ''}`
                .toLowerCase()
                .includes(q);
        });
    }, [categories, search, statusFilter, billableFilter, reimbursableFilter]);

    // Selection helpers
    const filteredIds = React.useMemo(
        () => filtered.map((c) => c._id),
        [filtered],
    );
    const allChecked =
        filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
    const someChecked = filteredIds.some((id) => selected.has(id));

    const toggleAll = () => {
        if (allChecked) {
            setSelected((prev) => {
                const next = new Set(prev);
                filteredIds.forEach((id) => next.delete(id));
                return next;
            });
        } else {
            setSelected((prev) => {
                const next = new Set(prev);
                filteredIds.forEach((id) => next.add(id));
                return next;
            });
        }
    };

    const toggleOne = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectedIds = React.useMemo(
        () => [...selected].filter((id) => filteredIds.includes(id)),
        [selected, filteredIds],
    );
    const hasSelection = selectedIds.length > 0;

    const handleOpenDialog = (cat: Category | null) => {
        setEditing(cat);
        setIsDialogOpen(true);
    };

    const handleDelete = () => {
        if (!pendingDelete) return;
        startDeleteTransition(async () => {
            const result = await deleteExpenseCategory(pendingDelete._id);
            if (result.success) {
                toast({ title: 'Category deleted' });
                setPendingDelete(null);
                await refresh();
            } else {
                toast({
                    title: 'Error',
                    description: result.error,
                    variant: 'destructive',
                });
            }
        });
    };

    // Bulk delete
    const handleBulkDelete = () => {
        startBulkTransition(async () => {
            const res = await bulkDeleteExpenseCategories(selectedIds);
            if (res.ok) {
                toast({ title: `${res.count} category/categories deleted` });
                setSelected(new Set());
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
            setBulkDeleteOpen(false);
            await refresh();
        });
    };

    // Bulk activate
    const handleBulkActivate = () => {
        startBulkTransition(async () => {
            const res = await bulkActivateExpenseCategories(selectedIds);
            if (res.ok) {
                toast({ title: `${res.count} category/categories activated` });
                setSelected(new Set());
                await refresh();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        });
    };

    // Bulk deactivate
    const handleBulkDeactivate = () => {
        startBulkTransition(async () => {
            const res = await bulkDeactivateExpenseCategories(selectedIds);
            if (res.ok) {
                toast({ title: `${res.count} category/categories deactivated` });
                setSelected(new Set());
                await refresh();
            } else {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            }
        });
    };

    const formatMoney = (n?: number) =>
        typeof n === 'number' && Number.isFinite(n)
            ? new Intl.NumberFormat('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
              }).format(n)
            : '—';

    // KPI derivations
    const totalCategories = categories.length;
    const activeCategories = categories.filter((c) => c.status === 'active').length;
    const inactiveCategories = categories.filter((c) => c.status !== 'active').length;
    // Top category by sub-category count (children whose parentId points to it)
    const childCountById = new Map<string, number>();
    for (const c of categories) {
        if (c.parentId) {
            childCountById.set(c.parentId, (childCountById.get(c.parentId) ?? 0) + 1);
        }
    }
    let topCategoryName = '—';
    let topCategoryCount = 0;
    for (const [id, count] of childCountById) {
        if (count > topCategoryCount) {
            topCategoryCount = count;
            topCategoryName = categories.find((c) => c._id === id)?.name ?? '—';
        }
    }

    // Export CSV
    const handleExport = () => {
        const exportRows = filtered.map((c) => ({
            Name: c.name,
            Code: c.code ?? '',
            Parent: c.parentId ? (parentNameById.get(c.parentId) ?? '') : '',
            Status: c.status,
            Billable: c.isBillable ? 'Yes' : 'No',
            Reimbursable: c.isReimbursable ? 'Yes' : 'No',
            'Tax rate': typeof c.taxRate === 'number' ? c.taxRate : '',
            'Max amount': typeof c.maxAmount === 'number' ? c.maxAmount : '',
        }));
        downloadCsv(
            `expense-categories-${dateStamp()}.csv`,
            Object.keys(exportRows[0] ?? {}),
            exportRows,
        );
        toast({ title: 'CSV exported' });
    };

    return (
        <>
            <ExpenseCategoryDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={refresh}
                initialData={editing}
                parents={categories}
            />

            <EntityListShell
                title="Expense Categories"
                subtitle="Classify expenses for accounting, billing, and reimbursement."
                primaryAction={
                    <div className="flex items-center gap-2">
                        <ZoruButton
                            variant="outline"
                            onClick={handleExport}
                            disabled={filtered.length === 0}
                        >
                            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
                        </ZoruButton>
                        <ZoruButton onClick={() => handleOpenDialog(null)}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Category
                        </ZoruButton>
                    </div>
                }
                search={{
                    value: search,
                    onChange: setSearch,
                    placeholder: 'Search categories…',
                }}
                filters={
                    <div className="flex flex-wrap items-center gap-2">
                        <ZoruSelect
                            value={statusFilter}
                            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[150px]">
                                <ZoruSelectValue placeholder="Status" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                                <ZoruSelectItem value="active">Active</ZoruSelectItem>
                                <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                        <ZoruSelect
                            value={billableFilter}
                            onValueChange={(v) => setBillableFilter(v as BoolFilter)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[150px]">
                                <ZoruSelectValue placeholder="Billable" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">Billable: any</ZoruSelectItem>
                                <ZoruSelectItem value="true">Billable: yes</ZoruSelectItem>
                                <ZoruSelectItem value="false">Billable: no</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                        <ZoruSelect
                            value={reimbursableFilter}
                            onValueChange={(v) => setReimbursableFilter(v as BoolFilter)}
                        >
                            <ZoruSelectTrigger className="h-9 w-[170px]">
                                <ZoruSelectValue placeholder="Reimbursable" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="all">Reimbursable: any</ZoruSelectItem>
                                <ZoruSelectItem value="true">Reimbursable: yes</ZoruSelectItem>
                                <ZoruSelectItem value="false">Reimbursable: no</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                }
                loading={isLoading && categories.length === 0}
            >
                {/* KPI strip */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-3">
                    <ZoruStatCard label="Total categories" value={totalCategories.toLocaleString()} />
                    <ZoruStatCard label="Active" value={activeCategories.toLocaleString()} />
                    <ZoruStatCard label="Inactive" value={inactiveCategories.toLocaleString()} />
                    <ZoruStatCard
                        label="Top by sub-categories"
                        value={topCategoryName}
                    />
                </div>

                {/* Bulk bar */}
                {hasSelection && (
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm mb-3">
                        <span className="font-medium text-foreground">
                            {selectedIds.length} selected
                        </span>
                        <ZoruButton
                            variant="outline"
                            size="sm"
                            disabled={bulkPending}
                            onClick={handleBulkActivate}
                        >
                            {bulkPending ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                            Activate
                        </ZoruButton>
                        <ZoruButton
                            variant="outline"
                            size="sm"
                            disabled={bulkPending}
                            onClick={handleBulkDeactivate}
                        >
                            Deactivate
                        </ZoruButton>
                        <ZoruAlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                            <ZoruButton
                                variant="destructive"
                                size="sm"
                                disabled={bulkPending}
                                onClick={() => setBulkDeleteOpen(true)}
                            >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                                Delete selected
                            </ZoruButton>
                            <ZoruAlertDialogContent>
                                <ZoruAlertDialogHeader>
                                    <ZoruAlertDialogTitle>
                                        Delete {selectedIds.length} category/categories?
                                    </ZoruAlertDialogTitle>
                                    <ZoruAlertDialogDescription>
                                        This will affect any expense records that reference these
                                        categories. This action cannot be undone.
                                    </ZoruAlertDialogDescription>
                                </ZoruAlertDialogHeader>
                                <ZoruAlertDialogFooter>
                                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                                    <ZoruAlertDialogAction
                                        onClick={handleBulkDelete}
                                        disabled={bulkPending}
                                    >
                                        {bulkPending ? (
                                            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                        ) : null}
                                        Delete
                                    </ZoruAlertDialogAction>
                                </ZoruAlertDialogFooter>
                            </ZoruAlertDialogContent>
                        </ZoruAlertDialog>
                        <ZoruButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelected(new Set())}
                        >
                            Clear selection
                        </ZoruButton>
                    </div>
                )}

                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="w-10">
                                    <ZoruCheckbox
                                        checked={allChecked}
                                        aria-checked={someChecked && !allChecked ? 'mixed' : allChecked}
                                        onCheckedChange={toggleAll}
                                        aria-label="Select all"
                                        disabled={filtered.length === 0}
                                    />
                                </ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Name</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Code</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Parent</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">
                                    Tax %
                                </ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Reimbursable</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Billable</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">
                                    Max Amount
                                </ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground text-right">
                                    Actions
                                </ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell colSpan={10} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : filtered.length === 0 ? (
                                <ZoruTableRow className="border-border">
                                    <ZoruTableCell
                                        colSpan={10}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        No expense categories match this filter.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                filtered.map((c) => (
                                    <ZoruTableRow key={c._id} className="border-border">
                                        <ZoruTableCell>
                                            <ZoruCheckbox
                                                checked={selected.has(c._id)}
                                                onCheckedChange={() => toggleOne(c._id)}
                                                aria-label={`Select ${c.name}`}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-medium text-foreground">
                                            <RowDrawer
                                                label={
                                                    <span className="inline-flex items-center gap-2">
                                                        {c.color ? (
                                                            <span
                                                                className="inline-block h-2.5 w-2.5 rounded-full"
                                                                style={{ backgroundColor: c.color }}
                                                                aria-hidden="true"
                                                            />
                                                        ) : null}
                                                        {c.name}
                                                    </span>
                                                }
                                                subtitle={c.code ?? undefined}
                                                title={`Expense Category · ${c.name}`}
                                                description="Read-only category details. Use the row Edit action to modify."
                                            >
                                                <div className="space-y-3 text-sm">
                                                    {c.description ? (
                                                        <div>
                                                            <div className="text-muted-foreground text-xs">Description</div>
                                                            <div>{c.description}</div>
                                                        </div>
                                                    ) : null}
                                                    <div>
                                                        <div className="text-muted-foreground text-xs">Code</div>
                                                        <div className="font-mono">{c.code ?? '—'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground text-xs">Parent</div>
                                                        <div>
                                                            {c.parentId
                                                                ? parentNameById.get(c.parentId) ?? '—'
                                                                : '—'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground text-xs">Tax rate</div>
                                                        <div className="font-mono">
                                                            {typeof c.taxRate === 'number'
                                                                ? `${c.taxRate.toFixed(2)}%`
                                                                : '—'}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground text-xs">Max amount</div>
                                                        <div className="font-mono">{formatMoney(c.maxAmount)}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground text-xs">Billable</div>
                                                        <div>{c.isBillable ? 'Yes' : 'No'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground text-xs">Reimbursable</div>
                                                        <div>{c.isReimbursable ? 'Yes' : 'No'}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground text-xs">Status</div>
                                                        <div>{c.status === 'active' ? 'Active' : 'Archived'}</div>
                                                    </div>
                                                </div>
                                            </RowDrawer>
                                        </ZoruTableCell>
                                        <ZoruTableCell className="font-mono text-foreground">
                                            {c.code ?? '—'}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-foreground">
                                            {c.parentId
                                                ? parentNameById.get(c.parentId) ?? '—'
                                                : '—'}
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right font-mono text-foreground">
                                            {typeof c.taxRate === 'number'
                                                ? `${c.taxRate.toFixed(2)}%`
                                                : '—'}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <StatusPill
                                                label={c.isReimbursable ? 'Yes' : 'No'}
                                                tone={c.isReimbursable ? 'green' : 'neutral'}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <StatusPill
                                                label={c.isBillable ? 'Yes' : 'No'}
                                                tone={c.isBillable ? 'blue' : 'neutral'}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right font-mono text-foreground">
                                            {formatMoney(c.maxAmount)}
                                        </ZoruTableCell>
                                        <ZoruTableCell>
                                            <StatusPill
                                                label={c.status === 'active' ? 'Active' : 'Archived'}
                                                tone={c.status === 'active' ? 'green' : 'neutral'}
                                            />
                                        </ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <ZoruButton
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleOpenDialog(c)}
                                                aria-label={`Edit ${c.name}`}
                                            >
                                                <Edit className="h-4 w-4" />
                                            </ZoruButton>
                                            <ZoruButton
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => setPendingDelete(c)}
                                                aria-label={`Delete ${c.name}`}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </ZoruButton>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
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
                        <ZoruAlertDialogTitle>Delete expense category?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; will affect any
                            expense records that reference it. This action cannot be undone.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction
                            onClick={handleDelete}
                            disabled={deletePending}
                        >
                            {deletePending ? (
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            Delete
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
