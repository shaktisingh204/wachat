'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/zoruui';
import { LoaderCircle, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { duplicatePlan } from '@/app/actions/admin-hardening.actions';

export function AdminDuplicatePlanButton({
    planId,
    planName,
}: {
    planId: string;
    planName: string;
}) {
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const router = useRouter();

    const handleClick = () => {
        startTransition(async () => {
            const result = await duplicatePlan(planId);
            if (result.success && result.planId) {
                toast({
                    title: 'Plan duplicated',
                    description: `Created a copy of "${planName}".`,
                });
                router.push(`/admin/dashboard/plans/${result.planId}`);
            } else {
                toast({
                    title: 'Error',
                    description: result.error ?? 'Could not duplicate the plan.',
                    variant: 'destructive',
                });
            }
        });
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={handleClick}
            disabled={isPending}
            aria-label={`Duplicate ${planName}`}
            className="text-zoru-ink hover:text-zoru-ink hover:bg-zoru-surface-2"
        >
            {isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Copy className="h-4 w-4" />
            )}
        </Button>
    );
}
