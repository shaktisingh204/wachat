
'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import type { WithId, Contact } from '@/lib/definitions';

export function KanbanCard({ contact }: { contact: WithId<Contact> }) {
    const router = useRouter();

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('contactId', contact._id.toString());
    };

    const handleGoToChat = () => {
        router.push(`/dashboard/chat?contactId=${contact._id.toString()}`);
    }

    return (
        <Card 
            draggable 
            onDragStart={handleDragStart} 
            className="cursor-grab active:cursor-grabbing bg-card"
        >
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="text-sm font-semibold">{contact.name}</CardTitle>
                    {contact.unreadCount && contact.unreadCount > 0 && (
                        <Badge variant="default" className="h-5 w-5 flex items-center justify-center p-0">{contact.unreadCount}</Badge>
                    )}
                </div>
                <CardDescription className="text-xs">{contact.waId}</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-xs text-muted-foreground line-clamp-2">
                    {contact.lastMessage || 'No recent activity.'}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                    {/* Tags would go here if implemented on the card */}
                </div>
            </CardContent>
            <CardFooter>
                 <Button variant="outline" size="sm" className="w-full" onClick={handleGoToChat}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Open Chat
                 </Button>
            </CardFooter>
        </Card>
    );
}
