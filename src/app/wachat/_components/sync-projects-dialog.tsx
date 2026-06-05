'use client';

import {
  Button,
  Modal,
  Field,
  Input,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useRef,
  useState,
  useTransition } from 'react';
import { Loader2,
  RefreshCw } from 'lucide-react';

import { handleSyncWabas } from '@/app/actions/index.ts';

/**
 * SyncProjectsDialog (wachat-local, 20ui).
 *
 * Replaces the legacy sync-projects-dialog. Same server
 * action (handleSyncWabas), same form fields, same callback signature.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

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
      toast({ title: 'Success!', description: state.message, tone: 'success' });
      formRef.current?.reset();
      setOpen(false);
      onSuccess();
    }
    if (state.error) {
      toast({
        title: 'Could not add WABA',
        description: state.error,
        tone: 'danger',
      });
    }
  }, [state, toast, onSuccess]);

  return (
    <>
      <Button variant="outline" size="md" iconLeft={RefreshCw} onClick={() => setOpen(true)}>
        Add WABA from Meta
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="md"
        className="sm:max-w-md"
        title="Add WhatsApp Business Account"
        description="Paste a single WhatsApp Business Account (WABA) ID, a permanent access token, and your App ID. We'll fetch the WABA from Meta and add it as a project."
      >
        <form action={action} ref={formRef}>
          <div className="grid gap-4 py-1">
            <Field
              label="WhatsApp Business Account ID"
              help={
                <>
                  Find this in Meta Business Manager &rarr; WhatsApp Accounts
                  &rarr; your WABA. Do not paste the Business Portfolio ID, Page
                  ID, or App ID here.
                </>
              }
            >
              <Input
                id="wabaId"
                name="wabaId"
                placeholder="e.g. 102345678901234"
                inputMode="numeric"
                required
              />
            </Field>
            <Field
              label="Meta Access Token"
              help={
                <>
                  Needs <code className="font-mono">whatsapp_business_management</code>{' '}
                  and <code className="font-mono">whatsapp_business_messaging</code>{' '}
                  scopes. See the manual setup guide for instructions on
                  generating a system-user token.
                </>
              }
            >
              <Input
                id="accessToken"
                name="accessToken"
                type="password"
                placeholder="Permanent system-user token"
                required
              />
            </Field>
            <Field label="App ID">
              <Input
                id="appId"
                name="appId"
                placeholder="Your Meta App ID"
                required
              />
            </Field>
            <Field
              label="Group Name (Optional)"
              help="The added project will be placed into this new group."
            >
              <Input
                id="groupName"
                name="groupName"
                placeholder="e.g. My Agency's Clients"
              />
            </Field>
          </div>
          <div className={cx('flex justify-end gap-2 pt-4')}>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Adding&hellip;
                </>
              ) : (
                'Add WABA'
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
