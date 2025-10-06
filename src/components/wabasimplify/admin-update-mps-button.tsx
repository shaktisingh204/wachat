
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
import { updateProjectMpsByAdmin } from '@/app/actions/admin.actions';

interface AdminUpdateMpsButtonProps {
  projectId: string;
  currentMps: number;
}

export function AdminUpdateMpsButton({ projectId, currentMps }: AdminUpdateMpsButtonProps) {
  const [open, setOpen] = useState(false);
  const [mps, setMps] = useState(currentMps);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
        const result = await updateProjectMpsByAdmin(projectId, mps);
        if (result.success) {
            toast({ title: 'Success!', description: `Concurrency updated.` });
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
          Concurrency
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Update Project Concurrency</DialogTitle>
            <DialogDescription>
              Set a new messages-per-second limit for this project's broadcasts.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Label htmlFor="mps-input">Messages Per Second</Label>
            <Input
              id="mps-input"
              type="number"
              value={mps}
              onChange={(e) => setMps(Number(e.target.value))}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
             <Button type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
