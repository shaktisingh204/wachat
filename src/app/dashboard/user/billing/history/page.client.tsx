'use client';

import {
    Card,
    CardBody,
    StatCard,
    Alert,
    AlertTitle,
    AlertDescription,
    PageHeader,
    PageHeaderHeading,
    PageTitle,
    PageDescription,
    PageActions,
    Button,
} from '@/components/sabcrm/20ui';
import { ChevronLeft, Receipt, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
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

    // Summary metrics — computed over successful transactions only.
    const summary = useMemo(() => {
        const ok = transactions.filter((t) => t.status === 'SUCCESS');
        const credited = ok
            .filter((t) => t.type === 'CREDIT')
            .reduce((sum, t) => sum + t.amount, 0);
        const debited = ok
            .filter((t) => t.type === 'DEBIT')
            .reduce((sum, t) => sum + t.amount, 0);
        return { count: transactions.length, credited, debited };
    }, [transactions]);

    const formatINR = (paisa: number) =>
        new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0,
        }).format(paisa / 100);

    return (
        <div className="20ui mx-auto flex w-full max-w-[1100px] flex-col gap-[var(--st-space-6)]">
            <PageHeader>
                <PageHeaderHeading>
                    <PageTitle>Billing history</PageTitle>
                    <PageDescription>
                        A record of all your plan upgrades and credit purchases.
                    </PageDescription>
                </PageHeaderHeading>
                <PageActions>
                    <Link href="/dashboard/user/billing">
                        <Button variant="ghost" iconLeft={ChevronLeft}>
                            Back to billing
                        </Button>
                    </Link>
                </PageActions>
            </PageHeader>

            {error && (
                <Alert tone="danger">
                    <AlertTitle>Failed to load transactions</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {isInitialLoad ? (
                <TransactionSkeleton />
            ) : (
                <>
                    {/* Summary strip */}
                    <section
                        aria-label="Transaction summary"
                        className="grid grid-cols-1 gap-[var(--st-space-4)] sm:grid-cols-3"
                    >
                        <StatCard
                            icon={Receipt}
                            label="Transactions"
                            value={<span className="tabular-nums">{summary.count.toLocaleString('en-IN')}</span>}
                        />
                        <StatCard
                            icon={ArrowDownLeft}
                            label="Total credited"
                            value={<span className="tabular-nums">{formatINR(summary.credited)}</span>}
                        />
                        <StatCard
                            icon={ArrowUpRight}
                            label="Total debited"
                            value={<span className="tabular-nums">{formatINR(summary.debited)}</span>}
                        />
                    </section>

                    <Card variant="outlined" padding="none">
                        <CardBody className="flex flex-col gap-[var(--st-space-4)]">
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
                            <TransactionTable
                                transactions={filteredAndSortedTransactions}
                                isLoading={isPending}
                                filtersActive={
                                    !!searchQuery.trim() ||
                                    filterType !== 'ALL' ||
                                    filterStatus !== 'ALL'
                                }
                                onClearFilters={() => {
                                    setSearchQuery('');
                                    setFilterType('ALL');
                                    setFilterStatus('ALL');
                                }}
                            />
                        </CardBody>
                    </Card>
                </>
            )}
        </div>
    );
}
