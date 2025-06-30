
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { getCannedMessages, handleSendMessage, type CannedMessage } from '@/app/actions';
import type { WithId } from 'mongodb';
import type { Contact } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, LoaderCircle, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatMessageInputProps {
    contact: WithId<Contact>;
}

const initialState = {
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

export function ChatMessageInput({ contact }: ChatMessageInputProps) {
    const [state, formAction] = useActionState(handleSendMessage, initialState);
    const formRef = useRef<HTMLFormElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mainInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const [inputValue, setInputValue] = useState('');
    const [cannedMessages, setCannedMessages] = useState<WithId<CannedMessage>[]>([]);
    const [popoverOpen, setPopoverOpen] = useState(false);

    useEffect(() => {
        getCannedMessages(contact.projectId.toString()).then(setCannedMessages);
    }, [contact.projectId]);

    useEffect(() => {
        if (state.error) {
            toast({ title: 'Error sending message', description: state.error, variant: 'destructive' });
        }
        if (state.message) {
            formRef.current?.reset();
            setInputValue('');
        }
    }, [state, toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);
        setPopoverOpen(val.startsWith('/'));
    };

    const handleSelectCanned = (message: WithId<CannedMessage>) => {
        if (message.type === 'text' && message.content.text) {
            setInputValue(message.content.text);
            setPopoverOpen(false);
            mainInputRef.current?.focus();
        } else {
             toast({
                title: 'Unsupported',
                description: 'This feature currently only supports text-based canned replies.',
            });
        }
    };

    const handleFileChange = () => {
        // Automatically submit the form when a file is selected
        setTimeout(() => {
            formRef.current?.requestSubmit();
        }, 100);
    };

    const filteredMessages = inputValue.startsWith('/')
        ? cannedMessages
            .filter(msg =>
                msg.type === 'text' && msg.name.toLowerCase().includes(inputValue.substring(1).toLowerCase())
            )
            .sort((a, b) => (b.isFavourite ? 1 : 0) - (a.isFavourite ? 1 : 0))
        : [];

    return (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <div className="w-full relative">
                <form ref={formRef} action={formAction} className="flex items-center gap-2 w-full">
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
