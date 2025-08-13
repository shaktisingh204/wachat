
'use client';

import { useState, useEffect, useCallback, useTransition, useMemo } from 'react';
import type { WithId } from 'mongodb';
import { getCrmContacts } from '@/app/actions/crm.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import { useRouter } from 'next/navigation';
import type { CrmContact, CrmAccount } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Search, Plus, Upload, Users, FileText } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebouncedCallback } from 'use-debounce';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CrmAddClientDialog } from '@/components/wabasimplify/crm-add-client-dialog';
import { ClientReportButton } from '@/components/wabasimplify/client-report-button';

const CONTACTS_PER_PAGE = 20;

function ClientsPageSkeleton() {
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

export default function CrmClientsPage() {
    const [contacts, setContacts] = useState<WithId<CrmContact>[]>([]);
    const [accounts, setAccounts] = useState<WithId<CrmAccount>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();

    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [{ contacts: data, total }, accountsData] = await Promise.all([
                getCrmContacts(currentPage, CONTACTS_PER_PAGE, searchQuery),
                getCrmAccounts()
            ]);
            setContacts(data);
            setTotalPages(Math.ceil(total / CONTACTS_PER_PAGE));
            setAccounts(accountsData.accounts);
        });
    }, [currentPage, searchQuery]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1);
    }, 300);
    
    const leadScoreColor = (score: number) => {
        if (score > 75) return 'text-green-600';
        if (score > 50) return 'text-yellow-600';
        return 'text-red-600';
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
                <CardHeader>
                    <CardTitle>All Contacts</CardTitle>
                    <CardDescription>A list of all contacts in your CRM.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, email, or company..."
                                className="pl-8"
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Contact</TableHead>
                                    <TableHead>Company</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Lead Score</TableHead>
                                    <TableHead>Assigned To</TableHead>
                                    <TableHead>Last Activity</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : contacts.length > 0 ? (
                                    contacts.map((contact) => (
                                        <TableRow key={contact._id.toString()} onClick={() => router.push(`/dashboard/crm/contacts/${contact._id.toString()}`)} className="cursor-pointer">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={contact.avatarUrl} data-ai-hint="person avatar" />
                                                        <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium">{contact.name}</div>
                                                        <div className="text-sm text-muted-foreground">{contact.email}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>{contact.company || 'N/A'}</TableCell>
                                            <TableCell><Badge variant="secondary">{contact.status}</Badge></TableCell>
                                            <TableCell><span className={`font-bold ${leadScoreColor(contact.leadScore || 0)}`}>{contact.leadScore || 0}</span></TableCell>
                                            <TableCell>{contact.assignedTo || 'Unassigned'}</TableCell>
                                            <TableCell>{contact.lastActivity ? new Date(contact.lastActivity).toLocaleDateString() : 'N/A'}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">No contacts found.</TableCell>
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
