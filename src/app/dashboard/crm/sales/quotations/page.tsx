'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText, LoaderCircle } from 'lucide-react';
import { getQuotations } from '@/app/actions/crm-quotations.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { WithId, CrmQuotation } from '@/lib/definitions';
import Link from 'next/link';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../_components/crm-page-header';

export default function QuotationsPage() {
    const [quotations, setQuotations] = useState<WithId<CrmQuotation>[]>([]);
    const [accountsMap, setAccountsMap] = useState<Map<string, string>>(new Map());
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [quotationsData, accountsData] = await Promise.all([
                getQuotations(),
                getCrmAccounts()
            ]);
            setQuotations(quotationsData.quotations);
            const newMap = new Map(accountsData.accounts.map(acc => [acc._id.toString(), acc.name]));
            setAccountsMap(newMap);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'ghost' => {
        const s = status.toLowerCase();
        if (s === 'accepted') return 'success';
        if (s === 'sent') return 'warning';
        if (s === 'declined' || s === 'expired') return 'danger';
        return 'ghost';
    };

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Quotations & Estimates"
                subtitle="Create and manage your sales quotations."
                icon={FileText}
                actions={
                    <Link href="/dashboard/crm/sales/quotations/new">
                        <ZoruButton>
                            <Plus className="h-4 w-4" strokeWidth={1.75} />
                            New Quotation
                        </ZoruButton>
                    </Link>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-zoru-ink">Recent Quotations</h2>
                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">A list of quotations you have created.</p>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Quotation #</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Client</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted text-right">Amount</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {isLoading ? (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={5} className="text-center h-24">
                                        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            ) : quotations.length > 0 ? (
                                quotations.map(q => (
                                    <ZoruTableRow key={q._id.toString()} className="border-zoru-line cursor-pointer">
                                        <ZoruTableCell className="text-zoru-ink">{q.quotationNumber}</ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">{accountsMap.get(q.accountId.toString()) || 'Unknown Client'}</ZoruTableCell>
                                        <ZoruTableCell className="text-zoru-ink">{new Date(q.quotationDate).toLocaleDateString()}</ZoruTableCell>
                                        <ZoruTableCell><ZoruBadge variant={getStatusVariant(q.status)}>{q.status}</ZoruBadge></ZoruTableCell>
                                        <ZoruTableCell className="text-right text-zoru-ink">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: q.currency || 'INR' }).format(q.total)}</ZoruTableCell>
                                    </ZoruTableRow>
                                ))
                            ) : (
                                <ZoruTableRow className="border-zoru-line">
                                    <ZoruTableCell colSpan={5} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                                        No quotations found.
                                    </ZoruTableCell>
                                </ZoruTableRow>
                            )}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}
