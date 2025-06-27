
'use client';

import { useEffect, useState, useCallback, useTransition, useMemo } from 'react';
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

    const fetchProject = useCallback(async () => {
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

    const fetchContacts = useCallback(async (phoneId: string) => {
        if (!project || !phoneId) return;
        setLoadingContacts(true);
        const contactsData = await getContactsForProject(project._id.toString(), phoneId);
        setContacts(contactsData);
        setLoadingContacts(false);
        return contactsData;
    }, [project]);

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
            setContacts(prev => prev.map(c => c._id === contact._id ? { ...c, unreadCount: 0 } : c));
        }
    }, [fetchConversation]);

    useEffect(() => {
        if (selectedPhoneNumberId) {
            fetchContacts(selectedPhoneNumberId).then(fetchedContacts => {
                if (initialContactId) {
                    const contactToSelect = fetchedContacts.find(c => c._id.toString() === initialContactId);
                    if (contactToSelect) {
                        handleSelectContact(contactToSelect);
                    }
                }
            });
        }
    }, [selectedPhoneNumberId, fetchContacts, initialContactId, handleSelectContact]);
    
    // Polling for real-time updates
    useEffect(() => {
        if (!isClient) return;

        const interval = setInterval(() => {
            startPollingTransition(async () => {
                if (selectedPhoneNumberId) {
                    const contactsData = await getContactsForProject(project!._id.toString(), selectedPhoneNumberId);
                    setContacts(contactsData);
                }
                if (selectedContact) {
                    const conversationData = await getConversation(selectedContact._id.toString());
                    setConversation(conversationData);
                    const currentContact = contacts.find(c => c._id === selectedContact._id);
                    if (currentContact && currentContact.unreadCount && currentContact.unreadCount > 0) {
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
            await fetchContacts(selectedPhoneNumberId);
            handleSelectContact(result.contact);
            setIsNewChatDialogOpen(false);
        }
    };


    if (!isClient || loadingProject) {
        return <div className="flex h-[calc(100vh-150px)]"><Skeleton className="h-full w-full" /></div>;
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
            <div className="flex flex-col h-[calc(100vh-150px)] border rounded-lg bg-card">
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
                        isLoading={loadingContacts}
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
