
'use client';

import { useState, useEffect, useCallback, useTransition, useMemo } from 'react';
import type { WithId } from 'mongodb';
import { getCrmDeals } from '@/app/actions/crm-deals.actions';
import { getCrmContacts } from '@/app/actions/crm.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { useRouter } from 'next/navigation';
import type { CrmDeal, CrmContact, CrmAccount } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Search, Plus, UserPlus, Handshake, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebouncedCallback } from 'use-debounce';
import Link from 'next/link';
import { addCrmLeadAndDeal } from '@/app/actions/crm-deals.actions';

const DEALS_PER_PAGE = 20;

function LeadsPageSkeleton() {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64 mt-2" />
            </CardHeader>
            <CardContent>
                <div className="flex justify-between items-center mb-4">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-48" />
                </div>
                <Skeleton className="h-96 w-full" />
            </CardContent>
        </Card>
    );
}

export default function CrmAllLeadsPage() {
    const [deals, setDeals] = useState<WithId<CrmDeal>[]>([]);
    const [contactsMap, setContactsMap] = useState<Map<string, CrmContact>>(new Map());
    const [accountsMap, setAccountsMap] = useState<Map<string, CrmAccount>>(new Map());
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();

    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [dealsData, contactsData, accountsData] = await Promise.all([
                getCrmDeals(currentPage, DEALS_PER_PAGE, searchQuery),
                getCrmContacts(1, 10000), // Fetch all to create a map
                getCrmAccounts(1, 10000),
            ]);
            setDeals(dealsData.deals || []);
            setTotalPages(Math.ceil(dealsData.total / DEALS_PER_PAGE));
            
            const cMap = new Map(contactsData.contacts.map(c => [c._id.toString(), c]));
            const aMap = new Map(accountsData.accounts.map(a => [a._id.toString(), a]));
            setContactsMap(cMap);
            setAccountsMap(aMap);
        });
    }, [currentPage, searchQuery]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1);
    }, 300);

    const getStageVariant = (stage: string) => {
        const s = stage.toLowerCase();
        if (s === 'won') return 'default';
        if (s === 'lost') return 'destructive';
        return 'secondary';
    };

    if (isLoading && deals.length === 0) {
        return <LeadsPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Handshake className="h-8 w-8" />
                        All Leads
                    </h1>
                    <p className="text-muted-foreground">Manage your sales leads and opportunities.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/dashboard/crm/sales-crm/all-leads/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Create Lead
                        </Link>
                    </Button>
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Leads Pipeline</CardTitle>
                    <CardDescription>A list of all your sales leads.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by deal name, contact, or company..."
                                className="pl-8"
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Deal Name</TableHead>
                                    <TableHead>Contact / Company</TableHead>
                                    <TableHead>Stage</TableHead>
                                    <TableHead className="text-right">Value</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : deals.length > 0 ? (
                                    deals.map((deal) => {
                                        const primaryContact = deal.contactIds?.[0] ? contactsMap.get(deal.contactIds[0].toString()) : null;
                                        const account = deal.accountId ? accountsMap.get(deal.accountId.toString()) : null;
                                        return (
                                            <TableRow key={deal._id.toString()}>
                                                <TableCell className="font-medium">{deal.name}</TableCell>
                                                <TableCell>
                                                    <div>{primaryContact?.name || 'N/A'}</div>
                                                    <div className="text-xs text-muted-foreground">{account?.name || 'N/A'}</div>
                                                </TableCell>
                                                <TableCell><Badge variant={getStageVariant(deal.stage)}>{deal.stage}</Badge></TableCell>
                                                <TableCell className="text-right font-mono">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: deal.currency }).format(deal.value)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button asChild variant="ghost" size="sm">
                                                        <Link href={`/dashboard/crm/deals/${deal._id.toString()}`}>
                                                            <Eye className="mr-2 h-4 w-4"/> View Deal
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">No leads found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
