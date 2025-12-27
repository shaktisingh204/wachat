

'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import type { Plan } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Button } from '@/components/ui/button';
import { LoaderCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';


interface PlanPurchaseButtonProps {
    plan: WithId<Plan>;
    currentPlanId?: string;
    projectId?: string | null;
}

export function PlanPurchaseButton({ plan, currentPlanId, projectId }: PlanPurchaseButtonProps) {
    const { toast } = useToast();

    if (currentPlanId === plan._id.toString()) {
        return <Button className="w-full" disabled><CheckCircle className="mr-2 h-4 w-4" /> Current Plan</Button>;
    }

    const handleClick = () => {
        toast({
            title: "Temporarily Disabled",
            description: "Plan upgrades are currently unavailable.",
            variant: "default",
        })
    }

    return (
        <Button onClick={handleClick} className="w-full">
            Upgrade to {plan.name}
        </Button>
    );
}