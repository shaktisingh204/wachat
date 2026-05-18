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
  ZoruAlertDialogTrigger,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import { useState, useEffect, useCallback, useTransition } from 'react';
import type { WithId } from 'mongodb';
import { getCrmPaymentAccounts, deleteCrmPaymentAccount } from '@/app/actions/crm-payment-accounts.actions';
import type { CrmPaymentAccount } from '@/lib/definitions';

import { LoaderCircle, Plus, Trash2, Edit, Users } from 'lucide-react';

import Link from 'next/link';

import { CrmPageHeader } from '../../_components/crm-page-header';

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
    );
}

export default function EmployeeAccountsPage() {
    const [accounts, setAccounts] = useState<WithId<CrmPaymentAccount>[]>([]);
    const [isLoading, startTransition] = useTransition();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const data = await getCrmPaymentAccounts();
            setAccounts(data.filter(acc => acc.accountType === 'employee'));
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
                    title="Employee Accounts"
                    subtitle="A list of all your employee-related accounts."
                    icon={Users}
                />
                <ZoruCard variant="outline" className="border-dashed">
                    <div className="flex flex-col items-center gap-4 py-12 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-accent">
                            <Users className="h-7 w-7 text-accent-foreground" strokeWidth={1.75} />
                        </div>
                        <div>
                            <h3 className="text-[17px] font-semibold text-foreground">No Employee Accounts Found</h3>
                            <p className="mt-1 text-[12.5px] text-muted-foreground">
                                Add accounts for employees to manage reimbursements, salary advances, and other payments.
                            </p>
                        </div>
                        <Link href="/dashboard/crm/banking/all/new">
                            <ZoruButton>
                                Add First Employee Account
                            </ZoruButton>
                        </Link>
                    </div>
                </ZoruCard>
            </div>
        )
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Employee Accounts"
                subtitle="A list of all your employee-related accounts."
                icon={Users}
                actions={
                    <Link href="/dashboard/crm/banking/all/new">
                        <ZoruButton>
                            Add Employee Account
                        </ZoruButton>
                    </Link>
                }
            />

            <ZoruCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Your Employee Accounts</h2>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-border hover:bg-transparent">
                                <ZoruTableHead className="text-muted-foreground">Account Name</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Account Type</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Balance</ZoruTableHead>
                                <ZoruTableHead className="text-muted-foreground">Status</ZoruTableHead>
                                <ZoruTableHead className="text-right text-muted-foreground">Actions</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {accounts.map(account => (
                                <ZoruTableRow key={account._id.toString()} className="border-border">
                                    <ZoruTableCell className="font-medium text-foreground">{account.accountName}</ZoruTableCell>
                                    <ZoruTableCell className="capitalize text-[13px] text-foreground">{account.accountType}</ZoruTableCell>
                                    <ZoruTableCell className="text-right font-semibold text-foreground">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: account.currency }).format(account.currentBalance || 0)}</ZoruTableCell>
                                    <ZoruTableCell><ZoruBadge variant={(account.status === 'active' ? 'green' : 'rose-soft') as any}>{account.status}</ZoruBadge></ZoruTableCell>
                                    <ZoruTableCell className="text-right">
                                        <ZoruButton variant="ghost" size="icon" disabled><Edit className="h-4 w-4"/></ZoruButton>
                                        <DeleteButton account={account} onDeleted={fetchData} />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ))}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}
