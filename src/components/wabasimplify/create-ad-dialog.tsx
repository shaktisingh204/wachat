
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle } from 'lucide-react';
import { handleCreateWhatsAppAd } from '@/app/actions/facebook.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Project } from '@/lib/definitions';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Creating...
        </>
      ) : (
        'Create Ad'
      )}
    </Button>
  );
}

interface CreateAdDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: WithId<Project>;
  onAdCreated: () => void;
}

export function CreateAdDialog({ isOpen, onOpenChange, project, onAdCreated }: CreateAdDialogProps) {
  const [state, formAction] = useActionState(handleCreateWhatsAppAd, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      onOpenChange(false);
      onAdCreated();
    }
    if (state.error) {
      toast({ title: 'Error Creating Ad', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onOpenChange, onAdCreated]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction} ref={formRef}>
          <input type="hidden" name="projectId" value={project._id.toString()} />
          <DialogHeader>
            <DialogTitle>Create New Ad Campaign</DialogTitle>
            <DialogDescription>
              Fill out the details below to launch a new ad campaign.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="campaignName">Campaign Name</Label>
              <Input id="campaignName" name="campaignName" placeholder="e.g., Summer Sale Promotion" required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="dailyBudget">Daily Budget (in Ad Account Currency)</Label>
                <Input id="dailyBudget" name="dailyBudget" type="number" placeholder="10.00" required step="0.01" />
            </div>
             <div className="space-y-2">
                <Label htmlFor="adText">Ad Primary Text</Label>
                <Textarea id="adText" name="adText" placeholder="Check out our amazing new product!" required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="adHeadline">Ad Headline</Label>
                <Input id="adHeadline" name="adHeadline" placeholder="Summer Sale - 50% Off!" required />
            </div>
             <div className="space-y-2">
                <Label htmlFor="adImageUrl">Image/Video URL</Label>
                <Input id="adImageUrl" name="adImageUrl" type="url" placeholder="https://example.com/ad-image.jpg" required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
