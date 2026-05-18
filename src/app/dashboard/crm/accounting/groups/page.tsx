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
  Layers,
  LoaderCircle,
  Plus,
  Trash2 } from 'lucide-react';

/**
 * Account Groups — settings-style list (§1D.4 specialized: settings list).
 * Inline-create dialog with nature + parent group picker (parent is left as a
 * free-text helper for now since groups themselves aren't recursive in the
 * current data model). Each row shows code, name, nature, parent, account count.
 */

import * as React from 'react';
import Papa from 'papaparse';

import { EnumFormField } from '@/components/crm/enum-form-field';
import { useFormStatus } from 'react-dom';
import { useActionState } from 'react';
import type { WithId } from 'mongodb';

import { CrmPageHeader } from '../../_components/crm-page-header';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';

import {
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
                await refresh();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    };

    const handleExport = () => {
        const csv = Papa.unparse(
            filtered.map((g) => ({
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
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    breadcrumbs={[
                        { label: 'Accounting', href: '/dashboard/crm/accounting' },
                        { label: 'Account Groups' },
                    ]}
                    title="Account Groups"
                    subtitle="Group your chart-of-accounts by nature and sub-nature."
                    icon={Layers}
                    actions={
                        <>
                            <ZoruButton variant="outline" onClick={handleExport}>
                                Export CSV
                            </ZoruButton>
                            <ZoruButton onClick={() => handleOpenDialog(null)}>
                                <Plus className="mr-1.5 h-3.5 w-3.5" /> New Group
                            </ZoruButton>
                        </>
                    }
                />

                <EntityListShell
                    title=""
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
                    loading={isLoading && groups.length === 0}
                >
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-border hover:bg-transparent">
                                    <ZoruTableHead className="text-muted-foreground">Name</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">Nature</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">Sub-nature</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground text-right">Accounts</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground text-right">Actions</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-border">
                                        <ZoruTableCell colSpan={5} className="h-24 text-center">
                                            <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : filtered.length === 0 ? (
                                    <ZoruTableRow className="border-border">
                                        <ZoruTableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            No account groups match this filter.
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : (
                                    filtered.map((g) => (
                                        <ZoruTableRow key={g._id.toString()} className="border-border">
                                            <ZoruTableCell className="font-medium text-foreground">
                                                {g.name}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <StatusPill label={g.type} tone={NATURE_TONE[g.type]} />
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-foreground">
                                                {g.category.replace(/_/g, ' ')}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right font-mono text-foreground">
                                                {g.accountCount ?? 0}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <ZoruButton variant="ghost" size="icon" onClick={() => handleOpenDialog(g)}>
                                                    <Edit className="h-4 w-4" />
                                                </ZoruButton>
                                                <ZoruButton variant="ghost" size="icon" onClick={() => setPendingDelete(g)}>
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
            </div>

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
        </>
    );
}
