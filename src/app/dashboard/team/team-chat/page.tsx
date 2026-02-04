'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageSquare, Search, Bell, BellOff } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getInvitedUsers } from '@/app/actions/team.actions';
import { getErrorMessage } from '@/lib/utils';
import { getOrCreateDmChannel, getChannelMessages, sendTeamMessage } from '@/app/actions/team-chat.actions';
import { getSession } from '@/app/actions/index';
import type { WithId, User, TeamMessage, TeamChannel } from '@/lib/definitions';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function TeamChatPage() {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [teamMembers, setTeamMembers] = useState<WithId<User>[]>([]);
    const [selectedUser, setSelectedUser] = useState<WithId<User> | null>(null);
    const [currentChannel, setCurrentChannel] = useState<WithId<TeamChannel> | null>(null);
    const [messages, setMessages] = useState<WithId<TeamMessage>[]>([]);
    const [messageInput, setMessageInput] = useState('');
    const [isLoadingMembers, startLoadingMembers] = useTransition();
    const [isLoadingMessages, startLoadingMessages] = useTransition();
    const [isSending, startSending] = useTransition();
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
    const scrollRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    // Check notification permission on mount
    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setNotificationPermission(Notification.permission);
        }
    }, []);

    const requestNotificationPermission = async () => {
        if (!('Notification' in window)) {
            toast({ title: 'Not Supported', description: 'This browser does not support desktop notifications.', variant: 'destructive' });
            return;
        }
        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);
        if (permission === 'granted') {
            toast({ title: 'Notifications Enabled', description: 'You will now be notified of new messages.' });
            new Notification('WaChat Team', { body: 'Notifications enabled!' });
        }
    };

    // Fetch initial data (Current User & Team Members)
    useEffect(() => {
        startLoadingMembers(async () => {
            const [sessionData, members] = await Promise.all([getSession(), getInvitedUsers()]);
            if (sessionData?.user) {
                setCurrentUser(sessionData.user);
                // Filter out current user from team members list
                setTeamMembers(members.filter((m: any) => m._id.toString() !== sessionData.user._id));
            }
        });
    }, []);

    // Handle user selection & Channel switching
    useEffect(() => {
        if (!selectedUser || !currentUser) return;

        const loadChannel = async () => {
            startLoadingMessages(async () => {
                const channel = await getOrCreateDmChannel(selectedUser._id.toString());
                setCurrentChannel(channel);
                if (channel) {
                    const msgs = await getChannelMessages(channel._id.toString());
                    setMessages(msgs);
                } else {
                    setMessages([]);
                }
            });
        };
        loadChannel();
    }, [selectedUser, currentUser]);

    // Polling for new messages
    useEffect(() => {
        if (!currentChannel) return;

        const interval = setInterval(async () => {
            const newMessages = await getChannelMessages(currentChannel._id.toString());

            // Check for new messages to notify
            if (newMessages.length > messages.length && messages.length > 0) {
                const latestMsg = newMessages[newMessages.length - 1];
                // Notify if message is NOT from current user and document is hidden OR permission granted
                if (latestMsg.senderId.toString() !== currentUser?._id.toString() && notificationPermission === 'granted') {
                    new Notification(`New message from ${selectedUser?.name || 'Team'}`, {
                        body: latestMsg.content,
                        icon: '/icon.png' // Optional: Add app icon if available
                    });
                }
            }

            setMessages(newMessages);
        }, 3000); // Poll every 3 seconds

        return () => clearInterval(interval);
    }, [currentChannel, messages.length, notificationPermission, currentUser, selectedUser]); // Include dependencies for correct logic

    // Scroll to bottom on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);


    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!messageInput.trim() || !currentChannel) return;

        const content = messageInput;
        setMessageInput(''); // Optimistic clear

        startSending(async () => {
            const result = await sendTeamMessage(currentChannel._id.toString(), content);
            if (result.success) {
                const msgs = await getChannelMessages(currentChannel._id.toString());
                setMessages(msgs);
            } else {
                toast({ title: 'Error', description: result.error || 'Failed to send', variant: 'destructive' });
                setMessageInput(content); // Restore input on fail
            }
        });
    };

    if (!currentUser) return <div className="p-4"><Skeleton className="h-[600px] w-full" /></div>;

    return (
        <div className="flex flex-col gap-8 h-full">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><MessageSquare /> Team Chat</h1>
                    <p className="text-muted-foreground">Communicate with your team members directly.</p>
                </div>
                {notificationPermission === 'default' && (
                    <Button variant="outline" onClick={requestNotificationPermission}>
                        <Bell className="mr-2 h-4 w-4" />
                        Enable Notifications
                    </Button>
                )}
                {notificationPermission === 'denied' && (
                    <Button variant="outline" disabled className="text-destructive border-destructive/50">
                        <BellOff className="mr-2 h-4 w-4" />
                        Notifications Blocked
                    </Button>
                )}
                {notificationPermission === 'granted' && (
                    <Button variant="ghost" disabled className="text-green-600 bg-green-50/50">
                        <Bell className="mr-2 h-4 w-4" />
                        Notifications On
                    </Button>
                )}
            </div>
            <Card className="flex-1 flex overflow-hidden">
                <div className="w-1/3 border-r flex flex-col">
                    <div className="p-4 border-b">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search team..." className="pl-8" />
                        </div>
                    </div>
                    <ScrollArea>
                        {teamMembers.map(user => (
                            <button key={user._id.toString()} onClick={() => setSelectedUser(user)} className={cn("flex w-full items-center gap-3 p-3 text-left hover:bg-accent", selectedUser?._id.toString() === user._id.toString() && "bg-muted")}>
                                <Avatar className="relative">
                                    <AvatarImage src={`https://i.pravatar.cc/150?u=${user.email}`} />
                                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-semibold truncate text-sm">{user.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                                </div>
                            </button>
                        ))}
                        {teamMembers.length === 0 && <p className="p-4 text-sm text-center text-muted-foreground">No other team members found.</p>}
                    </ScrollArea>
                </div>
                <div className="w-2/3 flex flex-col">
                    {selectedUser ? (
                        <>
                            <div className="p-4 border-b flex items-center gap-3">
                                <Avatar className="relative">
                                    <AvatarImage src={`https://i.pravatar.cc/150?u=${selectedUser.email}`} />
                                    <AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold">{selectedUser.name}</p>
                                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                                </div>
                            </div>
                            <ScrollArea className="flex-1 p-4 bg-muted/30">
                                {isLoadingMessages ? (
                                    <div className="flex items-center justify-center h-full"><Skeleton className="h-10 w-10 rounded-full animate-spin" /></div>
                                ) : (
                                    <div className="space-y-4">
                                        {messages.length > 0 ? messages.map((msg, index) => (
                                            <div key={msg._id.toString()} className={cn("flex items-end gap-2", msg.senderId.toString() === currentUser._id.toString() ? 'justify-end' : 'justify-start')}>
                                                {msg.senderId.toString() !== currentUser._id.toString() && <Avatar className="h-8 w-8"><AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback></Avatar>}
                                                <div className={cn("max-w-md rounded-lg p-3 text-sm", msg.senderId.toString() === currentUser._id.toString() ? 'bg-primary text-primary-foreground' : 'bg-background border')}>
                                                    <p>{msg.content}</p>
                                                    <p className={cn("text-xs mt-1", msg.senderId.toString() === currentUser._id.toString() ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{format(new Date(msg.createdAt), 'p')}</p>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center text-muted-foreground py-10">
                                                Start a conversation with {selectedUser.name}!
                                            </div>
                                        )}
                                        <div ref={scrollRef} />
                                    </div>
                                )}
                            </ScrollArea>
                            <div className="p-4 border-t bg-background">
                                <form className="flex gap-2" onSubmit={handleSendMessage}>
                                    <Input
                                        placeholder={`Message ${selectedUser.name}...`}
                                        className="flex-1"
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        disabled={isSending}
                                    />
                                    <Button type="submit" disabled={isSending}><Send className="h-4 w-4" /></Button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                            <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                            <p>Select a team member to start chatting.</p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
