'use client';
import { ZoruAlertDialog, ZoruAlertDialogAction, ZoruAlertDialogCancel, ZoruAlertDialogContent, ZoruAlertDialogDescription, ZoruAlertDialogFooter, ZoruAlertDialogHeader, ZoruAlertDialogTitle, ZoruAlertDialogTrigger, ZoruButton, ZoruCard, ZoruDialog, ZoruDialogContent, ZoruDialogFooter, ZoruDialogHeader, ZoruDialogTitle, ZoruDropdownMenu, ZoruDropdownMenuContent, ZoruDropdownMenuItem, ZoruDropdownMenuTrigger, ZoruInput, ZoruLabel, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow, useZoruToast } from '@/components/zoruui';
import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId } from 'mongodb';
import { getCrmAccountGroups, saveCrmAccountGroup, deleteCrmAccountGroup } from '@/app/actions/crm-accounting.actions';
import type { CrmAccountGroup } from '@/lib/definitions';

import { LoaderCircle, Plus, Trash2, Edit, Download, ChevronDown, Layers } from 'lucide-react';

import Papa from 'papaparse';

import { CrmPageHeader } from '../../_components/crm-page-header';

const saveInitialState: any = { message: null, error: null };

const accountTypes = ['Asset', 'Liability', 'Income', 'Expense', 'Capital'];

const categoryMap: Record<string, string[]> = {
    Asset: ['FDR', 'Bank_Accounts', 'Cash_In_Hand', 'Loans_and_Advances', 'Accounts_receivable_(Sundry_Debtors)', 'TDS', 'Deposits', 'Stock_In_Hand', 'Security', 'Machinery', 'Land', 'Vehicle', 'Current_Assets', 'Fixed_Assets', 'Buildings'],
    Liability: ['Bank_OD_A/c', 'Branch_/_Divisions', 'Current_Liabilities', 'Duties_and_Taxes', 'Loans', 'Provisions', 'Reserves_and_Surplus', 'Secured_Loans', 'Accounts_Payable_(Sundry_Creditors)', 'Suspense_A/c', 'Unsecured_Loans', 'Legal_HR_Expenses'],
    Income: ['Direct_Incomes', 'Indirect_Incomes', 'Sales_Accounts'],
    Expense: ['Administrative_Expenses', 'Depreciation_Expenses', 'Direct_Expenses', 'Employees_Cost', 'Financial_Expenses', 'Indirect_Expenses', 'Misc_Expenses', 'Promotional_Expenses', 'Purchase_Accounts', 'Cost_Of_Goods_Sold'],
    Capital: ['Capital_Accounts', 'Equities'],
};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Save Changes' : 'Submit'}
        </ZoruButton>
    )
}

function AccountGroupDialog({
    isOpen,
    onOpenChange,
    onSave,
    initialData
}: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: () => void;
    initialData: WithId<CrmAccountGroup> | null
}) {
    const isEditing = !!initialData;
    const [state, formAction] = useActionState(saveCrmAccountGroup, saveInitialState);
    const { toast } = useZoruToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [selectedType, setSelectedType] = useState(initialData?.type || '');

    useEffect(() => {
        setSelectedType(initialData?.type || '');
    }, [initialData]);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
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
                <form action={formAction} ref={formRef}>
                    {isEditing && <input type="hidden" name="groupId" value={initialData?._id.toString()} />}
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>{isEditing ? 'Edit' : 'Create New'} Account Group</ZoruDialogTitle>
                    </ZoruDialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="name">Account Group Name *</ZoruLabel>
                            <ZoruInput id="name" name="name" placeholder="Type Account Group Name" required defaultValue={initialData?.name} />
                        </div>
                        <div className="space-y-2">
                            <ZoruLabel htmlFor="type">Type</ZoruLabel>
                            <ZoruSelect name="type" required onValueChange={setSelectedType} defaultValue={initialData?.type}>
                                <ZoruSelectTrigger><ZoruSelectValue placeholder="Select a type..."/></ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    {accountTypes.map(type => <ZoruSelectItem key={type} value={type}>{type}</ZoruSelectItem>)}
                                </ZoruSelectContent>
                            </ZoruSelect>
                        </div>
                         {selectedType && categoryMap[selectedType] && (
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="category">Category</ZoruLabel>
                                <ZoruSelect name="category" required defaultValue={initialData?.category}>
                                    <ZoruSelectTrigger><ZoruSelectValue placeholder="Select a category..."/></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {categoryMap[selectedType].map(cat => <ZoruSelectItem key={cat} value={cat}>{cat.replace(/_/g, ' ')}</ZoruSelectItem>)}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                        )}
                    </div>
                    <ZoruDialogFooter>
                        <ZoruButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
                        <SubmitButton isEditing={isEditing} />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}

function DeleteButton({ account, onDeleted }: { account: WithId<any>, onDeleted: () => void }) {
    const { toast } = useZoruToast();
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteCrmAccountGroup(account._id.toString());
            if (result.success) {
                toast({ title: 'Success', description: 'Account group deleted.' });
                onDeleted();
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        });
    }

    return (
        <ZoruAlertDialog>
            <ZoruAlertDialogTrigger asChild>
                <ZoruButton variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></ZoruButton>
            </ZoruAlertDialogTrigger>
            <ZoruAlertDialogContent>
                <ZoruAlertDialogHeader>
                    <ZoruAlertDialogTitle>Delete Account Group?</ZoruAlertDialogTitle>
                    <ZoruAlertDialogDescription>Are you sure you want to delete the "{account.name}" account group? This will also delete all accounts within this group.</ZoruAlertDialogDescription>
                </ZoruAlertDialogHeader>
                <ZoruAlertDialogFooter>
                    <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
                    <ZoruAlertDialogAction onClick={handleDelete} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>} Delete
                    </ZoruAlertDialogAction>
                </ZoruAlertDialogFooter>
            </ZoruAlertDialogContent>
        </ZoruAlertDialog>
    )
}

export default function AccountGroupsPage() {
    const [groups, setGroups] = useState<WithId<CrmAccountGroup>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const { toast } = useZoruToast();
    const [editingGroup, setEditingGroup] = useState<WithId<CrmAccountGroup> | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const data = await getCrmAccountGroups();
            setGroups(data);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOpenDialog = (group: WithId<CrmAccountGroup> | null) => {
        setEditingGroup(group);
        setIsDialogOpen(true);
    };

    const handleDownload = (format: 'csv' | 'xls' | 'pdf') => {
        if (format === 'csv') {
            const csv = Papa.unparse(groups.map(({ name, type, category }) => ({ Name: name, Type: type, Category: category.replace(/_/g, ' ') })));
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', 'account-groups.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            toast({ title: "Not Implemented", description: `Export to ${format.toUpperCase()} is not yet available.`});
        }
    };

    return (
        <>
            <AccountGroupDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={fetchData}
                initialData={editingGroup}
            />
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    title="Account Groups"
                    subtitle="A list of all account groups in your CRM."
                    icon={Layers}
                    actions={
                        <div className="flex items-center gap-2">
                            <ZoruButton onClick={() => handleOpenDialog(null)}>
                                New Account Group
                            </ZoruButton>
                            <ZoruDropdownMenu>
                                <ZoruDropdownMenuTrigger asChild>
                                    <ZoruButton variant="outline">
                                        Download As
                                    </ZoruButton>
                                </ZoruDropdownMenuTrigger>
                                <ZoruDropdownMenuContent>
                                    <ZoruDropdownMenuItem onSelect={() => handleDownload('csv')}>CSV</ZoruDropdownMenuItem>
                                    <ZoruDropdownMenuItem disabled>XLS</ZoruDropdownMenuItem>
                                    <ZoruDropdownMenuItem disabled>PDF</ZoruDropdownMenuItem>
                                </ZoruDropdownMenuContent>
                            </ZoruDropdownMenu>
                        </div>
                    }
                />
                <ZoruCard>
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-border hover:bg-transparent">
                                    <ZoruTableHead className="text-muted-foreground">Group Name</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">Type</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground">Category</ZoruTableHead>
                                    <ZoruTableHead className="text-muted-foreground text-right">Actions</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow className="border-border"><ZoruTableCell colSpan={4} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground"/></ZoruTableCell></ZoruTableRow>
                                ) : groups.length > 0 ? (
                                    groups.map(group => (
                                        <ZoruTableRow key={group._id.toString()} className="border-border">
                                            <ZoruTableCell className="font-medium text-foreground">{group.name}</ZoruTableCell>
                                            <ZoruTableCell className="text-foreground">{group.type}</ZoruTableCell>
                                            <ZoruTableCell className="text-foreground">{group.category?.replace(/_/g, ' ')}</ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <ZoruButton variant="ghost" size="icon" onClick={() => handleOpenDialog(group)}><Edit className="h-4 w-4"/></ZoruButton>
                                                <DeleteButton account={group} onDeleted={fetchData} />
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                ) : (
                                    <ZoruTableRow className="border-border"><ZoruTableCell colSpan={4} className="h-24 text-center text-muted-foreground">No account groups found.</ZoruTableCell></ZoruTableRow>
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </ZoruCard>
            </div>
        </>
    );
}
