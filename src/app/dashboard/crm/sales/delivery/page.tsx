'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Truck, LoaderCircle } from "lucide-react";
import Link from 'next/link';
import { getDeliveryChallans } from '@/app/actions/crm-delivery-challans.actions';
import type { WithId, CrmDeliveryChallan } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';

import { ClayButton, ClayCard, ClayBadge } from '@/components/clay';
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

    const getStatusTone = (status: string): 'green' | 'amber' | 'red' | 'rose-soft' => {
        const s = status.toLowerCase();
        if (s === 'delivered') return 'green';
        if (s === 'in transit') return 'amber';
        if (s === 'returned') return 'red';
        return 'rose-soft';
    };

    if (isLoading && challans.length === 0) {
        return (
            <div className="flex justify-center items-center h-full">
                <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
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
                <ClayCard variant="outline" className="border-dashed">
                    <div className="flex flex-col items-center gap-3 py-12 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
                            <Truck className="h-6 w-6 text-accent-foreground" strokeWidth={1.75} />
                        </div>
                        <h3 className="text-[15px] font-semibold text-foreground">Delivery Challans</h3>
                        <p className="max-w-md text-[12.5px] text-muted-foreground">
                            Create, share, and track delivery challans for transportation or delivery of goods.
                        </p>
                        <Link href="/dashboard/crm/sales/delivery/new">
                            <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                                Create First Delivery Challan
                            </ClayButton>
                        </Link>
                    </div>
                </ClayCard>
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
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}>
                            New Challan
                        </ClayButton>
                    </Link>
                }
            />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Recent Challans</h2>
                </div>
                <div className="overflow-x-auto rounded-lg border border-border">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-border hover:bg-transparent">
                                <TableHead className="text-muted-foreground">Challan #</TableHead>
                                <TableHead className="text-muted-foreground">Client</TableHead>
                                <TableHead className="text-muted-foreground">Date</TableHead>
                                <TableHead className="text-muted-foreground">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {challans.map(challan => (
                                <TableRow key={challan._id.toString()} className="border-border">
                                    <TableCell className="font-medium text-foreground">{challan.challanNumber}</TableCell>
                                    <TableCell className="text-foreground">{accountsMap.get(challan.accountId.toString()) || 'Unknown'}</TableCell>
                                    <TableCell className="text-foreground">{new Date(challan.challanDate).toLocaleDateString()}</TableCell>
                                    <TableCell><ClayBadge tone={getStatusTone(challan.status)} dot>{challan.status}</ClayBadge></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </ClayCard>
        </div>
    );
}
