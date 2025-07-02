
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateProjectCreditsByAdmin } from '@/app/actions';

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
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit className="mr-2 h-4 w-4" />
          Credits
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Update User Credits</DialogTitle>
            <DialogDescription>
              Set a new credit balance for this user.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Save Credits
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
