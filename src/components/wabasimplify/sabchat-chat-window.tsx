
'use client';

import { useActionState, useRef, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId, SabChatSession, SabChatMessage } from '@/lib/definitions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { ArrowLeft, Info, LoaderCircle, Send } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Input } from '../ui/input';
import { useToast } from '@/hooks/use-toast';
import { postChatMessage } from '@/app/actions/sabchat.actions';

const sendInitialState = { success: false, error: null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="icon" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send</span>
        </Button>
    )
}

function ChatMessage({ message, isAgent }: { message: SabChatMessage, isAgent: boolean }) {
     return (
        <div className={cn("flex items-end gap-2 group/message", isAgent ? "justify-end" : "justify-start")}>
            {!isAgent && (
                <Avatar className="h-8 w-8 self-end">
                    <AvatarFallback>{'V'}</AvatarFallback>
                </Avatar>
            )}
            <div
                className={cn(
                    "max-w-[70%] rounded-lg p-2 px-3 text-sm flex flex-col shadow-sm",
                    isAgent
                        ? "bg-primary text-primary-foreground rounded-br-none"
                        : "bg-white dark:bg-muted rounded-bl-none"
                )}
            >
                <p className="whitespace-pre-wrap">{message.content}</p>
                 <div className={cn("flex items-center gap-1.5 self-end mt-1 text-xs", isAgent ? 'text-primary-foreground/80' : 'text-muted-foreground/80')}>
                    <p>
                        {format(new Date(message.timestamp), 'p')}
                    </p>
                </div>
            </div>
        </div>
    );
}

interface SabChatWindowProps {
    session: WithId<SabChatSession>;
    isLoading: boolean;
    onMessageSent: () => void;
}

export function SabChatWindow({ session, isLoading, onMessageSent }: SabChatWindowProps) {
    const [sendState, sendFormAction] = useActionState(postChatMessage, sendInitialState);
    const formRef = useRef<HTMLFormElement>(null);
    const { toast } = useToast();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (sendState.error) {
            toast({ title: 'Error sending message', description: sendState.error, variant: 'destructive' });
        }
        if (sendState.success) {
            formRef.current?.reset();
            onMessageSent();
        }
    }, [sendState, toast, onMessageSent]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [session.history]);

    return (
        <div className="flex flex-col h-full bg-transparent">
            <div className="flex items-center justify-between gap-3 p-3 border-b bg-background h-[73px] flex-shrink-0">
                <div className="flex items-center gap-3">
                    <Avatar>
                        <AvatarFallback>{session.visitorInfo?.email?.charAt(0).toUpperCase() || 'V'}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{session.visitorInfo?.email || 'New Visitor'}</p>
                    </div>
                </div>
            </div>
            
            <ScrollArea className="flex-1 bg-chat-texture" viewportClassName="scroll-container">
                 {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                         <LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {session.history.map((msg, index) => (
                            <ChatMessage key={index} message={msg} isAgent={msg.sender === 'agent'} />
                        ))}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </ScrollArea>
            
            <div className="flex items-center p-3 border-t bg-background flex-shrink-0">
                 <form ref={formRef} action={sendFormAction} className="w-full flex items-center gap-2">
                    <input type="hidden" name="sessionId" value={session._id.toString()} />
                    <input type="hidden" name="sender" value="agent" />
                    <Input name="content" placeholder="Type your reply..." autoComplete="off" />
                    <SubmitButton />
                </form>
            </div>
        </div>
    );
}
