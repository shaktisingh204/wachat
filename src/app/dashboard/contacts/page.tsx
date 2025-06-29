

'use client';

import { useEffect, useState, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getContactsPageData, getProjects } from '@/app/actions';
import type { WithId } from 'mongodb';
import type { Project, Contact } from '@/app/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Users, MessageSquare, Search } from 'lucide-react';
import { AddContactDialog } from '@/components/wabasimplify/add-contact-dialog';
import { ImportContactsDialog } from '@/components/wabasimplify/import-contacts-dialog';
import { useDebouncedCallback } from 'use-debounce';
import { Input } from '@/components/ui/input';

const CONTACTS_PER_PAGE = 20;

export default function ContactsPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [contacts, setContacts] = useState<WithId<Contact>[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>('');
    const [isClient, setIsClient] = useState(false);
    const router = useRouter();

    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    
    const fetchData = useCallback(async (phoneId: string, page: number, query: string) => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (!storedProjectId) {
            setLoading(false);
            getProjects().then(projects => {
                if (projects && projects.length > 0) {
                    router.push('/dashboard');
                } else {
                    router.push('/dashboard/setup');
                }
            });
            return;
        }

        setLoading(true);
        const data = await getContactsPageData(storedProjectId, phoneId, page, query);
        
        setProject(data.project);
        setContacts(data.contacts);
        setTotalPages(Math.ceil(data.total / CONTACTS_PER_PAGE));
        setSelectedPhoneNumberId(data.selectedPhoneNumberId);

        setLoading(false);
    }, [router]);

    useEffect(() => {
        setIsClient(true);
        document.title = 'Contacts | Wachat';
    }, []);
    
    useEffect(() => {
        if(isClient) {
            fetchData(selectedPhoneNumberId, currentPage, searchQuery);
        }
    }, [isClient, fetchData, selectedPhoneNumberId, currentPage, searchQuery]);


    const handleSearch = useDebouncedCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1);
    }, 300);
    
    const handlePhoneChange = (phoneId: string) => {
        setSelectedPhoneNumberId(phoneId);
        setCurrentPage(1);
        setSearchQuery('');
    }

    const handleMessageContact = (contact: WithId<Contact>) => {
        router.push(`/dashboard/chat?contactId=${contact._id.toString()}&phoneId=${contact.phoneNumberId}`);
    };

    if (!isClient || (loading && !project)) {
        return (
            <div className="flex flex-col gap-8">
                <div>
                    <Skeleton className="h-8 w-1/3" />
                    <Skeleton className="h-4 w-2/3 mt-2" />
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-1/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-48 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    if (!project) {
        return (
            <div className="flex flex-col gap-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Contacts</h1>
                    <p className="text-muted-foreground">Manage your customer contact list.</p>
                </div>
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard page to manage contacts.
                    </AlertDescription>
                </Alert>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline">Contacts</h1>
                <p className="text-muted-foreground">Manage the contact list for project "{project.name}".</p>
            </div>
            
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <CardTitle>Contact List</CardTitle>
                            <CardDescription>Select a business number to view its associated contacts.</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                             <ImportContactsDialog project={project} selectedPhoneNumberId={selectedPhoneNumberId} />
                             <AddContactDialog project={project} selectedPhoneNumberId={selectedPhoneNumberId} />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="mb-4 flex flex-wrap gap-4 items-center">
                        <Select value={selectedPhoneNumberId} onValueChange={handlePhoneChange} disabled={!project.phoneNumbers || project.phoneNumbers.length === 0}>
                            <SelectTrigger id="phoneNumberId" className="w-full sm:w-auto sm:min-w-[250px]">
                                <SelectValue placeholder="Select a phone number..." />
                            </SelectTrigger>
                            <SelectContent>
                                {(project.phoneNumbers || []).map((phone) => (
                                    <SelectItem key={phone.id} value={phone.id}>
                                        {phone.display_phone_number} ({phone.verified_name})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                         <div className="relative flex-grow">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name or ID..."
                                className="pl-8"
                                onChange={(e) => handleSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>WhatsApp ID</TableHead>
                                    <TableHead>Last Activity</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {contacts.length > 0 ? (
                                    contacts.map((contact) => (
                                    <TableRow key={contact._id.toString()}>
                                        <TableCell className="font-medium">{contact.name}</TableCell>
                                        <TableCell className="font-mono text-sm">{contact.waId}</TableCell>
                                        <TableCell>
                                            {contact.lastMessageTimestamp ? new Date(contact.lastMessageTimestamp).toLocaleString() : 'N/A'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => handleMessageContact(contact)}>
                                                <MessageSquare className="mr-2 h-4 w-4" />
                                                Message
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center">
                                            No contacts found for this phone number.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {totalPages > 1 && (
                        <div className="flex items-center justify-end space-x-2 py-4">
                            <span className="text-sm text-muted-foreground">
                                Page {currentPage} of {totalPages > 0 ? totalPages : 1}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => p - 1)}
                                disabled={currentPage <= 1 || loading}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={currentPage >= totalPages || loading}
                            >
                                Next
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
