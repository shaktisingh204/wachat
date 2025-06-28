
'use client';

import { useEffect, useState, useCallback, useTransition, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { getProjectById, getContactsForProject, getConversation, markConversationAsRead, findOrCreateContact } from '@/app/actions';
import type { WithId } from 'mongodb';
import type { Project, Contact, AnyMessage } from '@/app/actions';

import { ChatContactList } from './chat-contact-list';
import { ChatWindow } from './chat-window';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, MessageSquare } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { NewChatDialog } from './new-chat-dialog';
import { useToast } from '@/hooks/use-toast';

const CONTACTS_PER_PAGE = 30;

export function ChatClient() {
    const searchParams = useSearchParams();
    const initialContactId = useMemo(() => searchParams.get('contactId'), [searchParams]);
    const initialPhoneId = useMemo(() => searchParams.get('phoneId'), [searchParams]);
    
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [contacts, setContacts] = useState<WithId<Contact>[]>([]);
    const [selectedContact, setSelectedContact] = useState<WithId<Contact> | null>(null);
    const [conversation, setConversation] = useState<AnyMessage[]>([]);

    const [loadingProject, setLoadingProject] = useState(true);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const [loadingConversation, setLoadingConversation] = useState(false);
    
    const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>('');
    const [isNewChatDialogOpen, setIsNewChatDialogOpen] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const [isPolling, startPollingTransition] = useTransition();
    const { toast } = useToast();

    // Pagination state for contacts
    const [contactPage, setContactPage] = useState(1);
    const [hasMoreContacts, setHasMoreContacts] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const loadMoreContactsRef = useRef<HTMLDivElement>(null);


    const fetchInitialContacts = useCallback(async (phoneId: string) => {
        if (!project || !phoneId) return null;
        setLoadingContacts(true);
        setContacts([]);
        setContactPage(1);
        setHasMoreContacts(true);
        const { contacts: contactsData, total } = await getContactsForProject(project._id.toString(), phoneId, 1, CONTACTS_PER_PAGE);
        setContacts(contactsData);
        setHasMoreContacts(contactsData.length < total);
        setLoadingContacts(false);
        return contactsData;
    }, [project]);

    const loadMoreContacts = useCallback(async () => {
        if (!project || !selectedPhoneNumberId || isFetchingMore || !hasMoreContacts) return;
        
        setIsFetchingMore(true);
        const nextPage = contactPage + 1;
        const { contacts: newContacts, total } = await getContactsForProject(project._id.toString(), selectedPhoneNumberId, nextPage, CONTACTS_PER_PAGE);
        
        if (newContacts.length > 0) {
            setContacts(prev => [...prev, ...newContacts]);
            setContactPage(nextPage);
        }
        setHasMoreContacts(contacts.length + newContacts.length < total);
        setIsFetchingMore(false);
    }, [project, selectedPhoneNumberId, isFetchingMore, hasMoreContacts, contactPage, contacts.length]);

    // Intersection Observer for infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    loadMoreContacts();
                }
            },
            { threshold: 1.0 }
        );

        const currentRef = loadMoreContactsRef.current;
        if (currentRef) {
            observer.observe(currentRef);
        }

        return () => {
            if (currentRef) {
                observer.unobserve(currentRef);
            }
        };
    }, [loadMoreContacts]);

    const fetchProject = useCallback(async () => {
        setLoadingProject(true);
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (storedProjectId) {
            const projectData = await getProjectById(storedProjectId);
            setProject(projectData);
            if (initialPhoneId) {
                setSelectedPhoneNumberId(initialPhoneId);
            } else if (projectData?.phoneNumbers && projectData.phoneNumbers.length > 0) {
                setSelectedPhoneNumberId(projectData.phoneNumbers[0].id);
            }
        }
        setLoadingProject(false);
    }, [initialPhoneId]);

    const fetchConversation = useCallback(async (contactId: string) => {
        setLoadingConversation(true);
        const conversationData = await getConversation(contactId);
        setConversation(conversationData);
        setLoadingConversation(false);
    }, []);

    useEffect(() => {
        setIsClient(true);
        fetchProject();
    }, [fetchProject]);

    const handleSelectContact = useCallback(async (contact: WithId<Contact>) => {
        setSelectedContact(contact);
        await fetchConversation(contact._id.toString());
        if (contact.unreadCount && contact.unreadCount > 0) {
            await markConversationAsRead(contact._id.toString());
            // Optimistically update UI
            setContacts(prev => prev.map(c => c._id.toString() === contact._id.toString() ? { ...c, unreadCount: 0 } : c));
        }
    }, [fetchConversation]);

    useEffect(() => {
        if (selectedPhoneNumberId) {
            fetchInitialContacts(selectedPhoneNumberId).then(fetchedContacts => {
                if (initialContactId && fetchedContacts) {
                    const contactToSelect = fetchedContacts.find(c => c._id.toString() === initialContactId);
                    if (contactToSelect) {
                        handleSelectContact(contactToSelect);
                    }
                }
            });
        }
    }, [selectedPhoneNumberId, fetchInitialContacts, initialContactId, handleSelectContact]);
    
    // Polling for real-time updates
    useEffect(() => {
        if (!isClient) return;

        const interval = setInterval(() => {
            startPollingTransition(async () => {
                if (project && selectedPhoneNumberId) {
                    // Refresh first page of contacts to get updates
                    const { contacts: updatedContacts } = await getContactsForProject(project._id.toString(), selectedPhoneNumberId, 1, CONTACTS_PER_PAGE);
                    // Merge updates without changing order or removing loaded contacts
                    setContacts(prev => {
                        const updatedContactsMap = new Map(updatedContacts.map(c => [c._id.toString(), c]));
                        const newContacts = prev.map(oldC => updatedContactsMap.get(oldC._id.toString()) || oldC);
                        return newContacts;
                    });
                }
                if (selectedContact) {
                    const conversationData = await getConversation(selectedContact._id.toString());
                    setConversation(conversationData);
                    const currentContactState = contacts.find(c => c._id.toString() === selectedContact._id.toString());
                    if (currentContactState?.unreadCount && currentContactState.unreadCount > 0) {
                        await markConversationAsRead(selectedContact._id.toString());
                    }
                }
            });
        }, 5000); // Poll every 5 seconds

        return () => clearInterval(interval);
    }, [isClient, selectedContact, contacts, project, selectedPhoneNumberId]);

    const handleNewChat = async (waId: string) => {
        if (!project || !selectedPhoneNumberId) {
            toast({ title: 'Error', description: 'Project and phone number must be selected.', variant: 'destructive' });
            return;
        }
        const result = await findOrCreateContact(project._id.toString(), selectedPhoneNumberId, waId);
        if (result.error) {
            toast({ title: 'Error', description: result.error, variant: 'destructive'});
        }
        if (result.contact) {
            await fetchInitialContacts(selectedPhoneNumberId);
            handleSelectContact(result.contact);
            setIsNewChatDialogOpen(false);
        }
    };


    if (!isClient || loadingProject) {
        return <div className="flex h-full"><Skeleton className="h-full w-full" /></div>;
    }

    if (!project) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>
                    Please select a project from the main dashboard page to use the live chat.
                </AlertDescription>
            </Alert>
        );
    }

    return (
        <>
            <NewChatDialog
                open={isNewChatDialogOpen}
                onOpenChange={setIsNewChatDialogOpen}
                onStartChat={handleNewChat}
            />
            <div className="flex flex-col h-full border rounded-lg bg-card">
                <div className="p-4 border-b">
                    <div className="max-w-sm">
                        <Select value={selectedPhoneNumberId} onValueChange={setSelectedPhoneNumberId}>
                            <SelectTrigger id="phoneNumberId">
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
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 flex-1 overflow-hidden">
                    <ChatContactList
                        contacts={contacts}
                        selectedContactId={selectedContact?._id.toString()}
                        onSelectContact={handleSelectContact}
                        onNewChat={() => setIsNewChatDialogOpen(true)}
                        isLoading={loadingContacts && contactPage === 1}
                        hasMoreContacts={hasMoreContacts}
                        loadMoreRef={loadMoreContactsRef}
                    />

                    <div className="md:col-span-2 lg:col-span-3 border-l h-full flex flex-col">
                        {selectedContact ? (
                            <ChatWindow
                                key={selectedContact._id.toString()}
                                contact={selectedContact}
                                conversation={conversation}
                                isLoading={loadingConversation}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4 p-8 text-center">
                                <MessageSquare className="h-16 w-16" />
                                <h2 className="text-xl font-semibold">Select a conversation</h2>
                                <p>Choose a contact from the list or start a new chat.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
