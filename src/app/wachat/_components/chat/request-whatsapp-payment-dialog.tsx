'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Button,
  Input,
  Label,
  Textarea,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { WithId,
  Contact } from '@/lib/definitions';

import { handleRequestWhatsAppPayment } from '@/app/actions/whatsapp.actions';
import { WaPayIcon } from '@/components/zoruui-domain/custom-sidebar-components';

const initialState = { message: null, error: undefined };

interface RequestWhatsAppPaymentDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    contact: WithId<Contact>;
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
      <Button type="submit" disabled={pending}>
        {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
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
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-md">
                <form action={formAction} ref={formRef}>
                    <input type="hidden" name="contactId" value={contact._id.toString()} />
                    <ZoruDialogHeader>
                        <ZoruDialogTitle className="flex items-center gap-2"><WaPayIcon className="h-5 w-5"/>Request WhatsApp Payment</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            Send a UPI payment request to {contact.name}.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="amount">Amount (INR)</Label>
                            <Input id="amount" name="amount" type="number" step="0.01" required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea id="description" name="description" placeholder="e.g., Payment for Order #1234" required />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="externalReference">External Reference ID (Optional)</Label>
                            <Input id="externalReference" name="externalReference" placeholder="e.g., order_1234" />
                        </div>
                    </div>
                    <ZoruDialogFooter>
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <SubmitButton />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </Dialog>
    );
}
