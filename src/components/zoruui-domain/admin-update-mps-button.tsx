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
      <ZoruDialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit className="mr-2 h-4 w-4" />
          Concurrency
        </Button>
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
            <Label htmlFor="mps-input">Messages Per Second</Label>
            <Input
              id="mps-input"
              type="number"
              value={mps}
              onChange={(e) => setMps(Number(e.target.value))}
              required
            />
          </div>
          <ZoruDialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
             <Button type="submit" disabled={isPending}>
              {isPending && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
