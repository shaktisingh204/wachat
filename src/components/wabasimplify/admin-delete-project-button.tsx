
'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
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
import { handleDeleteProjectByAdmin } from '@/app/actions/admin.actions';
import { useToast } from '@/hooks/use-toast';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <AlertDialogAction asChild>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? (
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 h-4 w-4" />
        )}
        Yes, Delete Project
      </Button>
    </AlertDialogAction>
  );
}

interface AdminDeleteProjectButtonProps {
  projectId: string;
  projectName: string;
}

export function AdminDeleteProjectButton({ projectId, projectName }: AdminDeleteProjectButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleDeleteProjectByAdmin, initialState);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success!', description: state.message });
      setOpen(false);
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
      setOpen(false);
    }
  }, [state, toast]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the project "{projectName}" and all of its associated data, including templates, campaigns, contacts, and messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <SubmitButton />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
