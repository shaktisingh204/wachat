'use client';

import {
  Modal,
  Button,
  Field,
  Input,
  Textarea,
} from '@/components/sabcrm/20ui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId,
  Contact } from '@/lib/definitions';

import { handlePaymentRequest } from '@/app/actions/integrations.actions';

function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(' ');
}

const initialState = { message: undefined, error: undefined };

interface RequestPaymentDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    contact: WithId<Contact>;
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" variant="primary" loading={pending} iconLeft={pending ? undefined : Send}>
            Create &amp; Send Link
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
        <Modal
            open={isOpen}
            onClose={() => onOpenChange(false)}
            size="md"
            title="Request Razorpay Payment"
            description={`Create a payment link and send it to ${contact.name}. This will use the configured Razorpay account.`}
        >
            <form action={formAction} ref={formRef} className="flex flex-col gap-4">
                <input type="hidden" name="contactId" value={contact._id.toString()} />
                <Field label="Amount (INR)" required>
                    <Input id="amount" name="amount" type="number" step="0.01" required />
                </Field>
                <Field label="Description" required>
                    <Textarea id="description" name="description" placeholder="e.g., June Invoice, T-Shirt Order" required />
                </Field>
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <SubmitButton />
                </div>
            </form>
        </Modal>
    );
}
