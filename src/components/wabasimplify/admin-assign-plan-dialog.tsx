
'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Edit className="mr-2 h-4 w-4" />
          Assign Plan
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Assign Plan to {projectName}</DialogTitle>
            <DialogDescription>
              Select a new subscription plan for this project. This will override its current plan.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Label htmlFor="plan-select">Subscription Plan</Label>
            <Select name="planId" value={selectedPlan} onValueChange={setSelectedPlan}>
              <SelectTrigger id="plan-select">
                <SelectValue placeholder="Select a plan..." />
              </SelectTrigger>
              <SelectContent>
                {allPlans.map((plan) => (
                  <SelectItem key={plan._id.toString()} value={plan._id.toString()}>
                    {plan.name} ({plan.price} {plan.currency}/month)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button id={`close-dialog-${projectId}`} type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
             <Button type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Assign Plan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
