'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { getCrmAccountById } from '@/app/actions/crm-accounts.actions';
import { getCrmContacts } from '@/app/actions/crm.actions';
import type { CrmAccount, CrmContact, WithId } from '@/lib/definitions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building, Link as LinkIcon, Mail, Phone, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { CrmNotes } from '@/components/wabasimplify/crm-notes';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ComposeEmailDialog } from '@/components/wabasimplify/crm-compose-email-dialog';

const CONTACTS_PER_PAGE = 5;

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
    const searchParams = useSearchParams();
    const router = useRouter();

    const accountId = params.accountId as string;
    const currentPage = Number(searchParams.get('page')) || 1;

    const [account, setAccount] = useState<WithId<CrmAccount> | null>(null);
    const [contacts, setContacts] = useState<WithId<CrmContact>[]>([]);
    const [totalContacts, setTotalContacts] = useState(0);
    const [isLoading, startTransition] = useTransition();
    const [isComposeOpen, setIsComposeOpen] = useState(false);

    const totalPages = Math.ceil(totalContacts / CONTACTS_PER_PAGE);

    const fetchData = useCallback(() => {
        if (accountId) {
            startTransition(async () => {
                const [fetchedAccount, fetchedContactsData] = await Promise.all([
                    getCrmAccountById(accountId),
                    getCrmContacts(currentPage, CONTACTS_PER_PAGE, undefined, accountId)
                ]);
                setAccount(fetchedAccount);
                setContacts(fetchedContactsData.contacts);
                setTotalContacts(fetchedContactsData.total);
            });
        }
    }, [accountId, currentPage]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', String(newPage));
        router.push(`?${params.toString()}`);
    }

    if (isLoading || !account) {
        return <AccountDetailPageSkeleton />;
    }

    return (
        <>
            <ComposeEmailDialog 
                isOpen={isComposeOpen} 
                onOpenChange={setIsComposeOpen}
                initialTo={contacts.map(c => c.email).join(', ')}
                initialSubject={`Regarding your account: ${account.name}`}
            />
            <div className="space-y-6">
                 <div>
                    <Button variant="ghost" asChild className="mb-2 -ml-4">
                        <Link href="/dashboard/crm/accounts"><ArrowLeft className="mr-2 h-4 w-4" />Back to All Accounts</Link>
                    </Button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
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
                                <Button className="w-full" variant="outline" onClick={() => setIsComposeOpen(true)}>
                                    <Mail className="mr-2 h-4 w-4" /> Email All Contacts
                                </Button>
                                 <div className="flex items-center gap-3 pt-2"><LinkIcon className="h-4 w-4 text-muted-foreground"/><a href={account.website || '#'} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{account.website || 'No website'}</a></div>
                                 <div className="flex items-center gap-3"><Phone className="h-4 w-4 text-muted-foreground"/>
                                    {account.phone ? (
                                        <a href={`tel:${account.phone}`} className="hover:underline">{account.phone}</a>
                                    ) : (
                                        <span>N/A</span>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                        <CrmNotes recordId={account._id.toString()} recordType="account" notes={account.notes || []} />
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
                                        <TableRow key={contact._id.toString()} onClick={() => window.location.href=`/dashboard/crm/contacts/${contact._id.toString()}`} className="cursor-pointer">
                                            <TableCell className="font-medium">{contact.name}</TableCell>
                                            <TableCell>{contact.email}</TableCell>
                                            <TableCell>{contact.jobTitle || 'N/A'}</TableCell>
                                        </TableRow>
                                    )) : <TableRow><TableCell colSpan={3} className="text-center">No contacts associated with this account.</TableCell></TableRow>}
                                </TableBody>
                               </Table>
                               {totalPages > 1 && (
                                <div className="flex items-center justify-end space-x-2 pt-4">
                                     <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                                    <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}><ChevronLeft className="h-4 w-4" /></Button>
                                    <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages}><ChevronRight className="h-4 w-4" /></Button>
                                </div>
                               )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}
