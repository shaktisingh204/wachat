'use client';

import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruButton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruBadge,
} from '@/components/zoruui';
import { ChevronLeft, Receipt } from 'lucide-react';

import type { WalletTransaction } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import Link from 'next/link';

import { getSession } from '@/app/actions';
import { useEffect, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { LoaderCircle } from 'lucide-react';

export default function BillingHistoryPage() {
    const [transactions, setTransactions] = useState<WithId<WalletTransaction>[]>([]);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        startTransition(async () => {
            const session = await getSession();
            // Transactions are now part of the user's wallet object
            const walletTransactions = session?.user?.wallet?.transactions || [];
            // Sort by most recent first
            const sortedTransactions = walletTransactions.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            setTransactions(sortedTransactions);
        });
    }, []);

    const getStatusVariant = (status: string) => {
        if (status === 'SUCCESS') return 'default';
        if (status === 'PENDING') return 'secondary';
        return 'destructive';
    }

    return (
        <div className="flex flex-col gap-8">
            <div>
                <ZoruButton variant="ghost" asChild className="mb-4 -ml-4">
                    <Link href="/dashboard/user/billing"><ChevronLeft className="mr-2 h-4 w-4" />Back to Billing</Link>
                </ZoruButton>
                <h1 className="text-3xl font-bold font-headline text-zoru-ink">Billing History</h1>
                <p className="text-zoru-ink-muted">A record of all your plan upgrades and credit purchases.</p>
            </div>

            <ZoruCard className="border border-zoru-line bg-zoru-surface/50 shadow-[var(--zoru-shadow-sm)]">
                <ZoruCardHeader>
                    <ZoruCardTitle className="text-zoru-ink">Your Transactions</ZoruCardTitle>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="border border-zoru-line rounded-md bg-zoru-surface/50 overflow-hidden shadow-[var(--zoru-shadow-sm)]">
                        <ZoruTable>
                            <ZoruTableHeader>
                                <ZoruTableRow>
                                    <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Description</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Amount</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {isLoading ? (
                                    <ZoruTableRow>
                                        <ZoruTableCell colSpan={5} className="h-48 text-center">
                                            <div className="flex justify-center items-center">
                                                <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
                                            </div>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                ) : transactions.length > 0 ? (
                                    transactions.map(t => (
                                        <ZoruTableRow key={t._id.toString()}>
                                            <ZoruTableCell className="text-zoru-ink">{format(new Date(t.createdAt), 'PPpp')}</ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink">{t.reason}</ZoruTableCell>
                                            <ZoruTableCell className="text-zoru-ink font-semibold">₹{(t.amount / 100).toFixed(2)}</ZoruTableCell>
                                            <ZoruTableCell>
                                                <ZoruBadge variant={t.type === 'CREDIT' ? 'default' : 'secondary'}>
                                                    {t.type}
                                                </ZoruBadge>
                                            </ZoruTableCell>
                                            <ZoruTableCell><ZoruBadge variant={getStatusVariant(t.status)}>{t.status}</ZoruBadge></ZoruTableCell>
                                        </ZoruTableRow>
                                    ))
                                ) : (
                                    <ZoruTableRow>
                                        <ZoruTableCell colSpan={5} className="h-48 text-center">
                                            <div className="flex flex-col items-center gap-4">
                                                <Receipt className="h-12 w-12 text-zoru-ink-muted" />
                                                <p className="text-zoru-ink-muted">You don't have any transactions yet.</p>
                                            </div>
                                        </ZoruTableCell>
                                    </ZoruTableRow>
                                )}
                            </ZoruTableBody>
                        </ZoruTable>
                    </div>
                </ZoruCardContent>
            </ZoruCard>
        </div>
    );
}
