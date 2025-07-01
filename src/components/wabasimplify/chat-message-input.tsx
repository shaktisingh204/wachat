
'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { getCannedMessages, handleSendMessage, handleSendMetaFlow, type CannedMessage, type MetaFlow } from '@/app/actions';
import type { WithId } from 'mongodb';
import type { Contact } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, LoaderCircle, Star, ServerCog } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatMessageInputProps {
    contact: WithId<Contact>;
    metaFlows: WithId<MetaFlow>[];
}

const sendInitialState = {
  message: null,
  error: null,
};

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="icon" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send Message</span>
        </Button>
    );
}

export function ChatMessageInput({ contact, metaFlows }: ChatMessageInputProps) {
    const [sendState, sendFormAction] = useActionState(handleSendMessage, sendInitialState);
    const formRef = useRef<HTMLFormElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mainInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const [inputValue, setInputValue] = useState('');
    const [cannedMessages, setCannedMessages] = useState<WithId<CannedMessage>[]>([]);
    const [cannedPopoverOpen, setCannedPopoverOpen] = useState(false);
    const [flowPopoverOpen, setFlowPopoverOpen] = useState(false);
    const [isSendingFlow, startFlowSendTransition] = useTransition();

    useEffect(() => {
        getCannedMessages(contact.projectId.toString()).then(setCannedMessages);
    }, [contact.projectId]);

    useEffect(() => {
        if (sendState.error) {
            toast({ title: 'Error sending message', description: sendState.error, variant: 'destructive' });
        }
        if (sendState.message) {
            formRef.current?.reset();
            setInputValue('');
        }
    }, [sendState, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        setCannedPopoverOpen(val.startsWith('/'));
    };

    const handleSelectCanned = (message: WithId<CannedMessage>) => {
        if (message.type === 'text' && message.content.text) {
            setInputValue(message.content.text);
            setCannedPopoverOpen(false);
            mainInputRef.current?.focus();
        } else {
             toast({
                title: 'Unsupported',
                description: 'This feature currently only supports text-based canned replies.',
            });
        }
    };

    const handleFileChange = () => {
        setTimeout(() => {
            formRef.current?.requestSubmit();
        }, 100);
    };

     const handleSendFlow = (flowId: string) => {
        startFlowSendTransition(async () => {
            const result = await handleSendMetaFlow(contact._id.toString(), flowId);
            if (result.error) {
                toast({ title: 'Error Sending Flow', description: result.error, variant: 'destructive' });
            } else {
                toast({ title: 'Success', description: result.message });
                setFlowPopoverOpen(false);
            }
        });
    };

    const filteredMessages = inputValue.startsWith('/')
        ? cannedMessages
            .filter(msg =>
                msg.type === 'text' && msg.name.toLowerCase().includes(inputValue.substring(1).toLowerCase())
            )
            .sort((a, b) => (b.isFavourite ? 1 : 0) - (a.isFavourite ? 1 : 0))
        : [];

    return (
        <Popover open={cannedPopoverOpen} onOpenChange={setCannedPopoverOpen}>
            <div className="w-full relative flex items-center gap-2">
                <form ref={formRef} action={sendFormAction} className="flex-1 flex items-center gap-2">
                    <input type="hidden" name="contactId" value={contact._id.toString()} />
                    <input type="hidden" name="projectId" value={contact.projectId.toString()} />
                    <input type="hidden" name="phoneNumberId" value={contact.phoneNumberId} />
                    <input type="hidden" name="waId" value={contact.waId} />

                    <PopoverAnchor asChild>
                        <Input
                            ref={mainInputRef}
                            name="messageText"
                            placeholder="Type a message or / for canned replies"
                            autoComplete="off"
                            className="flex-1"
                            value={inputValue}
                            onChange={handleInputChange}
                        />
                    </PopoverAnchor>
                    
                     <Popover open={flowPopoverOpen} onOpenChange={setFlowPopoverOpen}>
                        <PopoverTrigger asChild>
                             <Button type="button" variant="ghost" size="icon">
                                <ServerCog className="h-4 w-4" />
                                <span className="sr-only">Send a Flow</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-1 w-56" align="end">
                            <ScrollArea className="max-h-60">
                                <div className="p-1 space-y-1">
                                    <p className="text-xs font-semibold p-2">Send an Interactive Flow</p>
                                    {metaFlows.length > 0 ? metaFlows.map(flow => (
                                        <button
                                            key={flow._id.toString()}
                                            type="button"
                                            className="w-full text-left p-2 rounded-sm hover:bg-accent flex items-center text-sm"
                                            onClick={() => handleSendFlow(flow._id.toString())}
                                            disabled={isSendingFlow}
                                        >
                                            {isSendingFlow ? <LoaderCircle className="h-4 w-4 mr-2 animate-spin"/> : <Send className="h-4 w-4 mr-2"/>}
                                            {flow.name}
                                        </button>
                                    )) : <p className="text-xs text-center p-2 text-muted-foreground">No Meta Flows found.</p>}
                                </div>
                            </ScrollArea>
                        </PopoverContent>
                    </Popover>

                    <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}>
                        <Paperclip className="h-4 w-4" />
                        <span className="sr-only">Attach File</span>
                    </Button>
                    <input
                        type="file"
                        name="mediaFile"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileChange}
                        accept="image/*,video/*,application/pdf"
                    />
                    
                    <SubmitButton />
                </form>
            </div>
            <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
                align="end" side="top"
            >
                <ScrollArea className="max-h-60">
                    <div className="p-1">
                        {filteredMessages.length > 0 ? (
                            filteredMessages.map(msg => (
                                <button
                                    key={msg._id.toString()}
                                    type="button"
                                    className="w-full text-left p-2 rounded-sm hover:bg-accent flex flex-col"
                                    onClick={() => handleSelectCanned(msg)}
                                >
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold">{msg.name}</p>
                                        {msg.isFavourite && <Star className="h-4 w-4 text-amber-400 fill-amber-400" />}
                                    </div>
                                    <p className="text-muted-foreground truncate text-xs">{msg.content.text}</p>
                                </button>
                            ))
                        ) : (
                            <p className="p-4 text-center text-sm text-muted-foreground">
                                {inputValue.length > 1 ? "No matches found." : "Start typing to search..."}
                            </p>
                        )}
                    </div>
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
