'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruSkeleton, ZoruSwitch, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';
import { LoaderCircle,
  Ticket } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  getTicketEmailSetting,
  saveTicketEmailSetting,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsTicketEmailSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsTicketEmailSetting & { _id: unknown }) | null;

export default function TicketEmailIntegrationPage() {
  const { toast } = useZoruToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [autoReply, setAutoReply] = useState(false);
  const [, startLoading] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveTicketEmailSetting,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const d = (await getTicketEmailSetting()) as Doc;
      setDoc(d);
      setAutoReply(Boolean(d?.auto_reply));
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      refresh();
    }
    if (saveState?.error)
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
  }, [saveState, toast, refresh]);

  const v = (k: keyof WsTicketEmailSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const id = doc && (doc as any)._id ? String((doc as any)._id) : '';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Ticket Email"
        subtitle="IMAP inbox that converts incoming emails into tickets."
        icon={Ticket}
      />

      <ZoruCard className="p-6">
        {!doc && !id ? (
          <div className="space-y-4">
            <ZoruSkeleton className="h-10 w-full" />
            <ZoruSkeleton className="h-10 w-full" />
          </div>
        ) : null}

        <form action={saveFormAction} className="space-y-4">
          {id ? <input type="hidden" name="_id" value={id} /> : null}
          <input
            type="hidden"
            name="auto_reply"
            value={autoReply ? 'true' : 'false'}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <ZoruLabel htmlFor="email_address">Email Address</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="email_address"
                  name="email_address"
                  type="email"
                  defaultValue={v('email_address')}
                  placeholder="support@example.com"
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="imap_host">IMAP Host</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="imap_host"
                  name="imap_host"
                  defaultValue={v('imap_host')}
                  placeholder="imap.example.com"
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="imap_port">IMAP Port</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="imap_port"
                  name="imap_port"
                  defaultValue={v('imap_port')}
                  placeholder="993"
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="password">Password</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="password"
                  name="password"
                  type="password"
                  defaultValue={v('password')}
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="encryption">Encryption</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="encryption"
                  name="encryption"
                  defaultValue={v('encryption')}
                  placeholder="ssl / tls"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
              <div>
                <div className="text-[13px] text-zoru-ink">Auto-reply</div>
                <div className="text-[12px] text-zoru-ink-muted">
                  Send an automatic acknowledgement when a ticket is created.
                </div>
              </div>
              <ZoruSwitch
                checked={autoReply}
                onCheckedChange={setAutoReply}
                aria-label="Auto-reply"
              />
            </div>

            <div className="md:col-span-2">
              <ZoruLabel htmlFor="auto_reply_body">Auto-reply Body</ZoruLabel>
              <div className="mt-1.5">
                <ZoruTextarea
                  id="auto_reply_body"
                  name="auto_reply_body"
                  rows={5}
                  defaultValue={v('auto_reply_body')}
                  placeholder="Thanks for contacting us — we'll reply shortly."
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ZoruButton type="submit" disabled={isSaving}>
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Save
            </ZoruButton>
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
