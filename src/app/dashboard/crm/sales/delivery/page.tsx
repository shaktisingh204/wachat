

'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Truck, LoaderCircle } from "lucide-react";
import Link from 'next/link';
import { getDeliveryChallans } from '@/app/actions/crm-delivery-challans.actions';
import type { WithId, CrmDeliveryChallan, CrmAccount } from '@/lib/definitions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';

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

    const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        const s = status.toLowerCase();
        if(s === 'delivered') return 'default';
        if(s === 'in transit') return 'secondary';
        if(s === 'returned') return 'destructive';
        return 'outline'; // Draft
    };

    if (isLoading && challans.length === 0) {
        return (
             <div className="flex justify-center items-center h-full">
                <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" />
             </div>
        )
    }

    if (!isLoading && challans.length === 0) {
        return (
            <div className="flex justify-center items-center h-full">
                <Card className="text-center max-w-2xl">
                    <CardHeader>
                        <div className="mx-auto bg-muted p-4 rounded-full w-fit">
                            <Truck className="h-12 w-12 text-primary" />
                        </div>
                        <CardTitle className="mt-4 text-2xl">Delivery Challans</CardTitle>
                        <CardDescription>
                            Create, Share, and Track Delivery Challans for Transportation or Delivery of Goods.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Button asChild>
                            <Link href="/dashboard/crm/sales/delivery/new">
                                <Plus className="mr-2 h-4 w-4" />
                                Create First Delivery Challan
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Truck className="h-8 w-8" />
                        Delivery Challans
                    </h1>
                    <p className="text-muted-foreground">Manage your delivery challans.</p>
                </div>
                <Button asChild>
                    <Link href="/dashboard/crm/sales/delivery/new">
                        <Plus className="mr-2 h-4 w-4" />
                        New Challan
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Challans</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Challan #</TableHead>
                                    <TableHead>Client</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {challans.map(challan => (
                                    <TableRow key={challan._id.toString()}>
                                        <TableCell className="font-medium">{challan.challanNumber}</TableCell>
                                        <TableCell>{accountsMap.get(challan.accountId.toString()) || 'Unknown'}</TableCell>
                                        <TableCell>{new Date(challan.challanDate).toLocaleDateString()}</TableCell>
                                        <TableCell><Badge variant={getStatusVariant(challan.status)}>{challan.status}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
