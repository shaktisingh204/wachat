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
  Input,
  Label,
} from '@/components/sabcrm/20ui/compat';
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
    <Dialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit className="mr-2 h-4 w-4" />
          Credits
        </Button>
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
            <Label htmlFor="credits-input">New Credit Balance</Label>
            <Input
              id="credits-input"
              type="number"
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value))}
              required
            />
          </div>
          <ZoruDialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
             <Button type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Save Credits
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
