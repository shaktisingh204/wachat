
'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { handleSendMessage } from '@/app/actions';
import type { WithId } from 'mongodb';
import type { Contact } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
    const { toast } = useToast();

    useEffect(() => {
        if (state.error) {
            toast({ title: 'Error sending message', description: state.error, variant: 'destructive' });
        }
        if (state.message) {
            formRef.current?.reset();
        }
    }, [state, toast]);

    const handleFileChange = () => {
        // Automatically submit the form when a file is selected
        setTimeout(() => {
            formRef.current?.requestSubmit();
        }, 100);
    };

    return (
        <form ref={formRef} action={formAction} className="flex items-center gap-2">
            <input type="hidden" name="contactId" value={contact._id.toString()} />
            <input type="hidden" name="projectId" value={contact.projectId.toString()} />
            <input type="hidden" name="phoneNumberId" value={contact.phoneNumberId} />
            <input type="hidden" name="waId" value={contact.waId} />

            <Input
                name="messageText"
                placeholder="Type a message..."
                autoComplete="off"
            />

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
    );
}
