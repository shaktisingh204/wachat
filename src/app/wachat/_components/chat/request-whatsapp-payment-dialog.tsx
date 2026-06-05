'use client';

import {
  Modal,
  Button,
  Input,
  Field,
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

import { handleRequestWhatsAppPayment } from '@/app/actions/whatsapp.actions';
import { WaPayIcon } from '@/components/zoruui-domain/custom-sidebar-components';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

const initialState = { message: null, error: undefined };

interface RequestWhatsAppPaymentDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    contact: WithId<Contact>;
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
      <Button type="submit" variant="primary" loading={pending} iconLeft={Send}>
        Send Request
      </Button>
    );
}

export function RequestWhatsAppPaymentDialog({ isOpen, onOpenChange, contact }: RequestWhatsAppPaymentDialogProps) {
    const [state, formAction] = useActionState(handleRequestWhatsAppPayment as any, initialState as any);
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
            title={
                <span className="flex items-center gap-2">
                    <WaPayIcon className="h-5 w-5" />
                    Request WhatsApp Payment
                </span>
            }
            description={`Send a UPI payment request to ${contact.name}.`}
        >
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="contactId" value={contact._id.toString()} />
                <div className="grid gap-4 py-1">
                    <Field label="Amount (INR)" required>
                        <Input id="amount" name="amount" type="number" step="0.01" required />
                    </Field>
                    <Field label="Description" required>
                        <Textarea id="description" name="description" placeholder="e.g., Payment for Order #1234" required />
                    </Field>
                    <Field label="External Reference ID (Optional)">
                        <Input id="externalReference" name="externalReference" placeholder="e.g., order_1234" />
                    </Field>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <SubmitButton />
                </div>
            </form>
        </Modal>
    );
}
