'use client';
import { ZoruAlertDialog, ZoruAlertDialogAction, ZoruAlertDialogCancel, ZoruAlertDialogContent, ZoruAlertDialogDescription, ZoruAlertDialogFooter, ZoruAlertDialogHeader, ZoruAlertDialogTitle, ZoruAlertDialogTrigger, ZoruBadge, ZoruButton, ZoruCard, ZoruTable, ZoruTableBody, ZoruTableCell, ZoruTableHead, ZoruTableHeader, ZoruTableRow, useZoruToast } from '@/components/zoruui';
import { useState, useEffect, useCallback, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getCrmPaymentAccounts, deleteCrmPaymentAccount } from '@/app/actions/crm-payment-accounts.actions';
import type { CrmPaymentAccount } from '@/lib/definitions';

import { LoaderCircle, Plus, Trash2, Edit, Banknote, Wallet, ArrowLeftRight } from 'lucide-react';

import Link from 'next/link';

import { CrmPageHeader } from '../../_components/crm-page-header';

const StatCard = ({ title, value, icon: Icon }: { title: string; value: number; icon: React.ElementType }) => (
    <ZoruCard>
        <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-muted-foreground">{title}</p>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-2 text-[22px] font-bold text-foreground">
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value)}
        </div>
    </ZoruCard>
);

function DeleteButton({ account, onDeleted }: { account: WithId<CrmPaymentAccount>, onDeleted: () => void }) {
    const { toast } = useZoruToast();
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
        <ZoruAlertDialog>
            <ZoruAlertDialogTrigger asChild>
                <ZoruButton variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></ZoruButton>
            </ZoruAlertDialogTrigger>
            <ZoruAlertDialogContent>
                <ZoruAlertDialogHeader>
                    <ZoruAlertDialogTitle>Delete Account?</ZoruAlertDialogTitle>
                    <ZoruAlertDialogDescription>Are you sure you want to delete the &ldquo;{account.accountName}&rdquo; account? This action cannot be undone.</ZoruAlertDialogDescription>
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
                        <ZoruButton>
                            Add Payment Account
                        </ZoruButton>
                    </Link>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard title="Total Bank Balance" value={totalBankBalance} icon={Banknote} />
                <StatCard title="Total Cash In Hand" value={totalCashBalance} icon={Wallet} />
            </div>

            <ZoruCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Accounts List</h2>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Account Name</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Account Type</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Bank</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Account Number</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Balance</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-border"><ZoruTableCell colSpan={7} className="h-24 text-center"><LoaderCircle className="mx-auto h-6 w-6 animate-spin"/></ZoruTableCell></ZoruTableRow>
                            ) : accounts.length > 0 ? (
                                accounts.map(account => (
                                    <ZoruTableRow key={account._id.toString()} className="border-border">
                                        <ZoruTableCell className="font-medium text-foreground">{account.accountName}</ZoruTableCell>
                                        <ZoruTableCell className="capitalize text-[13px] text-foreground">{account.accountType}</ZoruTableCell>
                                        <ZoruTableCell className="text-[13px] text-foreground">{account.bankDetails?.bankName || 'N/A'}</ZoruTableCell>
                                        <ZoruTableCell className="font-mono text-xs text-foreground">{account.bankDetails?.accountNumber || 'N/A'}</ZoruTableCell>
                                        <ZoruTableCell className="text-right font-semibold text-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: account.currency }).format(account.currentBalance || 0)}</ZoruTableCell>
                                        <ZoruTableCell><ZoruBadge variant={(account.status === 'active' ? 'green' : 'rose-soft') as any}>{account.status}</ZoruBadge></ZoruTableCell>
                                        <ZoruTableCell className="text-right">
                                            <ZoruButton variant="ghost" size="icon" disabled><Edit className="h-4 w-4"/></ZoruButton>
                                            <DeleteButton account={account} onDeleted={fetchData} />
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-border"><ZoruTableCell colSpan={7} className="h-24 text-center text-[13px] text-muted-foreground">No payment accounts created yet.</ZoruTableCell></ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}
