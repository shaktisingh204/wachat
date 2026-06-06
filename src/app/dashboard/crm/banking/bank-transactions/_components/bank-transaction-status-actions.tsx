'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import { Archive,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
  Trash2 } from 'lucide-react';

/**
 * <BankTransactionStatusActions> — tiny client component used on the
 * transaction detail page. Wraps {@link setBankTransactionStatus} +
 * {@link deleteBankTransaction} so the parent server component stays
 * statically renderable.
 */

import * as React from 'react';

import {
    deleteBankTransaction,
    setBankTransactionStatus,
    type CrmBankTransactionStatus,
} from '@/app/actions/crm-bank-transactions.actions';

interface BankTransactionStatusActionsProps {
    id: string;
    current: CrmBankTransactionStatus;
}

export function BankTransactionStatusActions({
    id,
    current,
}: BankTransactionStatusActionsProps): React.JSX.Element {
    const { toast } = useToast();
    const router = useRouter();
    const [isPending, startTransition] = React.useTransition();
    const [confirmDelete, setConfirmDelete] = React.useState(false);

    const moveTo = React.useCallback(
        (next: CrmBankTransactionStatus) => {
            if (next === current) return;
            startTransition(async () => {
                const r = await setBankTransactionStatus(id, next);
                if (r.success) {
                    toast({ title: `Marked ${next}.` });
                    router.refresh();
                } else {
                    toast({
                        title: 'Error',
                        description: r.error,
                        variant: 'destructive',
                    });
                }
            });
        },
        [id, current, router, toast],
    );

    const onDelete = React.useCallback(() => {
        startTransition(async () => {
            const r = await deleteBankTransaction(id);
            if (r.success) {
                toast({ title: 'Transaction deleted.' });
                router.push('/dashboard/crm/banking/bank-transactions');
            } else {
                toast({
                    title: 'Error',
                    description: r.error,
                    variant: 'destructive',
                });
            }
        });
    }, [id, router, toast]);

    return (
        <div className="flex flex-wrap items-center gap-2">
            <Button
                size="sm"
                variant={current === 'cleared' ? 'default' : 'outline'}
                onClick={() => moveTo('cleared')}
                disabled={isPending || current === 'cleared'}
            >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Cleared
            </Button>
            <Button
                size="sm"
                variant={current === 'reconciled' ? 'default' : 'outline'}
                onClick={() => moveTo('reconciled')}
                disabled={isPending || current === 'reconciled'}
            >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Reconciled
            </Button>
            <Button
                size="sm"
                variant="outline"
                onClick={() => moveTo('pending')}
                disabled={isPending || current === 'pending'}
            >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reopen
            </Button>
            <Button
                size="sm"
                variant="outline"
                onClick={() => moveTo('archived')}
                disabled={isPending || current === 'archived'}
            >
                <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
            </Button>
            <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={isPending}
            >
                {isPending ? (
                    <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                Delete
            </Button>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. The linked voucher entry (if any)
                            is not affected.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={onDelete} disabled={isPending}>
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
