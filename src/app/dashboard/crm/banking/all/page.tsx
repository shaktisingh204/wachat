
'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getCrmPaymentAccounts, deleteCrmPaymentAccount } from '@/app/actions/crm-payment-accounts.actions';
import type { CrmPaymentAccount } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Badge } from "@/components/ui/badge";
import { LoaderCircle, Plus, Trash2, Edit, Banknote, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
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

const StatCard = ({ title, value, icon: Icon }: { title: string; value: number; icon: React.ElementType }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)}
            </div>
        </CardContent>
    </Card>
);

function DeleteButton({ account, onDeleted }: { account: WithId<CrmPaymentAccount>, onDeleted: () => void }) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteCrmPaymentAccount(account._id.toString());
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
                    <AlertDialogDescription>Are you sure you want to delete the "{account.accountName}" account? This action cannot be undone.</AlertDialogDescription>
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

export default function AllPaymentAccountsPage() {
    const [accounts, setAccounts] = useState<WithId<CrmPaymentAccount>[]>([]);
    const [isLoading, startTransition] = useTransition();
    
    const fetchData = useCallback(() => {
        startTransition(async () => {
            const data = await getCrmPaymentAccounts();
            setAccounts(data);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const totalBankBalance = accounts.filter(a => a.accountType === 'bank').reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    const totalCashBalance = accounts.filter(a => a.accountType === 'cash').reduce((sum, a) => sum + (a.currentBalance || 0), 0);
    
    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">All Payment Accounts</h1>
                    <p className="text-muted-foreground">Manage your company's financial accounts and balances.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/crm/banking/all/new">
                        <Plus className="mr-2 h-4 w-4" /> Add Payment Account
                    </Link>
                </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard title="Total Bank Balance" value={totalBankBalance} icon={Banknote} />
                <StatCard title="Total Cash In Hand" value={totalCashBalance} icon={Wallet} />
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Accounts List</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Account Name</TableHead>
                                    <TableHead>Account Type</TableHead>
                                    <TableHead>Bank</TableHead>
                                    <TableHead>Account Number</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>
                                ) : accounts.length > 0 ? (
                                    accounts.map(account => (
                                        <TableRow key={account._id.toString()}>
                                            <TableCell className="font-medium">{account.accountName}</TableCell>
                                            <TableCell className="capitalize">{account.accountType}</TableCell>
                                            <TableCell>{account.bankDetails?.bankName || 'N/A'}</TableCell>
                                            <TableCell className="font-mono text-xs">{account.bankDetails?.accountNumber || 'N/A'}</TableCell>
                                            <TableCell className="text-right font-semibold">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: account.currency }).format(account.currentBalance || 0)}</TableCell>
                                            <TableCell><Badge variant={account.status === 'active' ? 'default' : 'secondary'}>{account.status}</Badge></TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" disabled><Edit className="h-4 w-4"/></Button>
                                                <DeleteButton account={account} onDeleted={fetchData} />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center">No payment accounts created yet.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
