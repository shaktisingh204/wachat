'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Button,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Label,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';

import { LoaderCircle, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateProjectPlanByAdmin } from '@/app/actions/admin.actions';
import type { Plan } from '@/lib/definitions';
import type { WithId } from 'mongodb';

interface AdminAssignPlanDialogProps {
  projectId: string;
  projectName: string;
  currentPlanId?: string;
  allPlans: WithId<Plan>[];
}

export function AdminAssignPlanDialog({ projectId, projectName, currentPlanId, allPlans }: AdminAssignPlanDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(currentPlanId || '');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
        const result = await updateProjectPlanByAdmin(projectId, selectedPlan);
        if (result.success) {
        toast({ title: 'Success!', description: `Plan successfully assigned to ${projectName}.` });
        setOpen(false);
        } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="mr-2 h-4 w-4" />
          Assign Plan
        </Button>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Assign Plan to {projectName}</ZoruDialogTitle>
            <ZoruDialogDescription>
              Select a new subscription plan for this project. This will override its current plan.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="py-6">
            <Label htmlFor="plan-select">Subscription Plan</Label>
            <Select name="planId" value={selectedPlan} onValueChange={setSelectedPlan}>
              <ZoruSelectTrigger id="plan-select">
                <ZoruSelectValue placeholder="Select a plan..." />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {allPlans.map((plan) => (
                  <ZoruSelectItem key={plan._id.toString()} value={plan._id.toString()}>
                    {plan.name} ({plan.price} {plan.currency}/month)
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
          <ZoruDialogFooter>
            <Button id={`close-dialog-${projectId}`} type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
             <Button type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Assign Plan
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
