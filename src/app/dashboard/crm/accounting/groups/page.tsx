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
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  Edit,
  LoaderCircle,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

/**
 * Account Groups — settings-style list (§1D.4 specialized: settings list).
 * Added: KPI strip (total / parent / child / avg accounts per group),
 * bulk delete with checkbox selection, EntityRowLink on name column,
 * Export CSV.
 */

import * as React from 'react';
import Papa from 'papaparse';

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import type { WithId } from 'mongodb';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
    bulkDeleteCrmAccountGroups,
    deleteCrmAccountGroup,
    getCrmAccountGroupsWithCounts,
    saveCrmAccountGroup,
} from '@/app/actions/crm-accounting.actions';
import type { CrmAccountGroup } from '@/lib/definitions';

type GroupRow = WithId<CrmAccountGroup> & { accountCount?: number };

const accountNatures: CrmAccountGroup['type'][] = [
    'Asset',
    'Liability',
    'Income',
    'Expense',
    'Capital',
];

const categoryMap: Record<CrmAccountGroup['type'], string[]> = {
    Asset: [
        'FDR',
        'Bank_Accounts',
        'Cash_In_Hand',
        'Loans_and_Advances',
        'Accounts_receivable_(Sundry_Debtors)',
        'TDS',
        'Deposits',
        'Stock_In_Hand',
        'Security',
        'Machinery',
        'Land',
        'Vehicle',
        'Current_Assets',
        'Fixed_Assets',
        'Buildings',
    ],
    Liability: [
        'Bank_OD_A/c',
        'Branch_/_Divisions',
        'Current_Liabilities',
        'Duties_and_Taxes',
        'Loans',
        'Provisions',
        'Reserves_and_Surplus',
        'Secured_Loans',
        'Accounts_Payable_(Sundry_Creditors)',
        'Suspense_A/c',
        'Unsecured_Loans',
        'Legal_HR_Expenses',
    ],
    Income: ['Direct_Incomes', 'Indirect_Incomes', 'Sales_Accounts'],
    Expense: [
        'Administrative_Expenses',
        'Depreciation_Expenses',
        'Direct_Expenses',
        'Employees_Cost',
        'Financial_Expenses',
        'Indirect_Expenses',
        'Misc_Expenses',
        'Promotional_Expenses',
        'Purchase_Accounts',
        'Cost_Of_Goods_Sold',
    ],
    Capital: ['Capital_Accounts', 'Equities'],
};

const NATURE_TONE: Record<CrmAccountGroup['type'], StatusTone> = {
    Asset: 'green',
    Liability: 'red',
    Income: 'blue',
    Expense: 'amber',
    Capital: 'neutral',
};

const saveInitialState: { message?: string; error?: string } = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Save changes' : 'Create group'}
        </ZoruButton>
    );
}

function AccountGroupDialog({
    isOpen,
    onOpenChange,
    onSave,
    initialData,
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    initialData: GroupRow | null;
}) {
    const isEditing = !!initialData;
    const [state, formAction] = useActionState(saveCrmAccountGroup, saveInitialState);
    const { toast } = useZoruToast();
    const [selectedType, setSelectedType] = React.useState<CrmAccountGroup['type'] | ''>(
        (initialData?.type as CrmAccountGroup['type']) || '',
    );

    React.useEffect(() => {
        setSelectedType((initialData?.type as CrmAccountGroup['type']) || '');
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

    return (
        <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent>
                <form action={formAction}>
                    {isEditing ? (
                        <input type="hidden" name="groupId" value={initialData!._id.toString()} />
                    ) : null}
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>
                            {isEditing ? 'Edit' : 'Create new'} account group
                        </ZoruDialogTitle>
                    </ZoruDialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="name">Group name *</ZoruLabel>
                            <ZoruInput
                                id="name"
                                name="name"
                                placeholder="e.g. Bank Accounts"
                                required
                                defaultValue={initialData?.name}
                            />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="type">Nature *</ZoruLabel>
                            <EnumFormField
                                name="type"
                                enumName="accountNature"
                                initialId={initialData?.type ?? null}
                                onChange={(id) =>
                                    setSelectedType((id ?? '') as CrmAccountGroup['type'] | '')
                                }
                                required
                                placeholder="Pick a nature…"
                            />
                        </div>
                        {selectedType ? (
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="category">Parent / sub-nature *</ZoruLabel>
                                <ZoruSelect
                                    name="category"
                                    required
                                    defaultValue={initialData?.category}
                                >
                                    <ZoruSelectTrigger id="category">
                                        <ZoruSelectValue placeholder="Pick a sub-nature…" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {categoryMap[selectedType].map((c) => (
                                            <ZoruSelectItem key={c} value={c}>
                                                {c.replace(/_/g, ' ')}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        ) : null}
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

export default function AccountGroupsPage() {
    const [groups, setGroups] = React.useState<GroupRow[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [editing, setEditing] = React.useState<GroupRow | null>(null);
    const [isDialogOpen, setIsDialogOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [natureFilter, setNatureFilter] = React.useState<'all' | CrmAccountGroup['type']>('all');
    const [pendingDelete, setPendingDelete] = React.useState<GroupRow | null>(null);
    const [deletePending, startDeleteTransition] = React.useTransition();
    const [selection, setSelection] = React.useState<Set<string>>(new Set());
    const [bulkPending, startBulkTransition] = React.useTransition();
    const [confirmBulkDelete, setConfirmBulkDelete] = React.useState(false);
    const { toast } = useZoruToast();

    const refresh = React.useCallback(async () => {
        setIsLoading(true);
        const data = (await getCrmAccountGroupsWithCounts()) as GroupRow[];
        setGroups(data);
        setIsLoading(false);
    }, []);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    const filtered = React.useMemo(() => {
        const q = search.trim().toLowerCase();
        return groups.filter((g) => {
            if (natureFilter !== 'all' && g.type !== natureFilter) return false;
            if (!q) return true;
            return `${g.name} ${g.category}`.toLowerCase().includes(q);
        });
    }, [groups, search, natureFilter]);

    /* ── KPI ─────────────────────────────────────────────────────── */
    const kpi = React.useMemo(() => {
        const total = groups.length;
        const byNature: Record<string, number> = {};
        let totalAccounts = 0;
        for (const g of groups) {
            byNature[g.type] = (byNature[g.type] ?? 0) + 1;
            totalAccounts += g.accountCount ?? 0;
        }
        const avgAccounts = total > 0 ? Math.round((totalAccounts / total) * 10) / 10 : 0;
        return { total, byNature, avgAccounts };
    }, [groups]);

    /* ── Selection helpers ───────────────────────────────────────── */
    const handleToggle = (id: string) => {
        setSelection((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleToggleAll = (checked: boolean) => {
        setSelection(checked ? new Set(filtered.map((g) => g._id.toString())) : new Set());
    };

    const allChecked = filtered.length > 0 && filtered.every((g) => selection.has(g._id.toString()));
    const someChecked = !allChecked && filtered.some((g) => selection.has(g._id.toString()));

    /* ── Actions ─────────────────────────────────────────────────── */
    const handleOpenDialog = (group: GroupRow | null) => {
        setEditing(group);
        setIsDialogOpen(true);
    };

    const handleDelete = () => {
        if (!pendingDelete) return;
        startDeleteTransition(async () => {
            const result = await deleteCrmAccountGroup(pendingDelete._id.toString());
            if (result.success) {
                toast({ title: 'Group deleted' });
                setPendingDelete(null);
                setSelection((prev) => {
                    const next = new Set(prev);
                    next.delete(pendingDelete._id.toString());
                    return next;
                });
                await refresh();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    const handleBulkDelete = () => {
        const ids = Array.from(selection);
        if (ids.length === 0) return;
        startBulkTransition(async () => {
            const result = await bulkDeleteCrmAccountGroups(ids);
            if (result.deleted > 0 || result.failed === 0) {
                toast({ title: `Deleted ${result.deleted} group${result.deleted === 1 ? '' : 's'}` });
                setSelection(new Set());
                setConfirmBulkDelete(false);
                await refresh();
            } else {
                toast({ title: 'Error', description: result.error ?? 'Bulk delete failed', variant: 'destructive' });
            }
        });
    };

    const handleExport = () => {
        const rows = selection.size > 0 ? filtered.filter((g) => selection.has(g._id.toString())) : filtered;
        const csv = Papa.unparse(
            rows.map((g) => ({
                Name: g.name,
                Nature: g.type,
                'Sub-nature': g.category.replace(/_/g, ' '),
                'Account count': g.accountCount ?? 0,
            })),
        );
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'account-groups.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <>
            <AccountGroupDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={refresh}
                initialData={editing}
            />

            {/* KPI strip */}
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                <ZoruStatCard label="Total groups" value={kpi.total.toLocaleString()} />
                <ZoruStatCard label="Asset groups" value={(kpi.byNature['Asset'] ?? 0).toLocaleString()} />
                <ZoruStatCard label="Liability groups" value={(kpi.byNature['Liability'] ?? 0).toLocaleString()} />
                <ZoruStatCard label="Avg accounts / group" value={kpi.avgAccounts.toFixed(1)} />
            </div>

            <EntityListShell
                title="Account Groups"
                subtitle="Group your chart-of-accounts by nature and sub-nature."
                primaryAction={
                    <>
                        <ZoruButton variant="outline" onClick={handleExport}>
                            Export CSV
                        </ZoruButton>
                        <ZoruButton onClick={() => handleOpenDialog(null)}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Group
                        </ZoruButton>
                    </>
                }
                search={{ value: search, onChange: setSearch, placeholder: 'Search groups…' }}
                filters={
                    <ZoruSelect
                        value={natureFilter}
                        onValueChange={(v) => setNatureFilter(v as typeof natureFilter)}
                    >
                        <ZoruSelectTrigger className="h-9 w-[180px]">
                            <ZoruSelectValue placeholder="Nature" />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="all">All natures</ZoruSelectItem>
                            {accountNatures.map((n) => (
                                <ZoruSelectItem key={n} value={n}>
                                    {n}
                                </ZoruSelectItem>
                            ))}
                        </ZoruSelectContent>
                    </ZoruSelect>
                }
                bulkBar={
                    selection.size > 0 ? (
                        <div className="flex items-center gap-2 rounded-md bg-zoru-surface-2 px-3 py-2 text-[13px]">
                            <span className="font-medium text-zoru-ink">
                                {selection.size} selected
                            </span>
                            <ZoruButton
                                variant="outline"
                                size="sm"
                                onClick={handleExport}
                            >
                                Export
                            </ZoruButton>
                            <ZoruButton
                                variant="outline"
                                size="sm"
                                className="text-zoru-ink"
                                onClick={() => setConfirmBulkDelete(true)}
                                disabled={bulkPending}
                            >
                                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                            </ZoruButton>
                            <ZoruButton
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelection(new Set())}
                            >
                                <X className="h-3.5 w-3.5" />
                            </ZoruButton>
                        </div>
                    ) : null
                }
                loading={isLoading && groups.length === 0}
            >
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="w-10">
                                    <ZoruCheckbox
                                        checked={allChecked || (someChecked ? 'indeterminate' : false)}
                                        onCheckedChange={(v) => handleToggleAll(!!v)}
                                        aria-label="Select all"
                                    />
                                </ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Nature</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Sub-nature</ZoruTableHead>
                                <ZoruTableHead className="text-right text-zoru-ink-muted">Accounts</ZoruTableHead>
                                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={6} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : filtered.length === 0 ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={6} className="h-24 text-center text-zoru-ink-muted">
                                        No account groups match this filter.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : (
                                filtered.map((g) => {
                                    const id = g._id.toString();
                                    return (
                                        <ZoruTableRow key={id} className="border-zoru-line">
                                            <ZoruTableCell>
                                                <ZoruCheckbox
                                                    checked={selection.has(id)}
                                                    onCheckedChange={() => handleToggle(id)}
                                                    aria-label={`Select ${g.name}`}
                                                />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="font-medium text-zoru-ink">
                                                <EntityRowLink
                                                    href={`/dashboard/crm/accounting/groups/${id}`}
                                                    label={g.name}
                                                    subtitle={`${g.accountCount ?? 0} account${(g.accountCount ?? 0) === 1 ? '' : 's'}`}
                                                />
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <StatusPill label={g.type} tone={NATURE_TONE[g.type]} />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">
                                                {g.category.replace(/_/g, ' ')}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-zoru-ink">
                                                {g.accountCount ?? 0}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <ZoruButton
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleOpenDialog(g)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </ZoruButton>
                                                <ZoruButton
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setPendingDelete(g)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-zoru-ink" />
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

            {/* Single delete confirm */}
            <ZoruAlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>Delete account group?</ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; will affect{' '}
                            {pendingDelete?.accountCount ?? 0} account(s) currently linked.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            Delete
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>

            {/* Bulk delete confirm */}
            <ZoruAlertDialog
                open={confirmBulkDelete}
                onOpenChange={(o) => !o && setConfirmBulkDelete(false)}
            >
                <ZoruAlertDialogContent>
                    <ZoruAlertDialogHeader>
                        <ZoruAlertDialogTitle>
                            Delete {selection.size} group{selection.size === 1 ? '' : 's'}?
                        </ZoruAlertDialogTitle>
                        <ZoruAlertDialogDescription>
                            This permanently removes the selected account groups. Accounts linked to
                            them will lose their group assignment.
                        </ZoruAlertDialogDescription>
                    </ZoruAlertDialogHeader>
                    <ZoruAlertDialogFooter>
                        <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                        <ZoruAlertDialogAction onClick={handleBulkDelete} disabled={bulkPending}>
                            Delete
                        </ZoruAlertDialogAction>
                    </ZoruAlertDialogFooter>
                </ZoruAlertDialogContent>
            </ZoruAlertDialog>
        </>
    );
}
