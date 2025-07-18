
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
import { deleteLibraryTemplate } from '@/app/actions/template.actions';
import { useToast } from '@/hooks/use-toast';

const initialState = { message: null, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <AlertDialogAction asChild>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
        Yes, Delete
      </Button>
    </AlertDialogAction>
  );
}

interface AdminDeleteLibraryTemplateButtonProps {
  templateId: string;
  templateName: string;
}

export function AdminDeleteLibraryTemplateButton({ templateId, templateName }: AdminDeleteLibraryTemplateButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(deleteLibraryTemplate, initialState);
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
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction}>
          <input type="hidden" name="templateId" value={templateId} />
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the template "{templateName}" from the public library. This action cannot be undone.
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
