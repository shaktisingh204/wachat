
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
import { LoaderCircle, Key, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateApiKey } from '@/app/actions/api-keys.actions';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const initialState = { success: false, apiKey: undefined, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Generate Key
    </Button>
  );
}

interface GenerateApiKeyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onKeyGenerated: () => void;
}

export function GenerateApiKeyDialog({ isOpen, onOpenChange, onKeyGenerated }: GenerateApiKeyDialogProps) {
  const [state, formAction] = useActionState(generateApiKey, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const { copy } = useCopyToClipboard();

  useEffect(() => {
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
    if (state.success && state.apiKey) {
      toast({ title: 'API Key Generated!', description: 'Your new key has been created. Make sure to copy it now.' });
      onKeyGenerated();
    }
  }, [state, toast, onKeyGenerated]);
  
  const handleOpenChange = (open: boolean) => {
      if (!open) {
          formRef.current?.reset();
          // Reset the state manually if the action was successful
          if(state.success) {
            state.success = false;
            state.apiKey = undefined;
          }
      }
      onOpenChange(open);
  }

  if (state.success && state.apiKey) {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>API Key Generated Successfully</DialogTitle>
                <DialogDescription>
                    Here is your new API key. Please copy and store it somewhere safe. You will not be able to see it again.
                </DialogDescription>
            </DialogHeader>
             <Alert variant="destructive">
                <AlertTitle>Important!</AlertTitle>
                <AlertDescription>
                    Treat this API key like a password. Do not share it publicly or commit it to version control.
                </AlertDescription>
            </Alert>
            <div className="flex items-center gap-2">
                <Input readOnly value={state.apiKey} className="font-mono"/>
                <Button variant="outline" size="icon" onClick={() => copy(state.apiKey!)}>
                    <Copy className="h-4 w-4" />
                </Button>
            </div>
             <DialogFooter>
                <Button onClick={() => handleOpenChange(false)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} ref={formRef}>
          <DialogHeader>
            <DialogTitle>Create New API Key</DialogTitle>
            <DialogDescription>
              Give this key a name to help you identify it later.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="name">Key Name</Label>
            <Input id="name" name="name" placeholder="e.g., My Awesome App" required />
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
