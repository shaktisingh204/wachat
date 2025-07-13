
'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import type { WithId, Contact } from '@/lib/definitions';
import { Draggable } from 'react-beautiful-dnd';

interface KanbanCardProps {
    contact: WithId<Contact>;
    index: number;
}


export function KanbanCard({ contact, index }: KanbanCardProps) {
    const router = useRouter();

    const handleGoToChat = () => {
        router.push(`/dashboard/chat?contactId=${contact._id.toString()}`);
    }

    return (
        <Draggable draggableId={contact._id.toString()} index={index}>
            {(provided) => (
                <div
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                >
                    <Card className="cursor-grab active:cursor-grabbing bg-card">
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
                        </CardContent>
                        <CardFooter>
                            <Button variant="outline" size="sm" className="w-full" onClick={handleGoToChat}>
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Open Chat
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}
        </Draggable>
    );
}
