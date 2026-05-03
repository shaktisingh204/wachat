'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getCrmPaymentAccounts, deleteCrmPaymentAccount } from '@/app/actions/crm-payment-accounts.actions';
import type { CrmPaymentAccount } from '@/lib/definitions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { LoaderCircle, Plus, Trash2, Edit, Landmark } from 'lucide-react';
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

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';

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
                    <AlertDialogDescription>Are you sure you want to delete the &ldquo;{account.accountName}&rdquo; account? This action cannot be undone.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={isPending}>
                        {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>} Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function BankAccountsPage() {
    const [accounts, setAccounts] = useState<WithId<CrmPaymentAccount>[]>([]);
    const [isLoading, startTransition] = useTransition();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const data = await getCrmPaymentAccounts();
            setAccounts(data.filter(acc => acc.accountType === 'bank'));
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (isLoading && accounts.length === 0) {
        return (
             <div className="flex justify-center items-center h-full">
                <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
             </div>
        )
    }

    if (!isLoading && accounts.length === 0) {
        return (
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    title="Bank Accounts"
                    subtitle="A list of all your connected bank accounts."
                    icon={Landmark}
                />
                <ClayCard variant="outline" className="border-dashed">
                    <div className="flex flex-col items-center gap-4 py-12 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent">
                            <Landmark className="h-7 w-7 text-accent-foreground" strokeWidth={1.75} />
                        </div>
                        <div>
                            <h3 className="text-[17px] font-semibold text-foreground">No Bank Accounts Found</h3>
                            <p className="mt-1 text-[12.5px] text-muted-foreground">
                                Add a new bank account to start tracking your business transactions.
                            </p>
                        </div>
                        <Link href="/dashboard/crm/banking/all/new">
                            <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                                Add First Bank Account
                            </ClayButton>
                        </Link>
                    </div>
                </ClayCard>
            </div>
        )
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Bank Accounts"
                subtitle="A list of all your connected bank accounts."
                icon={Landmark}
                actions={
                    <div className="flex items-center gap-2">
                        <Link href="/dashboard/crm/banking/bank-transactions">
                            <ClayButton variant="ghost">Ext. Transactions</ClayButton>
                        </Link>
                        <Link href="/dashboard/crm/banking/all/new">
                            <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                                Add Bank Account
                            </ClayButton>
                        </Link>
                    </div>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Your Bank Accounts</h2>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Account Name</TableHead>
                                <TableHead className="text-muted-foreground">Bank</TableHead>
                                <TableHead className="text-muted-foreground">Account Number</TableHead>
                                <TableHead className="text-right text-muted-foreground">Balance</TableHead>
                                <TableHead className="text-muted-foreground">Status</TableHead>
                                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {accounts.map(account => (
                                <TableRow key={account._id.toString()} className="border-border">
                                    <TableCell className="font-medium text-foreground">{account.accountName}</TableCell>
                                    <TableCell className="text-[13px] text-foreground">{account.bankDetails?.bankName || 'N/A'}</TableCell>
                                    <TableCell className="font-mono text-xs text-foreground">{account.bankDetails?.accountNumber || 'N/A'}</TableCell>
                                    <TableCell className="text-right font-semibold text-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: account.currency }).format(account.currentBalance || 0)}</TableCell>
                                    <TableCell><ClayBadge tone={account.status === 'active' ? 'green' : 'rose-soft'}>{account.status}</ClayBadge></TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" disabled><Edit className="h-4 w-4"/></Button>
                                        <DeleteButton account={account} onDeleted={fetchData} />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
