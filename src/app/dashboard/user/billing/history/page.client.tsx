'use client';

import {
    Card,
    CardBody,
    CardHeader,
    CardTitle,
    Alert,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
} from '@/components/sabcrm/20ui';
import { ChevronLeft } from 'lucide-react';
import type { WalletTransaction } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import Link from 'next/link';
import { getSession } from '@/app/actions';
import { useEffect, useState, useTransition, useMemo, useCallback } from 'react';
import { TransactionTable } from './transaction-table';
import { TransactionFilters, SortOption, FilterType, FilterStatus } from './transaction-filters';
import { TransactionSkeleton } from './transaction-skeleton';

export default function BillingHistoryPage() {
    const [transactions, setTransactions] = useState<WithId<WalletTransaction>[]>([]);
    const [isPending, startTransition] = useTransition();
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<FilterType>('ALL');
    const [filterStatus, setFilterStatus] = useState<FilterStatus>('ALL');
    const [sortOption, setSortOption] = useState<SortOption>('date-desc');

    const fetchTransactions = useCallback(() => {
        setError(null);
        startTransition(async () => {
            try {
                const session = await getSession();
                const walletTransactions = session?.user?.wallet?.transactions || [];
                setTransactions(walletTransactions);
            } catch (err) {
                console.error("Failed to fetch transactions:", err);
                setError("Failed to load transactions. Please try again.");
            } finally {
                setIsInitialLoad(false);
            }
        });
    }, []);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const filteredAndSortedTransactions = useMemo(() => {
        let result = [...transactions];

        // Apply filters
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(t => t.reason.toLowerCase().includes(query));
        }

        if (filterType !== 'ALL') {
            result = result.filter(t => t.type === filterType);
        }

        if (filterStatus !== 'ALL') {
            result = result.filter(t => t.status === filterStatus);
        }

        // Apply sorting
        result.sort((a, b) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();

            switch (sortOption) {
                case 'date-desc':
                    return dateB - dateA;
                case 'date-asc':
                    return dateA - dateB;
                case 'amount-desc':
                    return b.amount - a.amount;
                case 'amount-asc':
                    return a.amount - b.amount;
                default:
                    return 0;
            }
        });

        return result;
    }, [transactions, searchQuery, filterType, filterStatus, sortOption]);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-4">
                <Link
                    href="/dashboard/user/billing"
                    className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--st-text-secondary)] transition-colors hover:text-[var(--st-text)]"
                >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Back to Billing
                </Link>
                <PageHeader bordered={false}>
                    <PageHeaderHeading>
                        <PageTitle>Billing History</PageTitle>
                        <PageDescription>
                            A record of all your plan upgrades and credit purchases.
                        </PageDescription>
                    </PageHeaderHeading>
                </PageHeader>
            </div>

            {error && (
                <Alert tone="danger" title="Error">
                    {error}
                </Alert>
            )}

            {isInitialLoad ? (
                <TransactionSkeleton />
            ) : (
                <Card variant="outlined">
                    <CardHeader className="pb-4">
                        <CardTitle className="mb-4">Your Transactions</CardTitle>
                        <TransactionFilters
                            searchQuery={searchQuery}
                            setSearchQuery={setSearchQuery}
                            filterType={filterType}
                            setFilterType={setFilterType}
                            filterStatus={filterStatus}
                            setFilterStatus={setFilterStatus}
                            sortOption={sortOption}
                            setSortOption={setSortOption}
                            onRefresh={fetchTransactions}
                            isRefreshing={isPending}
                        />
                    </CardHeader>
                    <CardBody>
                        <TransactionTable
                            transactions={filteredAndSortedTransactions}
                            isLoading={isPending}
                        />
                    </CardBody>
                </Card>
            )}
        </div>
    );
}
