

'use client';

import { useEffect, useState, useCallback, useTransition, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { getContactsForProject, getConversation, markConversationAsRead, findOrCreateContact, getInitialChatData } from '@/app/actions';
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
import { cn } from '@/lib/utils';

const CONTACTS_PER_PAGE = 30;

export function ChatClient() {
    const searchParams = useSearchParams();
    const initialContactId = useMemo(() => searchParams.get('contactId'), [searchParams]);
    const initialPhoneId = useMemo(() => searchParams.get('phoneId'), [searchParams]);
    
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [contacts, setContacts] = useState<WithId<Contact>[]>([]);
    const [selectedContact, setSelectedContact] = useState<WithId<Contact> | null>(null);
    const [conversation, setConversation] = useState<AnyMessage[]>([]);

    const [loading, setLoading] = useState(true);
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


    // Initial data load - much simpler now
    const fetchInitialData = useCallback(async (phoneId?: string | null) => {
        const storedProjectId = localStorage.getItem('activeProjectId');
        if (!storedProjectId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        // Use the initial params only on the very first load
        const useInitialParams = !project;
        const data = await getInitialChatData(
            storedProjectId, 
            phoneId || (useInitialParams ? initialPhoneId : null),
            useInitialParams ? initialContactId : null
        );

        setProject(data.project);
        setContacts(data.contacts);
        setHasMoreContacts(data.contacts.length < data.totalContacts);
        setSelectedContact(data.selectedContact);
        setConversation(data.conversation);
        setSelectedPhoneNumberId(data.selectedPhoneNumberId);
        setContactPage(1); // Reset page number on new phone number selection

        setLoading(false);
    }, [initialContactId, initialPhoneId, project]);

    useEffect(() => {
        setIsClient(true);
        fetchInitialData();
    }, []); // Only runs once on mount

    const handlePhoneNumberChange = (phoneId: string) => {
        setSelectedContact(null); // Clear selected contact when number changes
        setConversation([]);
        fetchInitialData(phoneId);
    };

    const handleSelectContact = useCallback(async (contact: WithId<Contact>) => {
        setSelectedContact(contact);
        setLoadingConversation(true);
        const conversationData = await getConversation(contact._id.toString());
        setConversation(conversationData);
        setLoadingConversation(false);

        if (contact.unreadCount && contact.unreadCount > 0) {
            await markConversationAsRead(contact._id.toString());
            // Optimistically update UI
            setContacts(prev => prev.map(c => c._id.toString() === contact._id.toString() ? { ...c, unreadCount: 0 } : c));
        }
    }, []);


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
                if (entries[0]?.isIntersecting) {
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
    
    // Polling for real-time updates
    useEffect(() => {
        if (!isClient || loading) return;

        const interval = setInterval(() => {
            startPollingTransition(async () => {
                if (project && selectedPhoneNumberId) {
                     const { contacts: updatedContacts, total } = await getContactsForProject(project._id.toString(), selectedPhoneNumberId, 1, CONTACTS_PER_PAGE);
                    setContacts(prev => {
                        const updatedMap = new Map(updatedContacts.map(c => [c._id.toString(), c]));
                        const mergedContacts = prev.map(old => updatedMap.get(old._id.toString()) || old);
                        const existingIds = new Set(mergedContacts.map(c => c._id.toString()));
                        const brandNewContacts = updatedContacts.filter(c => !existingIds.has(c._id.toString()));
                        const final = [...brandNewContacts, ...mergedContacts];
                        return final.sort((a, b) => new Date(b.lastMessageTimestamp || 0).getTime() - new Date(a.lastMessageTimestamp || 0).getTime());
                    });
                }
                if (selectedContact) {
                    const conversationData = await getConversation(selectedContact._id.toString());
                    setConversation(conversationData);
                }
            });
        }, 7000); // Poll every 7 seconds

        return () => clearInterval(interval);
    }, [isClient, selectedContact, project, selectedPhoneNumberId, loading]);

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
            // Refetch contacts for the current phone number
            const { contacts, total } = await getContactsForProject(project._id.toString(), selectedPhoneNumberId, 1, CONTACTS_PER_PAGE);
            setContacts(contacts);
            setHasMoreContacts(contacts.length < total);
            setContactPage(1);

            handleSelectContact(result.contact);
            setIsNewChatDialogOpen(false);
        }
    };


    if (!isClient || loading) {
        return <div className="flex-1 min-h-0"><Skeleton className="h-full w-full" /></div>;
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
            <div className="flex flex-col flex-1 min-h-0 border rounded-lg bg-card">
                <div className="p-4 border-b flex-shrink-0">
                    <div className="max-w-sm">
                        <Select value={selectedPhoneNumberId} onValueChange={handlePhoneNumberChange}>
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
                <div className="flex flex-1 overflow-hidden">
                     <div className={cn(
                        "w-full flex-col border-r md:w-1/3 lg:w-1/4",
                        selectedContact ? 'hidden md:flex' : 'flex'
                     )}>
                        <ChatContactList
                            contacts={contacts}
                            selectedContactId={selectedContact?._id.toString()}
                            onSelectContact={handleSelectContact}
                            onNewChat={() => setIsNewChatDialogOpen(true)}
                            isLoading={loading && contacts.length === 0}
                            hasMoreContacts={hasMoreContacts}
                            loadMoreRef={loadMoreContactsRef}
                        />
                    </div>

                    <div className={cn(
                        "w-full flex-col flex-1",
                        selectedContact ? 'flex' : 'hidden md:flex'
                    )}>
                        {selectedContact ? (
                            <ChatWindow
                                key={selectedContact._id.toString()}
                                contact={selectedContact}
                                conversation={conversation}
                                isLoading={loadingConversation}
                                onBack={() => setSelectedContact(null)}
                            />
                        ) : (
                            <div className="hidden md:flex flex-col items-center justify-center h-full text-muted-foreground gap-4 p-8 text-center">
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
