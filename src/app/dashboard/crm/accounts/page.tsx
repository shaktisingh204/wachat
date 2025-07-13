
'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { CrmAccount } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Search, Plus, Building } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebouncedCallback } from 'use-debounce';
import { CrmAddAccountDialog } from '@/components/wabasimplify/crm-add-account-dialog';
import { formatDistanceToNow } from 'date-fns';

const ACCOUNTS_PER_PAGE = 20;

export default function CrmAccountsPage() {
    const [accounts, setAccounts] = useState<WithId<CrmAccount>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();
    const [projectId, setProjectId] = useState<string | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = useCallback(() => {
        if (!projectId) return;
        startTransition(async () => {
            const { accounts: data, total } = await getCrmAccounts(projectId, currentPage, ACCOUNTS_PER_PAGE, searchQuery);
            setAccounts(data);
            setTotalPages(Math.ceil(total / ACCOUNTS_PER_PAGE));
        });
    }, [projectId, currentPage, searchQuery]);

    useEffect(() => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        setProjectId(storedProjectId);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1);
    }, 300);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Accounts (Companies)</h1>
                    <p className="text-muted-foreground">Manage your company-level records.</p>
                </div>
                <div className="flex items-center gap-2">
                    <CrmAddAccountDialog projectId={projectId || ''} onAdded={fetchData} />
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>All Accounts</CardTitle>
                    <CardDescription>A list of all companies in your CRM.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, industry, or website..."
                                className="pl-8"
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Account Name</TableHead>
                                    <TableHead>Industry</TableHead>
                                    <TableHead>Website</TableHead>
                                    <TableHead>Created</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={4}><Skeleton className="h-10 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : accounts.length > 0 ? (
                                    accounts.map((account) => (
                                        <TableRow key={account._id.toString()} onClick={() => router.push(`/dashboard/crm/accounts/${account._id.toString()}`)} className="cursor-pointer">
                                            <TableCell>
                                                <div className="font-medium flex items-center gap-2">
                                                    <Building className="h-4 w-4 text-muted-foreground"/>
                                                    {account.name}
                                                </div>
                                            </TableCell>
                                            <TableCell>{account.industry || 'N/A'}</TableCell>
                                            <TableCell>{account.website || 'N/A'}</TableCell>
                                            <TableCell>{formatDistanceToNow(new Date(account.createdAt), { addSuffix: true })}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">No accounts found.</TableCell>
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
