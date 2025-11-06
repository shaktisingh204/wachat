

'use client';

import { useEffect, useState, useCallback, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getContactsPageData } from '@/app/actions/index.ts';
import type { WithId } from 'mongodb';
import type { Project, Contact, Tag } from '@/lib/definitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Users, MessageSquare, Search, LoaderCircle, Check, ChevronsUpDown } from 'lucide-react';
import { AddContactDialog } from '@/components/wabasimplify/add-contact-dialog';
import { ImportContactsDialog } from '@/components/wabasimplify/import-contacts-dialog';
import { useDebouncedCallback } from 'use-debounce';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useProject } from '@/context/project-context';


const CONTACTS_PER_PAGE = 20;

function ContactsPageSkeleton() {
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
                    <Skeleton className="h-10 w-full sm:w-auto sm:min-w-[250px]" />
                    <Skeleton className="h-10 flex-grow" />
                </div>
                <div className="border rounded-md">
                    <Skeleton className="h-64 w-full" />
                </div>
            </CardContent>
        </Card>
    );
}

function TagsFilter({ tags, selectedTags, onSelectionChange }: { tags: Tag[], selectedTags: string[], onSelectionChange: (tags: string[]) => void }) {
    const [open, setOpen] = useState(false);
    
    const handleSelect = (tagId: string) => {
        const newSelected = selectedTags.includes(tagId)
            ? selectedTags.filter(id => id !== tagId)
            : [...selectedTags, tagId];
        onSelectionChange(newSelected);
    };

    return (
         <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full sm:w-[200px] justify-between">
                    <span className="truncate">
                        {selectedTags.length > 0 ? `${selectedTags.length} tag(s) selected` : "Filter by tags..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search tags..." />
                    <CommandList>
                        <CommandEmpty>No tags found.</CommandEmpty>
                        <CommandGroup>
                             {(tags || []).map((tag) => (
                                <CommandItem
                                    key={tag._id}
                                    value={tag.name}
                                    onSelect={() => handleSelect(tag._id)}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", selectedTags.includes(tag._id) ? "opacity-100" : "opacity-0")} />
                                    <span className="w-4 h-4 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                                    <span>{tag.name}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

export default function ContactsPage() {
    const { activeProject, activeProjectId } = useProject();
    const [contacts, setContacts] = useState<WithId<Contact>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>('');
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const currentPage = Number(searchParams.get('page')) || 1;
    const searchQuery = searchParams.get('query') || '';
    const selectedTags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    
    const [totalPages, setTotalPages] = useState(0);
    
    const fetchData = useCallback((projectId: string, phoneId: string, page: number, query: string, tags: string[]) => {
        startTransition(async () => {
            const data = await getContactsPageData(projectId, phoneId, page, query, tags);
            setContacts(data.contacts);
            setTotalPages(Math.ceil(data.total / CONTACTS_PER_PAGE));
            
            if (!phoneId && data.selectedPhoneNumberId) {
                setSelectedPhoneNumberId(data.selectedPhoneNumberId);
            }
        });
    }, []);

     useEffect(() => {
        if (activeProjectId) {
            fetchData(activeProjectId, selectedPhoneNumberId, currentPage, searchQuery, selectedTags);
        }
    }, [activeProjectId, selectedPhoneNumberId, currentPage, searchQuery, selectedTags, fetchData]);


    const updateSearchParam = useDebouncedCallback((key: string, value: string | null) => {
        const params = new URLSearchParams(searchParams);
        if (value && value.trim() !== '') {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        if (key !== 'page') {
            params.set('page', '1');
        }
        router.replace(`${pathname}?${params.toString()}`);
    }, 300);
    
    const handlePhoneChange = (phoneId: string) => {
        setSelectedPhoneNumberId(phoneId);
        updateSearchParam('page', '1');
        updateSearchParam('query', null);
        updateSearchParam('tags', null);
    }

    const handleMessageContact = (contact: WithId<Contact>) => {
        router.push(`/dashboard/chat?contactId=${contact._id.toString()}&phoneId=${contact.phoneNumberId}`);
    };

    const isLoadingData = isLoading && contacts.length === 0;

    return (
        <div className="flex flex-col gap-8">
             <div>
                <h1 className="text-3xl font-bold font-headline">Contacts</h1>
                <p className="text-muted-foreground">
                    {activeProject ? `Manage the contact list for project "${activeProject.name}".` : 'Manage your customer contact list.'}
                </p>
            </div>
            
            {!activeProjectId ? (
                 <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Project Selected</AlertTitle>
                    <AlertDescription>
                        Please select a project from the main dashboard page to manage contacts.
                    </AlertDescription>
                </Alert>
            ) : isLoadingData ? (
                <ContactsPageSkeleton />
            ) : (
                <Card>
                    <CardHeader>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div>
                                <CardTitle>Contact List</CardTitle>
                                <CardDescription>Select a business number to view its associated contacts.</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                {activeProject && (
                                    <>
                                        <ImportContactsDialog project={activeProject} selectedPhoneNumberId={selectedPhoneNumberId} />
                                        <AddContactDialog project={activeProject} selectedPhoneNumberId={selectedPhoneNumberId} />
                                    </>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                         <div className="mb-4 flex flex-wrap gap-4 items-center">
                            <Select value={selectedPhoneNumberId} onValueChange={handlePhoneChange} disabled={!activeProject?.phoneNumbers || activeProject.phoneNumbers.length === 0}>
                                <SelectTrigger id="phoneNumberId" className="w-full sm:w-auto sm:min-w-[250px]">
                                    <SelectValue placeholder="Select a phone number..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {(activeProject?.phoneNumbers || []).map((phone) => (
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
                                    defaultValue={searchQuery}
                                    onChange={(e) => updateSearchParam('query', e.target.value)}
                                />
                            </div>
                            <TagsFilter 
                                tags={activeProject?.tags || []} 
                                selectedTags={selectedTags}
                                onSelectionChange={(tags) => updateSearchParam('tags', tags.join(','))}
                            />
                        </div>

                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>WhatsApp ID</TableHead>
                                        <TableHead>Tags</TableHead>
                                        <TableHead>Last Activity</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                 <TableBody>
                                    {isLoading && contacts.length === 0 ? (
                                         <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center">
                                                <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                                            </TableCell>
                                        </TableRow>
                                    ) : contacts.length > 0 ? (
                                        contacts.map((contact) => (
                                        <TableRow key={contact._id.toString()}>
                                            <TableCell className="font-medium">{contact.name}</TableCell>
                                            <TableCell className="font-mono text-sm">{contact.waId}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {(contact.tagIds || []).map(tagId => {
                                                        const tag = activeProject?.tags?.find(t => t._id === tagId);
                                                        return tag ? (
                                                            <Badge key={tagId} className="rounded" style={{ backgroundColor: tag.color, color: '#fff' }}>
                                                                {tag.name}
                                                            </Badge>
                                                        ) : null;
                                                    })}
                                                </div>
                                            </TableCell>
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
                                            <TableCell colSpan={5} className="h-24 text-center">No contacts found.</TableCell>
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
                                    onClick={() => updateSearchParam('page', String(currentPage - 1))}
                                    disabled={currentPage <= 1 || isLoading}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateSearchParam('page', String(currentPage + 1))}
                                    disabled={currentPage >= totalPages || isLoading}
                                >
                                    Next
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
