'use client';
import { ZoruAlertDialog, ZoruAlertDialogAction, ZoruAlertDialogCancel, ZoruAlertDialogContent, ZoruAlertDialogDescription, ZoruAlertDialogFooter, ZoruAlertDialogHeader, ZoruAlertDialogTitle, ZoruAlertDialogTrigger, ZoruBadge, ZoruButton, ZoruCard, ZoruDropdownMenu, ZoruDropdownMenuContent, ZoruDropdownMenuItem, ZoruDropdownMenuTrigger, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow, useZoruToast } from '@/components/zoruui';
import { useState, useEffect, useCallback, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getCrmChartOfAccounts, deleteCrmChartOfAccount } from '@/app/actions/crm-accounting.actions';
import { getCrmAccountGroups } from '@/app/actions/crm-accounting.actions';
import type { CrmAccountGroup } from '@/lib/definitions';

import { Plus, LoaderCircle, Edit, Trash2, Download, ChevronDown, Network } from 'lucide-react';

import { CrmChartOfAccountDialog } from '@/components/wabasimplify/crm-chart-of-account-dialog';

import Link from 'next/link';
import Papa from 'papaparse';

import { CrmPageHeader } from '../../_components/crm-page-header';

function DeleteButton({ account, onDeleted }: { account: WithId<any>, onDeleted: () => void }) {
    const { toast } = useZoruToast();
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteCrmChartOfAccount(account._id.toString());
            if (result.success) {
                toast({ title: 'Success', description: 'Account deleted.' });
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
                    <ZoruAlertDialogTitle>Delete Account?</ZoruAlertDialogTitle>
                    <ZoruAlertDialogDescription>Are you sure you want to delete the "{account.name}" account? This action cannot be undone.</ZoruAlertDialogDescription>
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

export default function ChartOfAccountsPage() {
    const [accounts, setAccounts] = useState<WithId<any>[]>([]);
    const [groups, setGroups] = useState<WithId<CrmAccountGroup>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<WithId<any> | null>(null);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [accountsData, groupsData] = await Promise.all([
                getCrmChartOfAccounts(),
                getCrmAccountGroups()
            ]);
            setAccounts(accountsData);
            setGroups(groupsData);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOpenDialog = (account: WithId<any> | null) => {
        setEditingAccount(account);
        setIsDialogOpen(true);
    };

    const handleDownload = (format: 'csv' | 'xls' | 'pdf') => {
        const dataToExport = accounts.map(acc => ({
            "Account Name": acc.name,
            "Account Group": acc.accountGroupName || 'N/A',
            "Category": acc.accountGroupCategory?.replace(/_/g, ' '),
            "Type": acc.accountGroupType,
            "Opening Balance": `${acc.openingBalance} ${acc.balanceType}`
        }));
        if (format === 'csv') {
            const csv = Papa.unparse(dataToExport);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', 'chart-of-accounts.csv');
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const activeAccounts = accounts.filter(acc => acc.status === 'Active');
    const inactiveAccounts = accounts.filter(acc => acc.status === 'Inactive');

    return (
        <>
            <CrmChartOfAccountDialog
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={fetchData}
                accountGroups={groups}
                initialData={editingAccount}
            />
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    title="Chart of Accounts"
                    subtitle="Manage your company's financial accounts."
                    icon={Network}
                    actions={
                        <div className="flex items-center gap-2">
                            <ZoruButton onClick={() => handleOpenDialog(null)}>
                                New Account
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
                    <div defaultValue="active">
                        <div className="grid w-full grid-cols-2">
                            <button type="button">Active ({activeAccounts.length})</button>
                            <button type="button">Inactive ({inactiveAccounts.length})</button>
                        </div>
                        <div className="mt-4">
                            <AccountsTable accounts={activeAccounts} isLoading={isLoading} onEdit={handleOpenDialog} onDelete={fetchData} />
                        </div>
                         <div className="mt-4">
                            <AccountsTable accounts={inactiveAccounts} isLoading={isLoading} onEdit={handleOpenDialog} onDelete={fetchData} />
                        </div>
                    </div>
                </ZoruCard>
            </div>
        </>
    );
}

function AccountsTable({ accounts, isLoading, onEdit, onDelete }: { accounts: WithId<any>[], isLoading: boolean, onEdit: (acc: any) => void, onDelete: () => void }) {
    return (
         <div className="overflow-x-auto rounded-lg border border-border">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow className="border-border hover:bg-transparent">
                        <ZoruTableHead className="text-muted-foreground">Account Name</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground">Account Group</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground">Category</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground">Type</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground text-right">Opening Balance</ZoruTableHead>
                        <ZoruTableHead className="text-muted-foreground text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {isLoading ? (
                        <ZoruTableRow className="border-border"><ZoruTableCell colSpan={6} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground"/></ZoruTableCell></ZoruTableRow>
                    ) : accounts.length > 0 ? (
                        accounts.map(acc => (
                            <ZoruTableRow key={acc._id.toString()} className="border-border">
                                <ZoruTableCell className="font-medium">
                                    <Link href={`/dashboard/crm/accounting/charts/${acc._id.toString()}`} className="hover:underline text-accent-foreground">
                                        {acc.name}
                                    </Link>
                                </ZoruTableCell>
                                <ZoruTableCell className="text-foreground">{acc.accountGroupName || 'N/A'}</ZoruTableCell>
                                <ZoruTableCell className="text-foreground">{acc.accountGroupCategory?.replace(/_/g, ' ')}</ZoruTableCell>
                                <ZoruTableCell><ZoruBadge variant="ghost">{acc.accountGroupType}</ZoruBadge></ZoruTableCell>
                                <ZoruTableCell className="text-right font-mono text-foreground">
                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: acc.currency || 'INR' }).format(acc.openingBalance)} {acc.balanceType || 'Dr'}
                                </ZoruTableCell>
                                <ZoruTableCell className="text-right">
                                    <ZoruButton variant="ghost" size="icon" onClick={() => onEdit(acc)}><Edit className="h-4 w-4"/></ZoruButton>
                                    <DeleteButton account={acc} onDeleted={onDelete} />
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ))
                    ) : (
                        <ZoruTableRow className="border-border"><ZoruTableCell colSpan={6} className="h-24 text-center text-muted-foreground">No accounts in this category.</ZoruTableCell></ZoruTableRow>
                    )}
                </ZoruTableBody>
            </ZoruTable>
        </div>
    );
}
