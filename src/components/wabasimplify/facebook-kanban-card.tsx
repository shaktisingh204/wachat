'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import type { WithId, FacebookSubscriber } from '@/lib/definitions';

export function FacebookKanbanCard({ conversation }: { conversation: WithId<FacebookSubscriber> }) {
    const router = useRouter();

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('subscriberId', conversation._id.toString());
    };

    const handleGoToChat = () => {
        router.push(`/dashboard/facebook/messages?psid=${conversation.psid}`);
    }

    return (
        <Card 
            draggable 
            onDragStart={handleDragStart} 
            className="cursor-grab active:cursor-grabbing bg-card"
        >
            <CardHeader className="flex-row items-center gap-3 p-3">
                <Avatar>
                    <AvatarImage src={`https://graph.facebook.com/${conversation.psid}/picture`} alt={conversation.name} data-ai-hint="person avatar"/>
                    <AvatarFallback>{conversation.name.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                     <CardTitle className="text-sm font-semibold">{conversation.name}</CardTitle>
                     <CardDescription className="text-xs font-mono">{conversation.psid}</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="px-3 pb-3">
                <p className="text-xs text-muted-foreground line-clamp-2">
                    {conversation.snippet || 'No recent messages.'}
                </p>
            </CardContent>
            <CardFooter className="p-3 pt-0">
                 <Button variant="outline" size="sm" className="w-full" onClick={handleGoToChat}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    View Conversation
                 </Button>
            </CardFooter>
        </Card>
    );
}
