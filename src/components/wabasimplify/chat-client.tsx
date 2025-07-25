
'use client';

import { useEffect, useState, useCallback, useTransition, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getInitialChatData, getConversation, findOrCreateContact, getProjects, getSession, markConversationAsRead } from '@/app/actions';
import { getContactsPageData } from '@/app/actions/contact.actions';
import type { WithId } from 'mongodb';
import type { Project, Contact, AnyMessage, Template, User, Plan } from '@/lib/definitions';
import { ChatContactList } from './chat-contact-list';
import { ChatWindow } from './chat-window';
import { ContactInfoPanel } from './contact-info-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, MessageSquare } from 'lucide-react';
import { NewChatDialog } from './new-chat-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card } from '../ui/card';

const CONTACTS_PER_PAGE = 30;

function ChatPageSkeleton() {
    return <Skeleton className="h-full w-full rounded-xl" />;
}


export function ChatClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialContactId = useMemo(() => searchParams.get('contactId'), [searchParams]);
    const initialPhoneId = useMemo(() => searchParams.get('phoneId'), [searchParams]);
    
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [contacts, setContacts] = useState<WithId<Contact>[]>([]);
    const [selectedContact, setSelectedContact] = useState<WithId<Contact> | null>(null);
    const [conversation, setConversation] = useState<AnyMessage[]>([]);
    const [templates, setTemplates] = useState<WithId<Template>[]>([]);
    const [sessionUser, setSessionUser] = useState<(Omit<User, 'password' | 'planId'> & { _id: string, plan?: WithId<Plan> | null }) | null>(null);


    const [isLoading, startLoadingTransition] = useTransition();
    const [loadingConversation, startConversationLoadTransition] = useTransition();
    const [isPolling, startPollingTransition] = useTransition();
    
    const [selectedPhoneNumberId, setSelectedPhoneNumberId] = useState<string>('');
    const [isNewChatDialogOpen, setIsNewChatDialogOpen] = useState(false);
    const [isInfoPanelOpen, setIsInfoPanelOpen] = useState(false);
    const [isClient, setIsClient] = useState(false);
    const { toast } = useToast();

    // Pagination state for contacts
    const [contactPage, setContactPage] = useState(1);
    const [hasMoreContacts, setHasMoreContacts] = useState(true);
    const [isFetchingMore, setIsFetchingMore] = useState(false);
    const loadMoreContactsRef = useRef<HTMLDivElement>(null);

    // Initial data load
    const fetchInitialData = useCallback(async (phoneId?: string | null) => {
        startLoadingTransition(async () => {
            const storedProjectId = localStorage.getItem('activeProjectId');
            if (!storedProjectId) {
                getProjects().then(projects => {
                    if (projects && projects.length > 0) {
                        router.push('/dashboard');
                    } else {
                        router.push('/dashboard/setup');
                    }
                });
                return;
            }

            const [initialData, sessionData] = await Promise.all([
                getInitialChatData(
                    storedProjectId, 
                    phoneId || initialPhoneId,
                    initialContactId
                ),
                getSession()
            ]);

            setProject(initialData.project);
            setContacts(initialData.contacts);
            setHasMoreContacts(initialData.contacts.length < initialData.totalContacts);
            setSelectedContact(initialData.selectedContact);
            setConversation(initialData.conversation);
            setTemplates(initialData.templates);
            setSelectedPhoneNumberId(initialData.selectedPhoneNumberId);
            setSessionUser(sessionData?.user || null);
            setContactPage(1); 
        });
    }, [initialContactId, initialPhoneId, router, startLoadingTransition]);

    useEffect(() => {
        setIsClient(true);
        fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePhoneNumberChange = (phoneId: string) => {
        setSelectedContact(null);
        setConversation([]);
        fetchInitialData(phoneId);
    };

    const handleSelectContact = useCallback(async (contact: WithId<Contact>) => {
        setSelectedContact(contact);
        startConversationLoadTransition(async () => {
            const conversationData = await getConversation(contact._id.toString());
            setConversation(conversationData);
        });

        if (contact.unreadCount && contact.unreadCount > 0) {
            await markConversationAsRead(contact._id.toString());
            setContacts(prev => prev.map(c => c._id.toString() === contact._id.toString() ? { ...c, unreadCount: 0 } : c));
        }
    }, []);

    const loadMoreContacts = useCallback(async () => {
        if (!project || !selectedPhoneNumberId || isFetchingMore || !hasMoreContacts) return;
        
        setIsFetchingMore(true);
        try {
            const nextPage = contactPage + 1;
            const { contacts: newContacts, total } = await getContactsPageData(project._id.toString(), selectedPhoneNumberId, nextPage, '', undefined);
            
            if (newContacts.length > 0) {
                setContacts(prev => [...prev, ...newContacts]);
                setContactPage(nextPage);
            }
            setHasMoreContacts(contacts.length + newContacts.length < total);
        } catch (error) {
            console.error("Failed to fetch more contacts:", error);
            toast({
                title: "Error",
                description: "Failed to load more contacts.",
                variant: "destructive",
            });
            setHasMoreContacts(false);
        } finally {
            setIsFetchingMore(false);
        }
    }, [project, selectedPhoneNumberId, isFetchingMore, hasMoreContacts, contactPage, contacts.length, toast]);

    // Intersection Observer for infinite scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0]?.isIntersecting && !isFetchingMore) {
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
    }, [loadMoreContacts, isFetchingMore]);
    
    // Polling for real-time updates
    useEffect(() => {
        if (!isClient || isLoading) return;

        const interval = setInterval(() => {
            startPollingTransition(async () => {
                if (project && selectedPhoneNumberId) {
                     const { contacts: updatedContacts, total } = await getContactsPageData(project._id.toString(), selectedPhoneNumberId, 1, '', undefined);
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
        }, 5000);

        return () => clearInterval(interval);
    }, [isClient, selectedContact, project, selectedPhoneNumberId, isLoading]);

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
            const { contacts, total } = await getContactsPageData(project._id.toString(), selectedPhoneNumberId, 1, '', undefined);
            setContacts(contacts);
            setHasMoreContacts(contacts.length < total);
            setContactPage(1);

            handleSelectContact(result.contact);
            setIsNewChatDialogOpen(false);
        }
    };
    
    const handleContactUpdate = (updatedContact: WithId<Contact>) => {
        setSelectedContact(updatedContact);
        setContacts(prev => prev.map(c => 
            c._id.toString() === updatedContact._id.toString() ? updatedContact : c
        ));
    };

    if (!isClient || (isLoading && !project)) {
        return <ChatPageSkeleton />;
    }

    return (
        <>
            <NewChatDialog
                open={isNewChatDialogOpen}
                onOpenChange={setIsNewChatDialogOpen}
                onStartChat={handleNewChat}
            />
            <Card className="h-full w-full flex flex-col overflow-hidden bg-muted/30 dark:bg-background">
                <div className="flex flex-1 overflow-hidden">
                    <div className={cn("w-full flex-col border-r bg-background md:w-[320px] flex-shrink-0", selectedContact ? "hidden md:flex" : "flex")}>
                        <ChatContactList
                            sessionUser={sessionUser}
                            project={project}
                            contacts={contacts}
                            selectedContactId={selectedContact?._id.toString()}
                            onSelectContact={handleSelectContact}
                            onNewChat={() => setIsNewChatDialogOpen(true)}
                            isLoading={isLoading && contacts.length === 0}
                            hasMoreContacts={hasMoreContacts}
                            loadMoreRef={loadMoreContactsRef}
                            selectedPhoneNumberId={selectedPhoneNumberId}
                            onPhoneNumberChange={handlePhoneNumberChange}
                        />
                    </div>

                    <div className={cn("w-full flex-col flex-1", selectedContact ? "flex" : "hidden md:flex")}>
                         {selectedContact && project ? (
                            <ChatWindow
                                key={selectedContact._id.toString()}
                                project={project}
                                contact={selectedContact}
                                conversation={conversation}
                                templates={templates}
                                isLoading={loadingConversation}
                                onBack={() => setSelectedContact(null)}
                                onContactUpdate={handleContactUpdate}
                                onInfoToggle={() => setIsInfoPanelOpen(prev => !prev)}
                                isInfoPanelOpen={isInfoPanelOpen}
                            />
                        ) : (
                            <div className="hidden md:flex flex-col items-center justify-center h-full text-muted-foreground gap-4 p-8 text-center bg-chat-texture">
                                <MessageSquare className="h-16 w-16" />
                                <h2 className="text-xl font-semibold">Select a conversation</h2>
                                <p>Choose a contact from the list or start a new chat.</p>
                            </div>
                        )}
                    </div>
                     {isInfoPanelOpen && selectedContact && project && (
                        <div className="w-[340px] border-l hidden lg:block flex-shrink-0 bg-background">
                            <ContactInfoPanel 
                                project={project}
                                contact={selectedContact}
                                onContactUpdate={handleContactUpdate}
                            />
                        </div>
                    )}
                </div>
            </Card>
        </>
    );
}
