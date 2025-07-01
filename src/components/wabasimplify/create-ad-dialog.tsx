
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
import { handleCreateWhatsAppAd } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import type { WithId } from 'mongodb';
import type { Project } from '@/app/actions';

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
            <DialogTitle>Create New WhatsApp Ad</DialogTitle>
            <DialogDescription>
              Fill out the details below to launch a new "Click to WhatsApp" campaign.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="campaignName">Campaign Name</Label>
              <Input id="campaignName" name="campaignName" placeholder="e.g., Summer Sale Promotion" required />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="dailyBudget">Daily Budget (in Ad Account Currency)</Label>
                    <Input id="dailyBudget" name="dailyBudget" type="number" placeholder="10.00" required step="0.01" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="adPhoneNumber">WhatsApp Number</Label>
                     <Select name="adPhoneNumber" required>
                        <SelectTrigger id="adPhoneNumber">
                            <SelectValue placeholder="Select a number..." />
                        </SelectTrigger>
                        <SelectContent>
                            {project.phoneNumbers.map(phone => (
                                <SelectItem key={phone.id} value={phone.id}>{phone.display_phone_number}</SelectItem>
                            ))}
                        </SelectContent>
                     </Select>
                </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adMessage">Ad Message</Label>
              <Textarea id="adMessage" name="adMessage" placeholder="Hi! I'm interested in your summer sale. Can you tell me more?" required />
              <p className="text-xs text-muted-foreground">This is the pre-filled message when a user clicks your ad.</p>
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
