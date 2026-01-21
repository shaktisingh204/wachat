

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
import { Textarea } from '@/components/ui/textarea';
import { LoaderCircle } from 'lucide-react';
import { handleCreateAdCampaign } from '@/app/actions/facebook.actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Project } from '@/lib/definitions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertCircle } from 'lucide-react';

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
  project: WithId<Project> | null;
  onAdCreated: () => void;
}

export function CreateAdDialog({ isOpen, onOpenChange, project, onAdCreated }: CreateAdDialogProps) {
  const [state, formAction] = useActionState(handleCreateAdCampaign, initialState);
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
          <input type="hidden" name="projectId" value={project?._id.toString() || ''} />
          <DialogHeader>
            <DialogTitle>Create New Ad Campaign</DialogTitle>
            <DialogDescription>
              Fill out the details below to launch a new Click-to-WhatsApp ad campaign.
            </DialogDescription>
          </DialogHeader>

          {!project?.wabaId && (
            <div className="py-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>WhatsApp Project Required</AlertTitle>
                <AlertDescription>
                  This feature is for "Click-to-WhatsApp" ads and requires a project connected to a WhatsApp Business Account.
                </AlertDescription>
              </Alert>
            </div>
          )}

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
                <Label htmlFor="adMessage">Ad Primary Text</Label>
                <Textarea id="adMessage" name="adMessage" placeholder="Check out our amazing new product!" required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="phone-number">WhatsApp Number</Label>
                <Select name="phoneNumber" required>
                    <SelectTrigger id="phone-number-select">
                        <SelectValue placeholder="Choose a WhatsApp number..." />
                    </SelectTrigger>
                    <SelectContent>
                        {project?.phoneNumbers && project.phoneNumbers.length > 0 ? (
                            project.phoneNumbers.map(phone => (
                                <SelectItem key={phone.id} value={phone.display_phone_number}>
                                    {phone.display_phone_number}
                                </SelectItem>
                            ))
                        ) : (
                            <div className="p-2 text-center text-sm text-muted-foreground">No WhatsApp numbers found.</div>
                        )}
                    </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground">This number will receive messages from the ad.</p>
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

    