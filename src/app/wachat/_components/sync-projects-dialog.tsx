'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Label,
  useZoruToast,
} from '@/components/zoruui';
import {
  useEffect,
  useRef,
  useState,
  useTransition } from 'react';
import { Loader2,
  RefreshCw } from 'lucide-react';

import { handleSyncWabas } from '@/app/actions/index.ts';

/**
 * SyncProjectsDialog (wachat-local, ZoruUI).
 *
 * Replaces the legacy sync-projects-dialog. Same server
 * action (handleSyncWabas), same form fields, same callback signature.
 */

import * as React from 'react';

const initialState: { message?: string | null; error?: string | null } = {
  message: null,
  error: null,
};

interface SyncProjectsDialogProps {
  onSuccess: () => void;
}

export function SyncProjectsDialog({ onSuccess }: SyncProjectsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<{
    message?: string | null;
    error?: string | null;
  }>(initialState);
  const { toast } = useZoruToast();
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
      toast({
        title: 'Could not add WABA',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ZoruDialogTrigger asChild>
        <Button variant="outline" size="md">
          <RefreshCw />
          Add WABA from Meta
        </Button>
      </ZoruDialogTrigger>
      <ZoruDialogContent className="sm:max-w-md">
        <form action={action} ref={formRef}>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add WhatsApp Business Account</ZoruDialogTitle>
            <ZoruDialogDescription>
              Paste a single WhatsApp Business Account (WABA) ID, a permanent
              access token, and your App ID. We&rsquo;ll fetch the WABA from
              Meta and add it as a project.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wabaId">
                WhatsApp Business Account ID
              </Label>
              <Input
                id="wabaId"
                name="wabaId"
                placeholder="e.g. 102345678901234"
                inputMode="numeric"
                required
              />
              <p className="text-[11.5px] text-zoru-ink-muted">
                Find this in Meta Business Manager &rarr; WhatsApp Accounts
                &rarr; your WABA. Do not paste the Business Portfolio ID, Page
                ID, or App ID here.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accessToken">Meta Access Token</Label>
              <Input
                id="accessToken"
                name="accessToken"
                type="password"
                placeholder="Permanent system-user token"
                required
              />
              <p className="text-[11.5px] text-zoru-ink-muted">
                Needs <code className="font-mono">whatsapp_business_management</code>{' '}
                and <code className="font-mono">whatsapp_business_messaging</code>{' '}
                scopes. See the manual setup guide for instructions on
                generating a system-user token.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="appId">App ID</Label>
              <Input
                id="appId"
                name="appId"
                placeholder="Your Meta App ID"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="groupName">Group Name (Optional)</Label>
              <Input
                id="groupName"
                name="groupName"
                placeholder="e.g. My Agency's Clients"
              />
              <p className="text-[11.5px] text-zoru-ink-muted">
                The added project will be placed into this new group.
              </p>
            </div>
          </div>
          <ZoruDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Adding&hellip;
                </>
              ) : (
                'Add WABA'
              )}
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
