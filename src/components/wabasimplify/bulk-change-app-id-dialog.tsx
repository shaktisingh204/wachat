

'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleBulkUpdateAppId } from '@/app/actions/project.actions';

const initialState = { success: false, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Update App ID
    </Button>
  );
}

interface BulkChangeAppIdDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectIds: string[];
  onSuccess: () => void;
}

export function BulkChangeAppIdDialog({ isOpen, onOpenChange, projectIds, onSuccess }: BulkChangeAppIdDialogProps) {
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(handleBulkUpdateAppId, initialState);

  useEffect(() => {
    if (state.success) {
      toast({ title: 'Success!', description: `${projectIds.length} project(s) updated successfully.` });
      onSuccess();
      onOpenChange(false);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSuccess, onOpenChange, projectIds.length]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectIds" value={projectIds.join(',')} />
          <DialogHeader>
            <DialogTitle>Bulk Change App ID</DialogTitle>
            <DialogDescription>
              This action will update the App ID for all {projectIds.length} selected projects. Use with caution.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="appId">New Meta App ID</Label>
            <Input id="appId" name="appId" required placeholder="Enter the new App ID" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
