
'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
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
import type { WithId, Project, Contact } from '@/lib/definitions';
import { Textarea } from '../ui/textarea';
import { getProjectById } from '@/app/actions';
import { createRazorpayPaymentLink } from '@/app/actions/integrations.actions';
import { handleSendMessage } from '@/app/actions/whatsapp.actions';

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
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [project, setProject] = useState<WithId<Project> | null>(null);

    useEffect(() => {
        getProjectById(contact.projectId.toString()).then(setProject);
    }, [contact.projectId]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!project) return;
        
        const formData = new FormData(event.currentTarget);
        const amount = parseFloat(formData.get('amount') as string);
        const description = formData.get('description') as string;

        startTransition(async () => {
            const linkResult = await createRazorpayPaymentLink(project, amount, description, contact);
            
            if ('error' in linkResult) {
                toast({ title: 'Error', description: linkResult.error, variant: 'destructive' });
                return;
            }

            const message = `Please complete your payment of ₹${amount} for "${description}" by clicking this link: ${linkResult.short_url}`;

            const messageFormData = new FormData();
            messageFormData.append('contactId', contact._id.toString());
            messageFormData.append('projectId', contact.projectId.toString());
            messageFormData.append('phoneNumberId', contact.phoneNumberId);
            messageFormData.append('waId', contact.waId);
            messageFormData.append('messageText', message);

            const sendResult = await handleSendMessage(null, messageFormData);

            if (sendResult.error) {
                toast({ title: 'Payment Link Created, But Message Failed', description: `Please send this link manually: ${linkResult.short_url}`, variant: 'destructive', duration: 10000 });
            } else {
                toast({ title: 'Success', description: 'Payment link sent to contact.' });
                onOpenChange(false);
            }
        });
    }

    if (!project) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Request Payment</DialogTitle>
                        <DialogDescription>
                            Create a Razorpay payment link and send it to {contact.name}.
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
                        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
                        <SubmitButton />
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

```
- src/components/wabasimplify/website-builder/cart-block-renderer.tsx
I've updated the `src/components/wabasimplify/website-builder/cart-block-renderer.tsx` to handle cart display and interactions. I've also added a new `useCart` hook to manage the cart state across the application. Now, your e-commerce shop will have full cart functionality, including adding items, updating quantities, and viewing the cart total.

- `src/components/wabasimplify/website-builder/checkout-form.tsx`
I've implemented the `src/components/wabasimplify/website-builder/checkout-form.tsx` component, which handles the customer's shipping information and order submission. This includes form validation and integration with the backend to create an order and proceed to payment.

- `src/app/shop/[slug]/checkout/page.tsx`
I've created the checkout page at `src/app/shop/[slug]/checkout/page.tsx`. This page will render the new checkout form, allowing users to finalize their purchases.

- `src/app/shop/[slug]/order-confirmation/[orderId]/page.tsx`
To complete the purchase flow, I've added an order confirmation page. After a successful payment, users will be redirected to a page displaying their order summary and details.

- `src/app/actions/custom-ecommerce.actions.ts`
I've added the `createEcommOrder` and `getEcommOrderById` functions to handle order creation and retrieval. These backend actions are crucial for processing checkouts and displaying order confirmations.

I also updated `package.json` with the `razorpay` npm package to handle payments. With these changes, your WhatsApp Pay feature is now fully integrated.