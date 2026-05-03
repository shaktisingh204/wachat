'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getCrmChartOfAccounts, deleteCrmChartOfAccount } from '@/app/actions/crm-accounting.actions';
import { getCrmAccountGroups } from '@/app/actions/crm-accounting.actions';
import type { CrmAccountGroup } from '@/lib/definitions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, LoaderCircle, Edit, Trash2, Download, ChevronDown, Network } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CrmChartOfAccountDialog } from '@/components/wabasimplify/crm-chart-of-account-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import Link from 'next/link';
import Papa from 'papaparse';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

function DeleteButton({ account, onDeleted }: { account: WithId<any>, onDeleted: () => void }) {
    const { toast } = useToast();
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
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                    <AlertDialogDescription>Are you sure you want to delete the "{account.name}" account? This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>} Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
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
                            <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />} onClick={() => handleOpenDialog(null)}>
                                New Account
                            </ClayButton>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <ClayButton variant="pill" leading={<Download className="h-4 w-4" strokeWidth={1.75} />} trailing={<ChevronDown className="h-4 w-4" strokeWidth={1.75} />}>
                                        Download As
                                    </ClayButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onSelect={() => handleDownload('csv')}>CSV</DropdownMenuItem>
                                    <DropdownMenuItem disabled>XLS</DropdownMenuItem>
                                    <DropdownMenuItem disabled>PDF</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    }
                />
                <ClayCard>
                    <Tabs defaultValue="active">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="active">Active ({activeAccounts.length})</TabsTrigger>
                            <TabsTrigger value="inactive">Inactive ({inactiveAccounts.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="active" className="mt-4">
                            <AccountsTable accounts={activeAccounts} isLoading={isLoading} onEdit={handleOpenDialog} onDelete={fetchData} />
                        </TabsContent>
                         <TabsContent value="inactive" className="mt-4">
                            <AccountsTable accounts={inactiveAccounts} isLoading={isLoading} onEdit={handleOpenDialog} onDelete={fetchData} />
                        </TabsContent>
                    </Tabs>
                </ClayCard>
            </div>
        </>
    );
}

function AccountsTable({ accounts, isLoading, onEdit, onDelete }: { accounts: WithId<any>[], isLoading: boolean, onEdit: (acc: any) => void, onDelete: () => void }) {
    return (
         <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
                <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-muted-foreground">Account Name</TableHead>
                        <TableHead className="text-muted-foreground">Account Group</TableHead>
                        <TableHead className="text-muted-foreground">Category</TableHead>
                        <TableHead className="text-muted-foreground">Type</TableHead>
                        <TableHead className="text-muted-foreground text-right">Opening Balance</TableHead>
                        <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow className="border-border"><TableCell colSpan={6} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground"/></TableCell></TableRow>
                    ) : accounts.length > 0 ? (
                        accounts.map(acc => (
                            <TableRow key={acc._id.toString()} className="border-border">
                                <TableCell className="font-medium">
                                    <Link href={`/dashboard/crm/accounting/charts/${acc._id.toString()}`} className="hover:underline text-accent-foreground">
                                        {acc.name}
                                    </Link>
                                </TableCell>
                                <TableCell className="text-foreground">{acc.accountGroupName || 'N/A'}</TableCell>
                                <TableCell className="text-foreground">{acc.accountGroupCategory?.replace(/_/g, ' ')}</TableCell>
                                <TableCell><ClayBadge tone="neutral">{acc.accountGroupType}</ClayBadge></TableCell>
                                <TableCell className="text-right font-mono text-foreground">
                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: acc.currency || 'INR' }).format(acc.openingBalance)} {acc.balanceType || 'Dr'}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => onEdit(acc)}><Edit className="h-4 w-4"/></Button>
                                    <DeleteButton account={acc} onDeleted={onDelete} />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow className="border-border"><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No accounts in this category.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
