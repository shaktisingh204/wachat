
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
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
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { handleSyncWabas } from '@/app/actions/index.ts';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const initialState = {
  message: null,
  error: null,
};

function SubmitButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <ZoruButton type="submit" disabled={isPending}>
      {isPending ? (
        <>
          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          Syncing...
        </>
      ) : (
        'Sync Projects'
      )}
    </ZoruButton>
  );
}

interface SyncProjectsDialogProps {
  onSuccess: () => void;
}

export function SyncProjectsDialog({ onSuccess }: SyncProjectsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<any>(initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  
  const action = (formData: FormData) => {
    startTransition(async () => {
        const result = await handleSyncWabas(null, formData);
        setState(result);
    });
  };

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      setOpen(false);
      onSuccess();
    }
    if (state.error) {
      toast({ title: 'Could not add WABA', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSuccess]);

  return (
    <ZoruDialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <ZoruButton variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />
          Add WABA from Meta
        </ZoruButton>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md">
        <form action={action} ref={formRef}>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add WhatsApp Business Account</ZoruDialogTitle>
            <ZoruDialogDescription>
              Paste a single WhatsApp Business Account (WABA) ID, a permanent access token, and your App ID. We&rsquo;ll fetch the WABA from Meta and add it as a project.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="grid gap-4 py-4">
             <div className="space-y-2">
                <ZoruLabel htmlFor="wabaId">WhatsApp Business Account ID</ZoruLabel>
                <ZoruInput
                    id="wabaId"
                    name="wabaId"
                    placeholder="e.g. 102345678901234"
                    inputMode="numeric"
                    required
                />
                <p className="text-xs text-muted-foreground">
                  Find this in Meta Business Manager → WhatsApp Accounts → your WABA. Do not paste the Business Portfolio ID, Page ID, or App ID here.
                </p>
            </div>
            <div className="space-y-2">
              <ZoruLabel htmlFor="accessToken">Meta Access Token</ZoruLabel>
              <ZoruInput
                id="accessToken"
                name="accessToken"
                type="password"
                placeholder="Permanent system-user token"
                required
              />
               <p className="text-xs text-muted-foreground">
                Needs <code>whatsapp_business_management</code> and <code>whatsapp_business_messaging</code> scopes. See the manual setup guide for instructions on generating a system-user token.
              </p>
            </div>
            <div className="space-y-2">
                <ZoruLabel htmlFor="appId">App ID</ZoruLabel>
                <ZoruInput
                    id="appId"
                    name="appId"
                    placeholder="Your Meta App ID"
                    required
                />
            </div>
             <div className="space-y-2">
                <ZoruLabel htmlFor="groupName">Group Name (Optional)</ZoruLabel>
                <ZoruInput id="groupName" name="groupName" placeholder="e.g. My Agency's Clients" />
                <p className="text-xs text-muted-foreground">The added project will be placed into this new group.</p>
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</ZoruButton>
            <ZoruButton type="submit" disabled={isPending}>
                {isPending ? (
                    <>
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    Adding…
                    </>
                ) : (
                    'Add WABA'
                )}
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
