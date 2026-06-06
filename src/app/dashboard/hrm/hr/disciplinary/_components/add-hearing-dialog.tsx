"use client";

import React, { useState, useTransition } from 'react';
import { 
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Label,
  Textarea
} from '@/components/sabcrm/20ui/compat';
import { PlusCircle } from 'lucide-react';
import { addDisciplinaryHearing } from '@/app/actions/hr.actions';
import { toast } from 'sonner';

export function AddHearingDialog({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = fd.get('date') as string;
    const summary = fd.get('summary') as string;

    startTransition(async () => {
      try {
        await addDisciplinaryHearing(caseId, { date, summary });
        toast.success('Hearing added');
        setOpen(false);
      } catch (err: any) {
        toast.error(err.message || 'Failed to add hearing');
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <Button variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Hearing
        </Button>
      </ZoruDialogTrigger>
      <ZoruDialogContent>
        <ZoruDialogHeader>
          <ZoruDialogTitle>Add Hearing</ZoruDialogTitle>
        </ZoruDialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input name="date" type="date" required />
          </div>
          <div className="space-y-1.5">
            <Label>Summary</Label>
            <Textarea name="summary" required />
          </div>
          <div className="flex justify-end pt-4">
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
