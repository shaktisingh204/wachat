

'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { handleInitiatePayment } from '@/app/actions/index.ts';
import type { Plan } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Button } from '@/components/ui/button';
import { LoaderCircle, CheckCircle } from 'lucide-react';
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
    projectId?: string | null;
}

export function PlanPurchaseButton({ plan, currentPlanId, projectId }: PlanPurchaseButtonProps) {
    const [state, formAction] = useActionState((prevState: any, formData: FormData) => handleInitiatePayment(plan._id.toString(), projectId || ''), initialState);
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
        return <Button className="w-full" disabled><CheckCircle className="mr-2 h-4 w-4" /> Current Plan</Button>;
    }

    return (
        <form action={formAction} className="w-full">
            <SubmitButton>Upgrade to {plan.name}</SubmitButton>
        </form>
    );
}
