
'use client';

import { useEffect, useState, useTransition } from 'react';
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

interface AdminDeleteProjectButtonProps {
  projectId: string;
  projectName: string;
}

export function AdminDeleteProjectButton({ projectId, projectName }: AdminDeleteProjectButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append('projectId', projectId);
      const result = await handleDeleteProjectByAdmin(null, formData);
      if (result.message) {
        toast({ title: 'Success!', description: result.message });
        setOpen(false);
      }
      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' });
        setOpen(false);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to delete this project?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the project "{projectName}" and all of its associated data, including templates, campaigns, contacts, and messages.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Yes, Delete Project
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
