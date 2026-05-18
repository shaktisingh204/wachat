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
  useEffect,
  useState,
  useTransition } from 'react';

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
    <ZoruAlertDialog open={open} onOpenChange={setOpen}>
      <ZoruAlertDialogTrigger asChild>
        <ZoruButton variant="destructive" size="sm">
          Delete
        </ZoruButton>
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>Are you sure you want to delete this project?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>
            This action cannot be undone. This will permanently delete the project "{projectName}" and all of its associated data, including templates, campaigns, contacts, and messages.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter className="mt-4">
          <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
          <ZoruButton variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Yes, Delete Project
          </ZoruButton>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}
