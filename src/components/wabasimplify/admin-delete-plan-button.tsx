
'use client';

import { useEffect, useState, useTransition } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { LoaderCircle, Trash2 } from 'lucide-react';
import { deletePlan } from '@/app/actions/plan.actions';
import { useToast } from '@/hooks/use-toast';

interface AdminDeletePlanButtonProps {
  planId: string;
  planName: string;
}

export function AdminDeletePlanButton({ planId, planName }: AdminDeletePlanButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    startTransition(async () => {
        const formData = new FormData();
        formData.append('planId', planId);
        const result = await deletePlan(null, formData);
        if (result.message) {
          toast({ title: 'Success!', description: result.message });
          setOpen(false);
        }
        if (result.error) {
          toast({ title: 'Error', description: result.error, variant: 'destructive' });
          setOpen(false);
        }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the plan "{planName}". This could affect users currently subscribed to this plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Yes, Delete Plan
            </Button>
          </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
