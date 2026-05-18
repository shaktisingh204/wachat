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
  ZoruButton,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Trash2 } from 'lucide-react';
import { handleDeleteUserProject } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

const initialState = {
  message: undefined as string | undefined,
  error: undefined as string | undefined,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruAlertDialogAction asChild>
      <ZoruButton type="submit" variant="destructive" disabled={pending}>
        {pending ? (
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 h-4 w-4" />
        )}
        Yes, Delete Project
      </ZoruButton>
    </ZoruAlertDialogAction>
  );
}

interface DeleteProjectButtonProps {
  projectId: string;
  projectName: string;
}

export function DeleteProjectButton({ projectId, projectName }: DeleteProjectButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleDeleteUserProject, initialState);
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
    <ZoruAlertDialog open={open} onOpenChange={setOpen}>
      <ZoruAlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
        <ZoruButton variant="ghost" size="icon" className="h-7 w-7">
          <Trash2 className="h-4 w-4 text-destructive" />
        </ZoruButton>
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <form action={formAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Are you absolutely sure?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This action cannot be undone. This will permanently delete the project "{projectName}" and all of its associated data, including campaigns, contacts, and flows.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter className="mt-4">
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <SubmitButton />
          </ZoruAlertDialogFooter>
        </form>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}
