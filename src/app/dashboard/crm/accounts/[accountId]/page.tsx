
'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams } from 'next/navigation';
import { getCrmAccountById } from '@/app/actions/crm-accounts.actions';
import { getCrmContacts } from '@/app/actions/crm.actions';
import type { CrmAccount, CrmContact, WithId } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building, Link as LinkIcon, Mail, Phone, Users } from 'lucide-react';
import { CrmAccountNotes } from '@/components/wabasimplify/crm-account-notes';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function AccountDetailPageSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-1 space-y-4">
                    <Skeleton className="h-48 w-full" />
                </div>
                <div className="md:col-span-2 space-y-4">
                    <Skeleton className="h-96 w-full" />
                </div>
            </div>
        </div>
    );
}

export default function CrmAccountDetailPage() {
    const params = useParams();
    const accountId = params.accountId as string;
    const [account, setAccount] = useState<WithId<CrmAccount> | null>(null);
    const [contacts, setContacts] = useState<WithId<CrmContact>[]>([]);
    const [isLoading, startTransition] = useTransition();

    useEffect(() => {
        if (accountId) {
            startTransition(async () => {
                const [fetchedAccount, fetchedContacts] = await Promise.all([
                    getCrmAccountById(accountId),
                    getCrmContacts(localStorage.getItem('activeProjectId') || '', 1, 100, undefined, accountId)
                ]);
                setAccount(fetchedAccount);
                setContacts(fetchedContacts.contacts);
            });
        }
    }, [accountId]);

    if (isLoading || !account) {
        return <AccountDetailPageSkeleton />;
    }

    return (
        <div className="space-y-6">
             <div>
                <Button variant="ghost" asChild className="mb-2 -ml-4">
                    <Link href="/dashboard/crm/accounts"><ArrowLeft className="mr-2 h-4 w-4" />Back to All Accounts</Link>
                </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader className="items-center text-center">
                            <div className="p-4 bg-muted rounded-full mb-2">
                                <Building className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <CardTitle>{account.name}</CardTitle>
                            <CardDescription>{account.industry || 'N/A'}</CardDescription>
                        </CardHeader>
                        <CardContent className="text-sm space-y-3">
                             <div className="flex items-center gap-3"><LinkIcon className="h-4 w-4 text-muted-foreground"/><a href={account.website || '#'} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{account.website || 'No website'}</a></div>
                             <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground"/><span>{account.phone || 'N/A'}</span></div>
                        </CardContent>
                    </Card>
                    <CrmAccountNotes accountId={account._id.toString()} notes={account.notes || []} />
                </div>
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/>Associated Contacts</CardTitle></CardHeader>
                        <CardContent>
                           <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Job Title</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {contacts.length > 0 ? contacts.map(contact => (
                                    <TableRow key={contact._id.toString()}>
                                        <TableCell className="font-medium">{contact.name}</TableCell>
                                        <TableCell>{contact.email}</TableCell>
                                        <TableCell>{contact.jobTitle || 'N/A'}</TableCell>
                                    </TableRow>
                                )) : <TableRow><TableCell colSpan={3} className="text-center">No contacts associated with this account.</TableCell></TableRow>}
                            </TableBody>
                           </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
