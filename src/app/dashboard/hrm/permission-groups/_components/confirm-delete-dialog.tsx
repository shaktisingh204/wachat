import * as React from 'react';
import { LoaderCircle } from 'lucide-react';
import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
} from '@/components/zoruui';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isDeleting,
}: ConfirmDeleteDialogProps) {
  return (
    <ZoruAlertDialog open={open} onOpenChange={onOpenChange}>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle>{title}</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription>{description}</ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel disabled={isDeleting}>Cancel</ZoruAlertDialogCancel>
          <ZoruAlertDialogAction onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Delete
          </ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
  );
}
