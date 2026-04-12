'use client';

import { useTransition } from 'react';
import type { Plan } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { Button } from '@/components/ui/button';
import { LoaderCircle, CheckCircle, ArrowUpRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createPayuPlanUpgrade } from '@/app/actions/payu.actions';
import { handlePlanChange } from '@/app/actions/billing.actions';

interface PlanPurchaseButtonProps {
    plan: WithId<Plan>;
    currentPlanId?: string;
    projectId?: string | null;
}

/**
 * Submits a PayU checkout payload as a hidden HTML form.
 */
function submitPayuForm(action: string, params: Record<string, string | undefined>) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    form.style.display = 'none';
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null) continue;
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
    }
    document.body.appendChild(form);
    form.submit();
}

export function PlanPurchaseButton({ plan, currentPlanId, projectId }: PlanPurchaseButtonProps) {
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    if (currentPlanId === plan._id.toString()) {
        return (
            <Button className="w-full" disabled>
                <CheckCircle className="mr-2 h-4 w-4" /> Current Plan
            </Button>
        );
    }

    const isFree = !plan.price || plan.price <= 0;

    const handleClick = () => {
        startTransition(async () => {
            if (isFree) {
                // Free plan — just assign it directly
                const res = await handlePlanChange(plan._id.toString());
                if (res.success) {
                    toast({
                        title: 'Plan activated',
                        description: `You're now on the ${plan.name} plan.`,
                    });
                    // Reload to reflect new plan
                    window.location.reload();
                } else {
                    toast({
                        title: 'Error',
                        description: 'Could not switch plan. Try again.',
                        variant: 'destructive',
                    });
                }
                return;
            }

            // Paid plan — create PayU checkout
            const res = await createPayuPlanUpgrade(plan._id.toString());
            if (!res.success || !res.payload) {
                toast({
                    title: 'Payment error',
                    description: res.error || 'Could not start checkout. Try again.',
                    variant: 'destructive',
                });
                return;
            }

            // Auto-submit hidden form to PayU's hosted payment page
            const { action, params } = res.payload;
            submitPayuForm(
                action,
                params as unknown as Record<string, string | undefined>,
            );
        });
    };

    return (
        <Button onClick={handleClick} className="w-full" disabled={isPending}>
            {isPending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <ArrowUpRight className="mr-2 h-4 w-4" />
            )}
            {isFree ? `Switch to ${plan.name}` : `Upgrade to ${plan.name}`}
        </Button>
    );
}
