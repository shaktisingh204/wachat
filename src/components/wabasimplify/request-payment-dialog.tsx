
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId, Contact } from '@/lib/definitions';
import { Textarea } from '../ui/textarea';
import { handlePaymentRequest } from '@/app/actions/integrations.actions';

const initialState = { message: null, error: undefined };

interface RequestPaymentDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    contact: WithId<Contact>;
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
        Create & Send Link
      </Button>
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
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form action={formAction} ref={formRef}>
                    <input type="hidden" name="contactId" value={contact._id.toString()} />
                    <DialogHeader>
                        <DialogTitle>Request Razorpay Payment</DialogTitle>
                        <DialogDescription>
                            Create a payment link and send it to {contact.name}. This will use the configured Razorpay account.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount (INR)</Label>
                            <Input id="amount" name="amount" type="number" step="0.01" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" name="description" placeholder="e.g., June Invoice, T-Shirt Order" required />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
