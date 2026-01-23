'use client';

import { useState, useEffect, useCallback, useTransition, useMemo } from 'react';
import type { WithId } from 'mongodb';
import { getCrmAccounts, archiveCrmAccount, unarchiveCrmAccount } from '@/app/actions/crm-accounts.actions';
import { useRouter } from 'next/navigation';
import type { CrmAccount } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Search, Plus, Upload, Users, FileText, MoreVertical, Archive, Edit, Activity, File, FilePlus, ChevronRight, ChevronsUpDown, ArchiveRestore } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebouncedCallback } from 'use-debounce';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CrmAddClientDialog } from '@/components/wabasimplify/crm-add-client-dialog';
import { ClientReportButton } from '@/components/wabasimplify/client-report-button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuGroup } from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ACCOUNTS_PER_PAGE = 20;

function ClientsPageSkeleton() {
    return (
        <Card>
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-64 mt-2" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-24" />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="mb-4 flex flex-wrap gap-4 items-center">
                    <Skeleton className="h-10 flex-grow" />
                </div>
                <div className="border rounded-md">
                    <Skeleton className="h-64 w-full" />
                </div>
            </CardContent>
        </Card>
    );
}

export default function CrmClientsPage() {
    const [accounts, setAccounts] = useState<WithId<CrmAccount>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();
    const { toast } = useToast();

    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalPages, setTotalPages] = useState(0);
    const [activeTab, setActiveTab] = useState('active');

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const { accounts: data, total } = await getCrmAccounts(currentPage, ACCOUNTS_PER_PAGE, searchQuery, activeTab as any);
            setAccounts(data);
            setTotalPages(Math.ceil(total / ACCOUNTS_PER_PAGE));
        });
    }, [currentPage, searchQuery, activeTab]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1);
    }, 300);

    const handleArchiveAccount = async (accountId: string) => {
        const result = await archiveCrmAccount(accountId);
        if (result.success) {
            toast({ title: 'Success', description: 'Account archived successfully.' });
            fetchData();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };
    
    const handleUnarchiveAccount = async (accountId: string) => {
        const result = await unarchiveCrmAccount(accountId);
        if (result.success) {
            toast({ title: 'Success', description: 'Account unarchived successfully.' });
            fetchData();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    };
    
    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Users className="h-8 w-8" />
                        Clients & Prospects
                    </h1>
                    <p className="text-muted-foreground">Manage your customer pipeline from prospect to deal.</p>
                </div>
                <div className="flex items-center gap-2">
                    <ClientReportButton />
                    <CrmAddClientDialog onClientAdded={fetchData} />
                </div>
            </div>
            
            <Card>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <CardHeader>
                        <CardTitle>All Accounts</CardTitle>
                        <CardDescription>A list of all companies in your CRM.</CardDescription>
                        <div className="flex justify-between items-center pt-4">
                             <TabsList>
                                <TabsTrigger value="active">Active</TabsTrigger>
                                <TabsTrigger value="archived">Archived</TabsTrigger>
                            </TabsList>
                            <div className="relative w-full max-w-sm">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name, industry, or website..."
                                    className="pl-8"
                                    onChange={(e) => handleSearch(e.target.value)}
                                    defaultValue={searchQuery}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                         <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Account Name</TableHead>
                                        <TableHead>Industry</TableHead>
                                        <TableHead>Phone</TableHead>
                                        <TableHead>Status</TableHead>
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
                                    ) : accounts.length > 0 ? (
                                        accounts.map((account) => (
                                            <TableRow key={account._id.toString()}>
                                                <TableCell>
                                                    <Link href={`/dashboard/crm/accounts/${account._id.toString()}`} className="font-medium flex items-center gap-2 hover:underline">
                                                        <Building className="h-4 w-4 text-muted-foreground"/>
                                                        {account.name}
                                                    </Link>
                                                </TableCell>
                                                <TableCell>{account.industry || 'N/A'}</TableCell>
                                                <TableCell>{account.phone || 'N/A'}</TableCell>
                                                <TableCell>
                                                    <Badge variant={account.status === 'archived' ? 'outline' : 'secondary'} className="capitalize">
                                                        {account.status || 'active'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onSelect={() => router.push(`/dashboard/crm/accounts/${account._id.toString()}/edit`)}>
                                                                <Edit className="mr-2 h-4 w-4" />Edit
                                                            </DropdownMenuItem>
                                                            {account.status !== 'archived' ? (
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10">
                                                                            <Archive className="mr-2 h-4 w-4" />Archive
                                                                        </DropdownMenuItem>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader><AlertDialogTitle>Archive Account?</AlertDialogTitle><AlertDialogDescription>Archiving this account will hide it from the main list but will not delete its data.</AlertDialogDescription></AlertDialogHeader>
                                                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleArchiveAccount(account._id!.toString())}>Archive</AlertDialogAction></AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            ) : (
                                                                <DropdownMenuItem onSelect={() => handleUnarchiveAccount(account._id!.toString())}>
                                                                    <ArchiveRestore className="mr-2 h-4 w-4" />Unarchive
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">No accounts found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Tabs>
            </Card>
        </div>
    );
}