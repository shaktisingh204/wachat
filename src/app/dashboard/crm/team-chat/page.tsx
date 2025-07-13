
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, MessageSquare, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const mockTeamMembers = [
  { id: '1', name: 'Alex Johnson', role: 'Admin', avatar: 'https://placehold.co/100x100.png', aiHint: 'man portrait', lastMessage: 'Sure, I\'ll get on that.', lastMessageTime: new Date(Date.now() - 5 * 60 * 1000), online: true },
  { id: '2', name: 'Maria Garcia', role: 'Sales Rep', avatar: 'https://placehold.co/100x100.png', aiHint: 'woman portrait', lastMessage: 'Can you check the new lead?', lastMessageTime: new Date(Date.now() - 30 * 60 * 1000), online: false },
  { id: '3', name: 'Chen Wei', role: 'Support Agent', avatar: 'https://placehold.co/100x100.png', aiHint: 'man face', lastMessage: 'Ticket #123 has been resolved.', lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000), online: true },
];

const mockMessages = {
  '1': [
    { sender: 'You', text: 'Hey Alex, can you approve the new budget proposal?', time: new Date(Date.now() - 10 * 60 * 1000) },
    { sender: 'Alex Johnson', text: 'Sure, I\'ll get on that.', time: new Date(Date.now() - 5 * 60 * 1000) },
  ],
  '2': [
     { sender: 'Maria Garcia', text: 'Can you check the new lead that just came in from Acme Corp?', time: new Date(Date.now() - 30 * 60 * 1000) },
  ],
  '3': [],
};


export default function TeamChatPage() {
    const [selectedUser, setSelectedUser] = useState(mockTeamMembers[0]);

    return (
        <div className="flex flex-col gap-8 h-full">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><MessageSquare /> Team Chat</h1>
                <p className="text-muted-foreground">Communicate with your team members directly within the CRM.</p>
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
                        {mockTeamMembers.map(user => (
                            <button key={user.id} onClick={() => setSelectedUser(user)} className={cn("flex w-full items-center gap-3 p-3 text-left hover:bg-accent", selectedUser.id === user.id && "bg-muted")}>
                                <Avatar className="relative">
                                    <AvatarImage src={user.avatar} data-ai-hint={user.aiHint} />
                                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                    {user.online && <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background"></div>}
                                </Avatar>
                                <div className="flex-1 overflow-hidden">
                                    <p className="font-semibold truncate text-sm">{user.name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{user.lastMessage}</p>
                                </div>
                                <p className="text-xs text-muted-foreground">{format(user.lastMessageTime, 'p')}</p>
                            </button>
                        ))}
                    </ScrollArea>
                </div>
                <div className="w-2/3 flex flex-col">
                    <div className="p-4 border-b flex items-center gap-3">
                         <Avatar className="relative">
                            <AvatarImage src={selectedUser.avatar} data-ai-hint={selectedUser.aiHint} />
                            <AvatarFallback>{selectedUser.name.charAt(0)}</AvatarFallback>
                             {selectedUser.online && <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background"></div>}
                        </Avatar>
                        <div>
                            <p className="font-semibold">{selectedUser.name}</p>
                            <p className="text-sm text-muted-foreground">{selectedUser.role}</p>
                        </div>
                    </div>
                    <ScrollArea className="flex-1 p-4 bg-muted/30">
                        <div className="space-y-4">
                            {(mockMessages as any)[selectedUser.id].map((msg: any, index: number) => (
                                <div key={index} className={cn("flex items-end gap-2", msg.sender === 'You' ? 'justify-end' : 'justify-start')}>
                                    {msg.sender !== 'You' && <Avatar className="h-8 w-8"><AvatarFallback>{msg.sender.charAt(0)}</AvatarFallback></Avatar>}
                                    <div className={cn("max-w-md rounded-lg p-3 text-sm", msg.sender === 'You' ? 'bg-primary text-primary-foreground' : 'bg-background border')}>
                                        <p>{msg.text}</p>
                                        <p className={cn("text-xs mt-1", msg.sender === 'You' ? 'text-primary-foreground/70' : 'text-muted-foreground')}>{format(msg.time, 'p')}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                    <div className="p-4 border-t bg-background">
                         <form className="flex gap-2">
                            <Input placeholder={`Message ${selectedUser.name}...`} className="flex-1" />
                            <Button type="submit"><Send className="h-4 w-4" /></Button>
                        </form>
                    </div>
                </div>
            </Card>
        </div>
    );
}
