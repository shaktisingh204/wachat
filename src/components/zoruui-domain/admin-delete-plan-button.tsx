'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  Button,
} from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState,
  useTransition } from 'react';

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
    <ZoruAlertDialog open={open} onOpenChange={setOpen}>
      <ZoruAlertDialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4 text-zoru-ink" />
        </Button>
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Are you sure you want to delete this plan?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This action cannot be undone. This will permanently delete the plan "{planName}". This could affect users currently subscribed to this plan.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter className="mt-4">
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Yes, Delete Plan
            </Button>
          </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}
