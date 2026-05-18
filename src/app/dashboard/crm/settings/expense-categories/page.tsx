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
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
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
import { Edit,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * Expense Categories — settings-style list (§1D.4 specialized: settings list).
 *
 * Mirrors `dashboard/crm/accounting/groups/page.tsx`:
 *   - EntityListShell + ZoruTable for the row surface
 *   - Inline-create / edit ZoruDialog with the full field set
 *   - ZoruAlertDialog for delete confirmation
 *   - Filters: search · status · billable · reimbursable
 *
 * Backed by the Rust BFF (`crmExpenseCategoriesApi`) via the
 * `crm-expense-categories.actions.ts` server actions.
 */

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill } from '@/components/crm/status-pill';

import {
    deleteExpenseCategory,
    getExpenseCategories,
    saveExpenseCategory,
} from '@/app/actions/crm-expense-categories.actions';
import { getCrmChartOfAccounts } from '@/app/actions/crm-accounting.actions';
import type { CrmExpenseCategoryDoc } from '@/lib/rust-client/crm-expense-categories';

/* ─── Types ──────────────────────────────────────────────────── */

type Category = CrmExpenseCategoryDoc;

interface CoaRow {
    _id: string;
    name?: string;
}

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
    accounts,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    initialData: Category | null;
    parents: Category[];
    accounts: CoaRow[];
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

    React.useEffect(() => {
        setParentId(initialData?.parentId ?? '');
        setDefaultAccountId(initialData?.defaultAccountId ?? '');
        setIsBillable(initialData?.isBillable ?? false);
        setIsReimbursable(initialData?.isReimbursable ?? false);
        setIsActive(initialData?.isActive ?? true);
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

    // Filter out self when editing so a category can't be its own parent.
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
                    {/* ZoruSwitch is controlled — mirror its value into the form. */}
                    <input type="hidden" name="isBillable" value={isBillable ? 'true' : 'false'} />
                    <input
                        type="hidden"
                        name="isReimbursable"
                        value={isReimbursable ? 'true' : 'false'}
                    />
                    <input type="hidden" name="isActive" value={isActive ? 'true' : 'false'} />
                    <input type="hidden" name="parentId" value={parentId} />
                    <input type="hidden" name="defaultAccountId" value={defaultAccountId} />

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
                            {/* TODO 1E.sweep: dynamic list — needs EntityKey */}
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
                            <ZoruLabel htmlFor="defaultAccountId">Default GL account</ZoruLabel>
                            {accounts.length > 0 ? (
                                /* TODO 1E.sweep: dynamic list — needs EntityKey */
                                <ZoruSelect
                                    value={defaultAccountId || 'none'}
                                    onValueChange={(v) =>
                                        setDefaultAccountId(v === 'none' ? '' : v)
                                    }
                                >
                                    <ZoruSelectTrigger id="defaultAccountId">
                                        <ZoruSelectValue placeholder="Pick a GL account…" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="none">None</ZoruSelectItem>
                                        {accounts.map((a) => (
                                            <ZoruSelectItem key={a._id} value={a._id}>
                                                {a.name ?? a._id}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            ) : (
                                <ZoruInput
                                    id="defaultAccountIdInput"
                                    value={defaultAccountId}
                                    onChange={(e) => setDefaultAccountId(e.target.value)}
                                    placeholder="Paste a Chart-of-Accounts ObjectId"
                                />
                            )}
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
                            <ZoruLabel htmlFor="color">Color</ZoruLabel>
                            <ZoruInput
                                id="color"
                                name="color"
                                type="text"
                                placeholder="#7C3AED"
                                defaultValue={initialData?.color}
                            />
                        </div>

                        <div className="space-y-2">
                            <ZoruLabel htmlFor="icon">Icon</ZoruLabel>
                            <ZoruInput
                                id="icon"
                                name="icon"
                                placeholder="e.g. plane"
                                defaultValue={initialData?.icon}
                            />
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
    const [accounts, setAccounts] = React.useState<CoaRow[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [editing, setEditing] = React.useState<Category | null>(null);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
    const [billableFilter, setBillableFilter] = React.useState<BoolFilter>('all');
    const [reimbursableFilter, setReimbursableFilter] = React.useState<BoolFilter>('all');
    const [pendingDelete, setPendingDelete] = React.useState<Category | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const { toast } = useZoruToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        const list = await getExpenseCategories();
        setCategories(list);
        setIsLoading(false);
    }, []);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    // CoA list is lazy — only fetched once for the dialog. If the action
    // fails (e.g. permission), we fall back to a plain ObjectId text input.
    React.useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const list = (await getCrmChartOfAccounts()) as Array<{
                    _id: string;
                    name?: string;
                }>;
                if (!cancelled) {
                    setAccounts(
                        list.map((a) => ({
                            _id: String(a._id),
                            name: a.name,
                        })),
                    );
                }
            } catch {
                /* CoA optional */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

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

    const formatMoney = (n?: number) =>
        typeof n === 'number' && Number.isFinite(n)
            ? new Intl.NumberFormat('en-IN', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
              }).format(n)
            : '—';

    return (
        <>
            <ExpenseCategoryDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={refresh}
                initialData={editing}
                parents={categories}
                accounts={accounts}
            />

            <EntityListShell
                    title="Expense Categories"
                    subtitle="Classify expenses for accounting, billing, and reimbursement."
                    primaryAction={
                        <ZoruButton onClick={() => handleOpenDialog(null)}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Category
                        </ZoruButton>
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
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-border hover:bg-transparent">
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
                                        <ZoruTableCell colSpan={9} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : filtered.length === 0 ? (
                                    <ZoruTableRow className="border-border">
                                        <ZoruTableCell
                                            colSpan={9}
                                            className="h-24 text-center text-muted-foreground"
                                        >
                                            No expense categories match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    filtered.map((c) => (
                                        <ZoruTableRow key={c._id} className="border-border">
                                            <ZoruTableCell className="font-medium text-foreground">
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

