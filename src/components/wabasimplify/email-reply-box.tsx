
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { sendReplyEmail } from '@/app/actions/email.actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle, Send, Paperclip, Code } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, EmailConversation } from '@/lib/definitions';

const initialState = { success: false, message: null, error: null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send
        </Button>
    );
}

export function EmailReplyBox({ conversation }: { conversation: WithId<EmailConversation> }) {
    const [state, formAction] = useActionState(sendReplyEmail, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [body, setBody] = useState('');

    useEffect(() => {
        if (state.success) {
            toast({ title: "Success!", description: "Reply sent." });
            formRef.current?.reset();
            setBody('');
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    const originalMessage = conversation.messages[conversation.messages.length - 1];
    const quotedBody = `\n\n\n--- On ${new Date(originalMessage.date).toLocaleString()}, ${originalMessage.from} wrote: ---\n>${originalMessage.bodyText.replace(/\n/g, '\n>')}`;

    return (
        <form action={formAction} ref={formRef} className="w-full">
            <input type="hidden" name="to" value={conversation.fromEmail} />
            <input type="hidden" name="subject" value={`Re: ${conversation.subject}`} />
            <input type="hidden" name="body" value={body + quotedBody} />

            <div className="border rounded-lg">
                <Textarea 
                    placeholder="Type your reply..." 
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-32"
                    value={body}
                    onChange={e => setBody(e.target.value)}
                />
                <div className="p-2 border-t flex justify-between items-center">
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" disabled><Paperclip className="h-4 w-4"/></Button>
                        <Button variant="ghost" size="icon" disabled><Code className="h-4 w-4"/></Button>
                    </div>
                    <SubmitButton />
                </div>
            </div>
        </form>
    );
}
