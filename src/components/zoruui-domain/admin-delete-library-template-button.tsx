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
  useEffect,
  useState,
  useTransition } from 'react';

import { LoaderCircle, Trash2 } from 'lucide-react';
import { deleteLibraryTemplate } from '@/app/actions/template.actions';
import { useToast } from '@/hooks/use-toast';

interface AdminDeleteLibraryTemplateButtonProps {
  templateId: string;
  templateName: string;
}

export function AdminDeleteLibraryTemplateButton({ templateId, templateName }: AdminDeleteLibraryTemplateButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteLibraryTemplate(templateId);
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
        <Button variant="ghost" size="icon">
          <Trash2 className="h-4 w-4 text-zoru-ink" />
        </Button>
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Are you sure?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This will permanently delete the template "{templateName}" from the public library. This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter className="mt-4">
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Yes, Delete
            </Button>
          </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}
