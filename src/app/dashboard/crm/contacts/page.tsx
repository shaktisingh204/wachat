'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { getCrmContacts } from '@/app/actions/crm.actions';
import { getCrmAccounts } from '@/app/actions/crm-accounts.actions';
import type { CrmContact, CrmAccount } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Search, Users, Mail, Phone, MoreHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebouncedCallback } from 'use-debounce';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CrmAddContactDialog } from '@/components/wabasimplify/crm-add-contact-dialog';

const CONTACTS_PER_PAGE = 15;

function ContactsPageSkeleton() {
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

export default function CrmContactsPage() {
    const [contacts, setContacts] = useState<WithId<CrmContact>[]>([]);
    const [accounts, setAccounts] = useState<WithId<CrmAccount>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const router = useRouter();

    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [totalPages, setTotalPages] = useState(0);

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [contactsResponse, accountsResponse] = await Promise.all([
                getCrmContacts(currentPage, CONTACTS_PER_PAGE, searchQuery),
                getCrmAccounts(1, 1000) // Fetch all for dialog dropdown
            ]);
            setContacts(contactsResponse.contacts);
            setTotalPages(Math.ceil(contactsResponse.total / CONTACTS_PER_PAGE));
            setAccounts(accountsResponse.accounts);
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
        if (score > 75) return 'text-green-600 bg-green-50';
        if (score > 50) return 'text-yellow-600 bg-yellow-50';
        return 'text-red-600 bg-red-50';
    };

    if (isLoading && contacts.length === 0) {
        return <ContactsPageSkeleton />;
    }

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                        <Users className="h-8 w-8" />
                        Contacts
                    </h1>
                    <p className="text-muted-foreground">Manage your customer database and personal interactions.</p>
                </div>
                <div className="flex items-center gap-2">
                    <CrmAddContactDialog onAdded={fetchData} accounts={accounts} />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Contacts Directory</CardTitle>
                    <CardDescription>A list of all individuals in your CRM.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, email, or phone..."
                                className="pl-8"
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="border rounded-md overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Contact Info</TableHead>
                                    <TableHead>Job Title</TableHead>
                                    <TableHead>Lead Score</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Last Activity</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={7}><Skeleton className="h-16 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : contacts.length > 0 ? (
                                    contacts.map((contact) => (
                                        <TableRow key={contact._id.toString()} className="hover:bg-muted/50">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={contact.avatarUrl || ''} />
                                                        <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-medium hover:underline cursor-pointer">
                                                            <Link href={`/dashboard/crm/contacts/${contact._id.toString()}`}>
                                                                {contact.name}
                                                            </Link>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">Added {new Date(contact.createdAt).toLocaleDateString()}</div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1 text-sm">
                                                    {contact.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" /> {contact.email}</div>}
                                                    {contact.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" /> {contact.phone}</div>}
                                                </div>
                                            </TableCell>
                                            <TableCell>{contact.jobTitle || 'N/A'}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={leadScoreColor(contact.leadScore || 0)}>
                                                    {contact.leadScore || 0}
                                                </Badge>
                                            </TableCell>
                                            <TableCell><Badge variant="secondary">{contact.status}</Badge></TableCell>
                                            <TableCell>{contact.lastActivity ? new Date(contact.lastActivity).toLocaleDateString() : 'Never'}</TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem asChild>
                                                            <Link href={`/dashboard/crm/contacts/${contact._id.toString()}`}>View Details</Link>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem>Create Deal</DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">No contacts found.</TableCell>
                                    </TableRow>
                                )
                                }
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
