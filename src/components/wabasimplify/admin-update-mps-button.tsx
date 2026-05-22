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
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';

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
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="ghost" size="sm">
          <Edit className="mr-2 h-4 w-4" />
          Concurrency
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Update Project Concurrency</ZoruDialogTitle>
            <ZoruDialogDescription>
              Set a new messages-per-second limit for this project's broadcasts.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="py-6">
            <ZoruLabel htmlFor="mps-input">Messages Per Second</ZoruLabel>
            <ZoruInput
              id="mps-input"
              type="number"
              value={mps}
              onChange={(e) => setMps(Number(e.target.value))}
              required
            />
          </div>
          <ZoruDialogFooter>
            <ZoruButton type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</ZoruButton>
             <ZoruButton type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
