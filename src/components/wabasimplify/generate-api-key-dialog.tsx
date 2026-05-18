
'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { LoaderCircle, Key, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateApiKey } from '@/app/actions/api-keys.actions';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

const initialState = { success: false, apiKey: undefined, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Generate Key
    </ZoruButton>
  );
}

interface GenerateApiKeyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onKeyGenerated: () => void;
}

export function GenerateApiKeyDialog({ isOpen, onOpenChange, onKeyGenerated }: GenerateApiKeyDialogProps) {
  const [state, formAction, isPending] = useActionState(async (previousState: any, formData: FormData) => {
    const name = formData.get('name') as string;
    if (!name) return { success: false, error: 'Key name is required.', apiKey: undefined };
    const res = await generateApiKey(name);
    if ('error' in res && !('success' in res)) {
      return { success: false, error: (res as any).error, apiKey: undefined };
    }
    return res as { success: boolean; apiKey?: string; error?: string };
  }, initialState);

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
      // Manually reset the action state when the dialog is closed.
      // This is a workaround to ensure the success/API key view doesn't persist.
      initialState.success = false;
      initialState.apiKey = undefined;
      initialState.error = undefined;
    }
    onOpenChange(open);
  }

  if (state.success && state.apiKey) {
    return (
      <ZoruDialog open={isOpen} onOpenChange={handleOpenChange}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>API Key Generated Successfully</ZoruDialogTitle>
            <ZoruDialogDescription>
              Here is your new API key. Please copy and store it somewhere safe. You will not be able to see it again.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <Alert variant="destructive">
            <AlertTitle>Important!</AlertTitle>
            <AlertDescription>
              Treat this API key like a password. Do not share it publicly or commit it to version control.
            </AlertDescription>
          </Alert>
          <div className="flex items-center gap-2">
            <ZoruInput readOnly value={state.apiKey} className="font-mono" />
            <ZoruButton variant="outline" size="icon" onClick={() => copy(state.apiKey!)}>
              <Copy className="h-4 w-4" />
            </ZoruButton>
          </div>
          <ZoruDialogFooter>
            <ZoruButton onClick={() => handleOpenChange(false)}>Close</ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>
    );
  }

  return (
    <ZoruDialog open={isOpen} onOpenChange={handleOpenChange}>
      <ZoruDialogContent className="sm:max-w-md max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle>Create New API Key</ZoruDialogTitle>
            <ZoruDialogDescription>
              Give this key a name to help you identify it later.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <ZoruLabel htmlFor="name">Key Name</ZoruLabel>
                <ZoruInput id="name" name="name" placeholder="e.g., My Awesome App" required />
              </div>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <ZoruButton type="button" variant="ghost" onClick={() => handleOpenChange(false)}>Cancel</ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
