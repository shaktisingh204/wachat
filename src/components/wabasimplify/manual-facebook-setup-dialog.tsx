
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
  ZoruDialogTrigger,
} from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { LoaderCircle, Wrench } from 'lucide-react';
import { handleManualFacebookPageSetup } from '@/app/actions/facebook.actions';
import { useToast } from '@/hooks/use-toast';

const initialState = { success: false, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      Connect Page
    </ZoruButton>
  );
}

interface ManualFacebookSetupDialogProps {
  onSuccess: () => void;
}

export function ManualFacebookSetupDialog({ onSuccess }: ManualFacebookSetupDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(handleManualFacebookPageSetup, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.success) {
      toast({ title: 'Success!', description: 'Facebook Page connected successfully.' });
      onOpenChange(false);
      onSuccess();
    }
    if (state.error) {
      toast({ title: 'Connection Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSuccess]);

  const onOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      formRef.current?.reset();
    }
    setOpen(isOpen);
  }

  return (
    <ZoruDialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="outline">
          <Wrench className="mr-2 h-4 w-4" />
          Manual Setup
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle>Manual Facebook Connection</ZoruDialogTitle>
            <ZoruDialogDescription>
              Enter the required IDs and tokens from your Meta Developer account. This is for advanced users.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <ZoruLabel htmlFor="projectName">Project Name</ZoruLabel>
                <ZoruInput id="projectName" name="projectName" placeholder="e.g., My Facebook Page" required />
                <p className="text-xs text-muted-foreground">A name for you to identify this connection.</p>
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="facebookPageId">Facebook Page ID</ZoruLabel>
                <ZoruInput id="facebookPageId" name="facebookPageId" placeholder="Your Facebook Page ID" required />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="adAccountId">Ad Account ID</ZoruLabel>
                <ZoruInput id="adAccountId" name="adAccountId" placeholder="act_xxxxxxxxxxxx" required />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="accessToken">Permanent Access Token</ZoruLabel>
                <ZoruInput id="accessToken" name="accessToken" type="password" placeholder="A non-expiring System User Token" required />
              </div>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <ZoruButton type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
