'use client';

import * as React from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { LoaderCircle, Ticket } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getTicketEmailSetting,
  saveTicketEmailSetting,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsTicketEmailSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsTicketEmailSetting & { _id: unknown }) | null;

export default function TicketEmailIntegrationPage() {
  const { toast } = useToast();
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

      <ClayCard>
        {!doc && !id ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
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
              <Label htmlFor="email_address" className="text-clay-ink">
                Email Address
              </Label>
              <div className="mt-1.5">
                <Input
                  id="email_address"
                  name="email_address"
                  type="email"
                  defaultValue={v('email_address')}
                  placeholder="support@example.com"
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="imap_host" className="text-clay-ink">
                IMAP Host
              </Label>
              <div className="mt-1.5">
                <Input
                  id="imap_host"
                  name="imap_host"
                  defaultValue={v('imap_host')}
                  placeholder="imap.example.com"
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="imap_port" className="text-clay-ink">
                IMAP Port
              </Label>
              <div className="mt-1.5">
                <Input
                  id="imap_port"
                  name="imap_port"
                  defaultValue={v('imap_port')}
                  placeholder="993"
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-clay-ink">
                Password
              </Label>
              <div className="mt-1.5">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  defaultValue={v('password')}
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="encryption" className="text-clay-ink">
                Encryption
              </Label>
              <div className="mt-1.5">
                <Input
                  id="encryption"
                  name="encryption"
                  defaultValue={v('encryption')}
                  placeholder="ssl / tls"
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-between rounded-clay-md border border-clay-border bg-clay-surface px-4 py-3">
              <div>
                <div className="text-[13px] font-medium text-clay-ink">
                  Auto-reply
                </div>
                <div className="text-[12px] text-clay-ink-muted">
                  Send an automatic acknowledgement when a ticket is created.
                </div>
              </div>
              <Switch
                checked={autoReply}
                onCheckedChange={setAutoReply}
                aria-label="Auto-reply"
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="auto_reply_body" className="text-clay-ink">
                Auto-reply Body
              </Label>
              <div className="mt-1.5">
                <Textarea
                  id="auto_reply_body"
                  name="auto_reply_body"
                  rows={5}
                  defaultValue={v('auto_reply_body')}
                  placeholder="Thanks for contacting us — we'll reply shortly."
                  className="rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ClayButton
              type="submit"
              variant="obsidian"
              disabled={isSaving}
              leading={
                isSaving ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : null
              }
            >
              Save
            </ClayButton>
          </div>
        </form>
      </ClayCard>
    </div>
  );
}
