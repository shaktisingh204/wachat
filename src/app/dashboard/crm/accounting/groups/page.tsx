'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui';
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
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Save changes' : 'Create group'}
        </Button>
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
    const { toast } = useToast();
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
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <form action={formAction}>
                    {isEditing ? (
                        <input type="hidden" name="groupId" value={initialData!._id.toString()} />
                    ) : null}
                    <DialogHeader>
                        <DialogTitle>
                            {isEditing ? 'Edit' : 'Create new'} account group
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Group name *</Label>
                            <Input
                                id="name"
                                name="name"
                                placeholder="e.g. Bank Accounts"
                                required
                                defaultValue={initialData?.name}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="type">Nature *</Label>
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
                                <Label htmlFor="category">Parent / sub-nature *</Label>
                                <Select
                                    name="category"
                                    required
                                    defaultValue={initialData?.category}
                                >
                                    <SelectTrigger id="category">
                                        <SelectValue placeholder="Pick a sub-nature…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {categoryMap[selectedType].map((c) => (
                                            <SelectItem key={c} value={c}>
                                                {c.replace(/_/g, ' ')}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        ) : null}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <SubmitButton isEditing={isEditing} />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
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
    const { toast } = useToast();

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
                <StatCard label="Total groups" value={kpi.total.toLocaleString()} />
                <StatCard label="Asset groups" value={(kpi.byNature['Asset'] ?? 0).toLocaleString()} />
                <StatCard label="Liability groups" value={(kpi.byNature['Liability'] ?? 0).toLocaleString()} />
                <StatCard label="Avg accounts / group" value={kpi.avgAccounts.toFixed(1)} />
            </div>

            <EntityListShell
                title="Account Groups"
                subtitle="Group your chart-of-accounts by nature and sub-nature."
                primaryAction={
                    <>
                        <Button variant="outline" onClick={handleExport}>
                            Export CSV
                        </Button>
                        <Button onClick={() => handleOpenDialog(null)}>
                            <Plus className="mr-1.5 h-3.5 w-3.5" /> New Group
                        </Button>
                    </>
                }
                search={{ value: search, onChange: setSearch, placeholder: 'Search groups…' }}
                filters={
                    <Select
                        value={natureFilter}
                        onValueChange={(v) => setNatureFilter(v as typeof natureFilter)}
                    >
                        <SelectTrigger className="h-9 w-[180px]">
                            <SelectValue placeholder="Nature" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All natures</SelectItem>
                            {accountNatures.map((n) => (
                                <SelectItem key={n} value={n}>
                                    {n}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                }
                bulkBar={
                    selection.size > 0 ? (
                        <div className="flex items-center gap-2 rounded-md bg-[var(--st-bg-muted)] px-3 py-2 text-[13px]">
                            <span className="font-medium text-[var(--st-text)]">
                                {selection.size} selected
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExport}
                            >
                                Export
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-[var(--st-text)]"
                                onClick={() => setConfirmBulkDelete(true)}
                                disabled={bulkPending}
                            >
                                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelection(new Set())}
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    ) : null
                }
                loading={isLoading && groups.length === 0}
            >
                <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                    <Table>
                        <THead>
                            <Tr className="border-[var(--st-border)] hover:bg-transparent">
                                <Th className="w-10">
                                    <Checkbox
                                        checked={allChecked || (someChecked ? 'indeterminate' : false)}
                                        onCheckedChange={(v) => handleToggleAll(!!v)}
                                        aria-label="Select all"
                                    />
                                </Th>
                                <Th className="text-[var(--st-text-secondary)]">Name</Th>
                                <Th className="text-[var(--st-text-secondary)]">Nature</Th>
                                <Th className="text-[var(--st-text-secondary)]">Sub-nature</Th>
                                <Th className="text-right text-[var(--st-text-secondary)]">Accounts</Th>
                                <Th className="text-right text-[var(--st-text-secondary)]">Actions</Th>
                            </Tr>
                        </THead>
                        <TBody>
                            {isLoading ? (
                                <Tr className="border-[var(--st-border)]">
                                    <Td colSpan={6} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                                    </Td>
                                </Tr>
                            ) : filtered.length === 0 ? (
                                <Tr className="border-[var(--st-border)]">
                                    <Td colSpan={6} className="h-24 text-center text-[var(--st-text-secondary)]">
                                        No account groups match this filter.
                                    </Td>
                                </Tr>
                            ) : (
                                filtered.map((g) => {
                                    const id = g._id.toString();
                                    return (
                                        <Tr key={id} className="border-[var(--st-border)]">
                                            <Td>
                                                <Checkbox
                                                    checked={selection.has(id)}
                                                    onCheckedChange={() => handleToggle(id)}
                                                    aria-label={`Select ${g.name}`}
                                                />
                                            </Td>
                                            <Td className="font-medium text-[var(--st-text)]">
                                                <EntityRowLink
                                                    href={`/dashboard/crm/accounting/groups/${id}`}
                                                    label={g.name}
                                                    subtitle={`${g.accountCount ?? 0} account${(g.accountCount ?? 0) === 1 ? '' : 's'}`}
                                                />
                                            </Td>
                                            <Td>
                                                <StatusPill label={g.type} tone={NATURE_TONE[g.type]} />
                                            </Td>
                                            <Td className="text-[var(--st-text)]">
                                                {g.category.replace(/_/g, ' ')}
                                            </Td>
                                            <Td className="text-right font-mono text-[var(--st-text)]">
                                                {g.accountCount ?? 0}
                                            </Td>
                                            <Td className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleOpenDialog(g)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setPendingDelete(g)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-[var(--st-text)]" />
                                                </Button>
                                            </Td>
                                        </Tr>
                                    );
                                })
                            )}
                        </TBody>
                    </Table>
                </div>
            </EntityListShell>

            {/* Single delete confirm */}
            <AlertDialog
                open={!!pendingDelete}
                onOpenChange={(o) => !o && setPendingDelete(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete account group?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Deleting &ldquo;{pendingDelete?.name}&rdquo; will affect{' '}
                            {pendingDelete?.accountCount ?? 0} account(s) currently linked.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deletePending}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk delete confirm */}
            <AlertDialog
                open={confirmBulkDelete}
                onOpenChange={(o) => !o && setConfirmBulkDelete(false)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete {selection.size} group{selection.size === 1 ? '' : 's'}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently removes the selected account groups. Accounts linked to
                            them will lose their group assignment.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDelete} disabled={bulkPending}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
