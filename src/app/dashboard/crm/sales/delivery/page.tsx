'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Truck, LoaderCircle } from "lucide-react";
import Link from 'next/link';
import { getDeliveryChallans } from '@/app/actions/crm-delivery-challans.actions';
import type { WithId, CrmDeliveryChallan } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';

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

export default function DeliveryChallansPage() {
    const [challans, setChallans] = useState<WithId<CrmDeliveryChallan>[]>([]);
    const [accountsMap, setAccountsMap] = useState<Map<string, string>>(new Map());
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [challansData, accountsData] = await Promise.all([
                getDeliveryChallans(),
                getCrmAccounts()
            ]);
            setChallans(challansData.challans);
            const newMap = new Map(accountsData.accounts.map(acc => [acc._id.toString(), acc.name]));
            setAccountsMap(newMap);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'ghost' => {
        const s = status.toLowerCase();
        if (s === 'delivered') return 'success';
        if (s === 'in transit') return 'warning';
        if (s === 'returned') return 'danger';
        return 'ghost';
    };

    if (isLoading && challans.length === 0) {
        return (
            <div className="flex justify-center items-center h-full">
                <LoaderCircle className="h-8 w-8 animate-spin text-zoru-ink-muted" />
            </div>
        );
    }

    if (!isLoading && challans.length === 0) {
        return (
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    title="Delivery Challans"
                    subtitle="Create, share, and track delivery challans."
                    icon={Truck}
                />
                <ZoruCard className="p-6 border-dashed">
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zoru-surface-2">
                            <Truck className="h-6 w-6 text-zoru-ink" strokeWidth={1.75} />
                        </div>
                        <h3 className="text-[15px] text-zoru-ink">Delivery Challans</h3>
                        <p className="max-w-md text-[12.5px] text-zoru-ink-muted">
                            Create, share, and track delivery challans for transportation or delivery of goods.
                        </p>
                        <Link href="/dashboard/crm/sales/delivery/new">
                            <ZoruButton>
                                <Plus className="h-4 w-4" strokeWidth={1.75} />
                                Create First Delivery Challan
                            </ZoruButton>
                        </Link>
                    </div>
                </ZoruCard>
            </div>
        );
    }

    return (
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Delivery Challans"
                subtitle="Manage your delivery challans."
                icon={Truck}
                actions={
                    <Link href="/dashboard/crm/sales/delivery/new">
                        <ZoruButton>
                            <Plus className="h-4 w-4" strokeWidth={1.75} />
                            New Challan
                        </ZoruButton>
                    </Link>
                }
            />

            <ZoruCard className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] text-zoru-ink">Recent Challans</h2>
                </div>
                <div className="overflow-x-auto rounded-lg border border-zoru-line">
                    <ZoruTable>
                        <ZoruTableHeader>
                            <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                <ZoruTableHead className="text-zoru-ink-muted">Challan #</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Client</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
                                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                            </ZoruTableRow>
                        </ZoruTableHeader>
                        <ZoruTableBody>
                            {challans.map(challan => (
                                <ZoruTableRow key={challan._id.toString()} className="border-zoru-line">
                                    <ZoruTableCell className="text-zoru-ink">{challan.challanNumber}</ZoruTableCell>
                                    <ZoruTableCell className="text-zoru-ink">{accountsMap.get(challan.accountId.toString()) || 'Unknown'}</ZoruTableCell>
                                    <ZoruTableCell className="text-zoru-ink">{new Date(challan.challanDate).toLocaleDateString()}</ZoruTableCell>
                                    <ZoruTableCell><ZoruBadge variant={getStatusVariant(challan.status)}>{challan.status}</ZoruBadge></ZoruTableCell>
                                </ZoruTableRow>
                            ))}
                        </ZoruTableBody>
                    </ZoruTable>
                </div>
            </ZoruCard>
        </div>
    );
}
