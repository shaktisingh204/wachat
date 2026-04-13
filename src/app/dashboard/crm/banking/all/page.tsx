'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getCrmPaymentAccounts, deleteCrmPaymentAccount } from '@/app/actions/crm-payment-accounts.actions';
import type { CrmPaymentAccount } from '@/lib/definitions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { LoaderCircle, Plus, Trash2, Edit, Banknote, Wallet, ArrowLeftRight } from 'lucide-react';
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

const StatCard = ({ title, value, icon: Icon }: { title: string; value: number; icon: React.ElementType }) => (
    <ClayCard>
        <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-clay-ink-muted">{title}</p>
            <Icon className="h-4 w-4 text-clay-ink-muted" />
        </div>
        <div className="mt-2 text-[22px] font-bold text-clay-ink">
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)}
        </div>
    </ClayCard>
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="All Payment Accounts"
                subtitle="Manage your company's financial accounts and balances."
                icon={ArrowLeftRight}
                actions={
                    <Link href="/dashboard/crm/banking/all/new">
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                            Add Payment Account
                        </ClayButton>
                    </Link>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard title="Total Bank Balance" value={totalBankBalance} icon={Banknote} />
                <StatCard title="Total Cash In Hand" value={totalCashBalance} icon={Wallet} />
            </div>

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-clay-ink">Accounts List</h2>
                </div>
                <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-clay-border hover:bg-transparent">
                                <TableHead className="text-clay-ink-muted">Account Name</TableHead>
                                <TableHead className="text-clay-ink-muted">Account Type</TableHead>
                                <TableHead className="text-clay-ink-muted">Bank</TableHead>
                                <TableHead className="text-clay-ink-muted">Account Number</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Balance</TableHead>
                                <TableHead className="text-clay-ink-muted">Status</TableHead>
                                <TableHead className="text-right text-clay-ink-muted">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow className="border-clay-border"><TableCell colSpan={7} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin"/></TableCell></TableRow>
                            ) : accounts.length > 0 ? (
                                accounts.map(account => (
                                    <TableRow key={account._id.toString()} className="border-clay-border">
                                        <TableCell className="font-medium text-clay-ink">{account.accountName}</TableCell>
                                        <TableCell className="capitalize text-[13px] text-clay-ink">{account.accountType}</TableCell>
                                        <TableCell className="text-[13px] text-clay-ink">{account.bankDetails?.bankName || 'N/A'}</TableCell>
                                        <TableCell className="font-mono text-xs text-clay-ink">{account.bankDetails?.accountNumber || 'N/A'}</TableCell>
                                        <TableCell className="text-right font-semibold text-clay-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: account.currency }).format(account.currentBalance || 0)}</TableCell>
                                        <TableCell><ClayBadge tone={account.status === 'active' ? 'green' : 'rose-soft'}>{account.status}</ClayBadge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" disabled><Edit className="h-4 w-4"/></Button>
                                            <DeleteButton account={account} onDeleted={fetchData} />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow className="border-clay-border"><TableCell colSpan={7} className="h-24 text-center text-[13px] text-clay-ink-muted">No payment accounts created yet.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
