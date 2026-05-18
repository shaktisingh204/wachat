'use client';

import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  ZoruButton,
  ZoruInput,
  ZoruLabel,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';

import { LoaderCircle, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateProjectCreditsByAdmin } from '@/app/actions/admin.actions';

interface AdminUpdateCreditsButtonProps {
  projectId: string;
  currentCredits: number;
}

export function AdminUpdateCreditsButton({ projectId, currentCredits }: AdminUpdateCreditsButtonProps) {
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState(currentCredits);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateProjectCreditsByAdmin(projectId, credits);
      if (result.success) {
        toast({ title: 'Success!', description: `Credits updated.` });
        setOpen(false);
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
      }
    });
  };

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="ghost" size="sm">
          <Edit className="mr-2 h-4 w-4" />
          Credits
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Update User Credits</ZoruDialogTitle>
            <ZoruDialogDescription>
              Set a new credit balance for this user.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="py-6">
            <ZoruLabel htmlFor="credits-input">New Credit Balance</ZoruLabel>
            <ZoruInput
              id="credits-input"
              type="number"
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value))}
              required
            />
          </div>
          <ZoruDialogFooter>
            <ZoruButton type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</ZoruButton>
             <ZoruButton type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Save Credits
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
