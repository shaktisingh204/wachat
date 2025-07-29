
'use client';

import { useState } from 'react';
import type { WithId, EmailConversation } from '@/lib/definitions';
import { Card, CardHeader, CardContent, CardFooter } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import { Archive, ArrowRight, CornerDownLeft, MoreVertical, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { EmailReplyBox } from './email-reply-box';

interface EmailThreadProps {
    conversation: WithId<EmailConversation>;
    onStatusChange: (id: string, status: 'read' | 'archived') => void;
}

export function EmailThread({ conversation, onStatusChange }: EmailThreadProps) {
    const [showDetails, setShowDetails] = useState(false);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="p-3 border-b flex-shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar>
                        <AvatarFallback>{conversation.fromName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{conversation.fromName}</p>
                        <p className="text-sm text-muted-foreground">{conversation.fromEmail}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => onStatusChange(conversation._id.toString(), 'archived')}>
                        <Archive className="mr-2 h-4 w-4" /> Archive
                    </Button>
                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                </div>
            </CardHeader>
            <CardContent className="flex-1 p-4 space-y-4 overflow-y-auto">
                <h2 className="text-xl font-bold">{conversation.subject}</h2>
                <div className="space-y-6">
                    {conversation.messages.map((message, index) => (
                        <div key={index} className="flex gap-4">
                            <Avatar>
                                <AvatarFallback>{message.from.split(' ')[0].charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <div className="flex justify-between items-center">
                                    <p className="font-semibold">{message.from}</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(message.date), 'PPpp')}</p>
                                </div>
                                 <div className="prose prose-sm dark:prose-invert max-w-none mt-1 border p-3 rounded-md"
                                      dangerouslySetInnerHTML={{ __html: message.bodyHtml || message.bodyText }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="p-2 border-t">
                <EmailReplyBox conversation={conversation} />
            </CardFooter>
        </Card>
    );
}

