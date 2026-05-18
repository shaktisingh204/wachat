'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    ZoruDialog,
    ZoruDialogContent,
    ZoruDialogDescription,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
} from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { LoaderCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Contact } from '@/lib/definitions';
import { ZoruTextarea } from '../ui/textarea';
import { handlePaymentRequest } from '@/app/actions/integrations.actions';

const initialState = { message: undefined, error: undefined };

interface RequestPaymentDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    contact: WithId<Contact>;
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Create & Send Link
        </ZoruButton>
    );
}

export function RequestPaymentDialog({ isOpen, onOpenChange, contact }: RequestPaymentDialogProps) {
    const [state, formAction] = useActionState(handlePaymentRequest, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            onOpenChange(false);
            formRef.current?.reset();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onOpenChange]);

    return (
        <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
                <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
                    <input type="hidden" name="contactId" value={contact._id.toString()} />
                    <ZoruDialogHeader className="px-6 pt-6 pb-2">
                        <ZoruDialogTitle>Request Razorpay Payment</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Create a payment link and send it to {contact.name}. This will use the configured Razorpay account.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-2">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="amount">Amount (INR)</ZoruLabel>
                                <ZoruInput id="amount" name="amount" type="number" step="0.01" required />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="description">Description</ZoruLabel>
                                <ZoruTextarea id="description" name="description" placeholder="e.g., June Invoice, T-Shirt Order" required />
                            </div>
                        </div>
                    </div>
                    <ZoruDialogFooter className="px-6 pb-6 pt-2">
                        <ZoruButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
                        <SubmitButton />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}
