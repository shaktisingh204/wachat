'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruSkeleton, ZoruSwitch, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';
import { LoaderCircle } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getMessageSetting,
  saveMessageSetting,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsMessageSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsMessageSetting & { _id: unknown }) | null;

export default function MessageSettingsIntegrationPage() {
  const { toast } = useZoruToast();
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
    <EntityListShell
      title="Message Settings"
      subtitle="Internal messaging limits and attachment rules."
    >

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
            name="messages_enabled"
            value={messagesEnabled ? 'true' : 'false'}
          />
          <input
            type="hidden"
            name="allow_attachments"
            value={allowAttachments ? 'true' : 'false'}
          />

          <div className="flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
            <div>
              <div className="text-[13px] text-zoru-ink">Messages enabled</div>
              <div className="text-[12px] text-zoru-ink-muted">
                Allow members to direct-message each other.
              </div>
            </div>
            <ZoruSwitch
              checked={messagesEnabled}
              onCheckedChange={setMessagesEnabled}
              aria-label="Messages enabled"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
            <div>
              <div className="text-[13px] text-zoru-ink">Allow attachments</div>
              <div className="text-[12px] text-zoru-ink-muted">
                Allow file attachments on messages.
              </div>
            </div>
            <ZoruSwitch
              checked={allowAttachments}
              onCheckedChange={setAllowAttachments}
              aria-label="Allow attachments"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <ZoruLabel htmlFor="max_file_size_mb">Max File Size (MB)</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="max_file_size_mb"
                  name="max_file_size_mb"
                  type="number"
                  min={0}
                  defaultValue={v('max_file_size_mb') || '10'}
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
    </EntityListShell>
  );
}
