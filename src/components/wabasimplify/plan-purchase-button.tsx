
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { handleInitiatePayment, type Plan } from '@/app/actions';
import type { WithId } from 'mongodb';
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

interface PlanPurchaseButtonProps {
    plan: WithId<Plan>;
    currentPlanId?: string;
}

export function PlanPurchaseButton({ plan, currentPlanId }: PlanPurchaseButtonProps) {
    const [state, formAction] = useActionState(handleInitiatePayment, initialState);
    const { toast } = useToast();

    useEffect(() => {
        if (state.error) {
            toast({ title: 'Payment Error', description: state.error, variant: 'destructive' });
        }
        if (state.redirectUrl) {
            window.location.href = state.redirectUrl;
        }
    }, [state, toast]);

    if (currentPlanId === plan._id.toString()) {
        return <Button className="w-full" disabled>Current Plan</Button>;
    }

    return (
        <form action={() => formAction(plan._id.toString())} className="w-full">
            <SubmitButton>Upgrade to {plan.name}</SubmitButton>
        </form>
    );
}
