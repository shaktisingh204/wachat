
'use client';

import { useState, useEffect, useCallback, useTransition, useMemo } from 'react';
import type { WithId } from 'mongodb';
import { getSmsContacts } from '@/app/actions/sms.actions';
import { getSession } from '@/app/actions/index.ts';
import type { SmsContact, Tag, User } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Search, Plus, UserPlus, FileUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebouncedCallback } from 'use-debounce';
import { SmsAddContactDialog } from '@/components/wabasimplify/sms-add-contact-dialog';
import { SmsImportContactsDialog } from '@/components/wabasimplify/sms-import-contacts-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

const CONTACTS_PER_PAGE = 20;

export default function SmsContactsPage() {
    const [contacts, setContacts] = useState<WithId<SmsContact>[]>([]);
    const [isLoading, startTransition] = useTransition();

    const [searchQuery, setSearchQuery] = useState('');

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const data = await getSmsContacts();
            setContacts(data);
        });
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
    }, 300);

    const filteredContacts = useMemo(() => {
        if (!searchQuery) return contacts;
        const lowercasedQuery = searchQuery.toLowerCase();
        return contacts.filter(contact => 
            contact.name.toLowerCase().includes(lowercasedQuery) ||
            contact.phone.includes(searchQuery)
        );
    }, [contacts, searchQuery]);
    
    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline">SMS Contacts</h1>
                    <p className="text-muted-foreground">Manage your SMS contact lists.</p>
                </div>
                <div className="flex items-center gap-2">
                    <SmsImportContactsDialog onImported={fetchData} />
                    <SmsAddContactDialog onAdded={fetchData} />
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>All Contacts</CardTitle>
                    <CardDescription>A list of all contacts for your SMS campaigns.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <div className="relative w-full max-w-sm">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or phone..."
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
                                    <TableHead>Phone Number</TableHead>
                                    <TableHead>Added</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    [...Array(5)].map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell colSpan={3}><Skeleton className="h-10 w-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredContacts.length > 0 ? (
                                    filteredContacts.map((contact) => (
                                        <TableRow key={contact._id.toString()} className="cursor-pointer">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarFallback>{contact.name.charAt(0).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="font-medium">{contact.name}</div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">{contact.phone}</TableCell>
                                            <TableCell>{formatDistanceToNow(new Date(contact.createdAt), { addSuffix: true })}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">No contacts found.</TableCell>
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

    