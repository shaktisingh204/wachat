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
} from '@/components/zoruui';
import {
  useActionState,
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';

import { Trash2, LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <ZoruAlertDialogAction asChild>
      <ZoruButton type="submit" variant="destructive" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            Cleaning...
          </>
        ) : (
          <>
            <Trash2 className="mr-2 h-4 w-4" />
            Yes, clean the database
          </>
        )}
      </ZoruButton>
    </ZoruAlertDialogAction>
  );
}

// Dummy action for placeholder since the real action is deleted
const handleCleanDatabase = async () => ({ message: "Database cleaning is currently disabled for safety.", error: null });

export function CleanDatabaseButton() {
  const [state, formAction] = useActionState(handleCleanDatabase as any, initialState as any);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.message) {
      toast({
        title: 'Success!',
        description: state.message,
      });
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast]);
  
  return (
    <ZoruAlertDialog>
      <ZoruAlertDialogTrigger asChild>
        <ZoruButton variant="destructive">
            <Trash2 className="mr-2 h-4 w-4" />
            Clean Database
        </ZoruButton>
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <form action={formAction}>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Are you absolutely sure?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This action cannot be undone. This will permanently delete all projects, templates, broadcasts, notifications, and other data from the database.
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
