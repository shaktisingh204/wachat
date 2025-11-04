
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { handleInitiateCreditPurchase } from '@/app/actions/index.ts';
import { Button } from '@/components/ui/button';
import { LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const initialState = {
  redirectUrl: undefined,
  error: undefined,
};

function SubmitButton({ children }: { children: React.ReactNode }) {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending} className="w-full">
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            {children}
        </Button>
    )
}

interface CreditPurchaseButtonProps {
    credits: number;
    amount: number;
}

export function CreditPurchaseButton({ credits, amount }: CreditPurchaseButtonProps) {
    const [state, formAction] = useActionState(handleInitiateCreditPurchase, initialState);
    const { toast } = useToast();

    useEffect(() => {
        if (state.error) {
            toast({ title: 'Payment Error', description: state.error, variant: 'destructive' });
        }
        if (state.redirectUrl) {
            window.location.href = state.redirectUrl;
        }
    }, [state, toast]);

    return (
        <form action={() => formAction({ credits, amount })} className="w-full">
            <SubmitButton>Buy Now</SubmitButton>
        </form>
    );
}
