
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
} from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { LoaderCircle, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateUserPlanByAdmin } from '@/app/actions/admin.actions';
import type { Plan } from '@/lib/definitions';
import type { WithId } from 'mongodb';


interface AdminAssignUserPlanDialogProps {
  userId: string;
  userName: string;
  currentPlanId?: string;
  allPlans: WithId<Plan>[];
}

export function AdminAssignUserPlanDialog({ userId, userName, currentPlanId, allPlans }: AdminAssignUserPlanDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(currentPlanId || '');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) {
        toast({ title: 'Error', description: 'Please select a plan.', variant: 'destructive'});
        return;
    }
    startTransition(async () => {
        const result = await updateUserPlanByAdmin(userId, selectedPlan);
        if (result.success) {
            toast({ title: 'Plan assigned', description: `${userName} is now on the selected plan.` });
            setOpen(false);
            // Force the admin table to re-fetch so the new plan name shows up immediately
            // instead of waiting for the next navigation event.
            router.refresh();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    });
  };

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="outline" size="sm">
          <Edit className="mr-2 h-4 w-4" />
          Plan
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Assign Plan to {userName}</ZoruDialogTitle>
            <ZoruDialogDescription>
              ZoruSelect a new subscription plan for this user.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="py-6">
            <ZoruLabel htmlFor="plan-select">Subscription Plan</ZoruLabel>
            <ZoruSelect name="planId" value={selectedPlan} onValueChange={setSelectedPlan}>
              <ZoruSelectTrigger id="plan-select">
                <ZoruSelectValue placeholder="ZoruSelect a plan..." />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {allPlans.map((plan) => (
                  <ZoruSelectItem key={plan._id.toString()} value={plan._id.toString()}>
                    {plan.name} ({plan.price} {plan.currency}/month)
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <ZoruDialogFooter>
            <ZoruButton type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</ZoruButton>
             <ZoruButton type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Assign Plan
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
