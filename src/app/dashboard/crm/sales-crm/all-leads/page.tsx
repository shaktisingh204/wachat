
'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { getCrmLeads } from '@/app/actions/crm-leads.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { CrmLead, CrmAccount } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Search, Plus, UserPlus, Eye, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebouncedCallback } from 'use-debounce';
import Link from 'next/link';

const LEADS_PER_PAGE = 15;

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
    const [leads, setLeads] = useState<WithId<CrmLead>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();

    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const { leads: data, total } = await getCrmLeads(currentPage, LEADS_PER_PAGE, searchQuery);
            setLeads(data);
            setTotalPages(Math.ceil(total / LEADS_PER_PAGE));
        });
    }, [currentPage, searchQuery]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1);
    }, 300);

    const getStatusVariant = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s === 'qualified' || s === 'converted' || s === 'won') return 'default';
        if (s === 'contacted' || s === 'proposal sent' || s === 'negotiation') return 'secondary';
        if (s === 'unqualified' || s === 'lost') return 'destructive';
        return 'outline';
    };

    if (isLoading && leads.length === 0) {
        return <LeadsPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Users className="h-8 w-8" />
                        All Leads
                    </h1>
                    <p className="text-muted-foreground">Manage your incoming leads and sales opportunities.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button asChild>
                        <Link href="/dashboard/crm/sales-crm/all-leads/new">
                            <Plus className="mr-2 h-4 w-4" />
                            Add New Lead
                        </Link>
                    </Button>
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Leads Directory</CardTitle>
                    <CardDescription>A list of all leads in your CRM.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by title, name, email, or company..."
                                className="pl-8"
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Lead Title</TableHead>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Stage</TableHead>
                                    <TableHead>Value</TableHead>
                                    <TableHead>Lead Source</TableHead>
                                    <TableHead>Created At</TableHead>
                                    <TableHead>Next Follow-up</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : leads.length > 0 ? (
                                    leads.map((lead) => (
                                        <TableRow key={lead._id.toString()}>
                                            <TableCell className="font-medium">{lead.title}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{lead.contactName}</div>
                                                <div className="text-xs text-muted-foreground">{lead.email}</div>
                                            </TableCell>
                                            <TableCell>{lead.company || 'N/A'}</TableCell>
                                            <TableCell><Badge variant={getStatusVariant(lead.stage || lead.status)}>{lead.stage || lead.status}</Badge></TableCell>
                                            <TableCell className="font-mono">{new Intl.NumberFormat('en-IN', { style: 'currency', currency: lead.currency || 'INR' }).format(lead.value)}</TableCell>
                                            <TableCell>{lead.source || 'N/A'}</TableCell>
                                            <TableCell>{new Date(lead.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell>{lead.nextFollowUp ? new Date(lead.nextFollowUp).toLocaleDateString() : 'N/A'}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-24 text-center">No leads found.</TableCell>
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
