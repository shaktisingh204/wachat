'use client';

import * as React from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { LoaderCircle, MessageSquare } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getMessageSetting,
  saveMessageSetting,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsMessageSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsMessageSetting & { _id: unknown }) | null;

export default function MessageSettingsIntegrationPage() {
  const { toast } = useToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [messagesEnabled, setMessagesEnabled] = useState(false);
  const [allowAttachments, setAllowAttachments] = useState(false);
  const [, startLoading] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveMessageSetting,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const d = (await getMessageSetting()) as Doc;
      setDoc(d);
      setMessagesEnabled(Boolean(d?.messages_enabled));
      setAllowAttachments(Boolean(d?.allow_attachments));
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

  const v = (k: keyof WsMessageSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const id = doc && (doc as any)._id ? String((doc as any)._id) : '';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Message Settings"
        subtitle="Internal messaging limits and attachment rules."
        icon={MessageSquare}
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
            name="messages_enabled"
            value={messagesEnabled ? 'true' : 'false'}
          />
          <input
            type="hidden"
            name="allow_attachments"
            value={allowAttachments ? 'true' : 'false'}
          />

          <div className="flex items-center justify-between rounded-clay-md border border-clay-border bg-clay-surface px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-clay-ink">
                Messages enabled
              </div>
              <div className="text-[12px] text-clay-ink-muted">
                Allow members to direct-message each other.
              </div>
            </div>
            <Switch
              checked={messagesEnabled}
              onCheckedChange={setMessagesEnabled}
              aria-label="Messages enabled"
            />
          </div>

          <div className="flex items-center justify-between rounded-clay-md border border-clay-border bg-clay-surface px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-clay-ink">
                Allow attachments
              </div>
              <div className="text-[12px] text-clay-ink-muted">
                Allow file attachments on messages.
              </div>
            </div>
            <Switch
              checked={allowAttachments}
              onCheckedChange={setAllowAttachments}
              aria-label="Allow attachments"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="max_file_size_mb" className="text-clay-ink">
                Max File Size (MB)
              </Label>
              <div className="mt-1.5">
                <Input
                  id="max_file_size_mb"
                  name="max_file_size_mb"
                  type="number"
                  min={0}
                  defaultValue={v('max_file_size_mb') || '10'}
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
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
