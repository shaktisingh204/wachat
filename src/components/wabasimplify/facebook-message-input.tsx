
'use client';

import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { sendFacebookMessage } from '@/app/actions/facebook.actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FacebookMessageInputProps {
    projectId: string;
    recipientId: string;
    onMessageSent: () => void;
    disabled?: boolean;
}

const sendInitialState = { success: false, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" size="icon" disabled={pending}>
            {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="sr-only">Send Message</span>
        </Button>
    );
}

export function FacebookMessageInput({ projectId, recipientId, onMessageSent, disabled }: FacebookMessageInputProps) {
    const [sendState, sendFormAction] = useActionState(sendFacebookMessage, sendInitialState);
    const formRef = useRef<HTMLFormElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (sendState.error) {
            toast({ title: 'Error sending message', description: sendState.error, variant: 'destructive' });
        }
        if (sendState.success) {
            formRef.current?.reset();
            onMessageSent();
        }
    }, [sendState, toast, onMessageSent]);

    return (
        <form ref={formRef} action={sendFormAction} className="flex-1 flex items-center gap-2">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="recipientId" value={recipientId} />
            <Input
                name="messageText"
                placeholder={disabled ? "You can no longer reply to this conversation." : "Type a message..."}
                autoComplete="off"
                className="flex-1"
                disabled={disabled}
            />
            <SubmitButton />
        </form>
    );
}
