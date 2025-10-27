'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId } from 'mongodb';
import { getCrmChartOfAccounts, deleteCrmChartOfAccount } from '@/app/actions/crm-accounting.actions';
import { getCrmAccountGroups } from '@/app/actions/crm-accounting.actions';
import type { CrmChartOfAccount, CrmAccountGroup } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, LoaderCircle, Edit, Trash2, Download, ChevronDown } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import Papa from 'papaparse';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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
             <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Chart of Accounts</h1>
                    <p className="text-muted-foreground">Manage your company's financial accounts.</p>
                </div>
                 <div className="flex items-center gap-2">
                    <Button onClick={() => handleOpenDialog(null)}><Plus className="mr-2 h-4 w-4" /> New Account</Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="outline"><Download className="mr-2 h-4 w-4"/>Download As<ChevronDown className="ml-2 h-4 w-4"/></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => handleDownload('csv')}>CSV</DropdownMenuItem>
                            <DropdownMenuItem disabled>XLS</DropdownMenuItem>
                            <DropdownMenuItem disabled>PDF</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <Card>
                <CardContent className="pt-6">
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
                </CardContent>
            </Card>
        </>
    );
}

function AccountsTable({ accounts, isLoading, onEdit, onDelete }: { accounts: WithId<any>[], isLoading: boolean, onEdit: (acc: any) => void, onDelete: () => void }) {
    return (
         <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Account Name</TableHead>
                        <TableHead>Account Group</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Opening Balance</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow><TableCell colSpan={6} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>
                    ) : accounts.length > 0 ? (
                        accounts.map(acc => (
                            <TableRow key={acc._id.toString()}>
                                <TableCell className="font-medium">
                                    <Link href={`/dashboard/crm/accounting/charts/${acc._id.toString()}`} className="hover:underline text-primary">
                                        {acc.name}
                                    </Link>
                                </TableCell>
                                <TableCell>{acc.accountGroupName || 'N/A'}</TableCell>
                                <TableCell>{acc.accountGroupCategory?.replace(/_/g, ' ')}</TableCell>
                                <TableCell><Badge variant="outline">{acc.accountGroupType}</Badge></TableCell>
                                <TableCell className="text-right font-mono">
                                    {new Intl.NumberFormat('en-IN', { style: 'currency', currency: acc.currency || 'INR' }).format(acc.openingBalance)} {acc.balanceType || 'Dr'}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => onEdit(acc)}><Edit className="h-4 w-4"/></Button>
                                    <DeleteButton account={acc} onDeleted={onDelete} />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow><TableCell colSpan={6} className="h-24 text-center">No accounts in this category.</TableCell></TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
