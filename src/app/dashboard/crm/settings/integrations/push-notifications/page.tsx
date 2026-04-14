'use client';

import * as React from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { BellPlus, LoaderCircle } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getPushNotificationSetting,
  savePushNotificationSetting,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsPushNotificationSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsPushNotificationSetting & { _id: unknown }) | null;

export default function PushNotificationsIntegrationPage() {
  const { toast } = useToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [enabled, setEnabled] = useState(false);
  const [, startLoading] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    savePushNotificationSetting,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const d = (await getPushNotificationSetting()) as Doc;
      setDoc(d);
      setEnabled(Boolean(d?.is_enabled));
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

  const id = doc && (doc as any)._id ? String((doc as any)._id) : '';
  const firebaseConfigStr = doc?.firebase_config
    ? typeof doc.firebase_config === 'string'
      ? String(doc.firebase_config)
      : JSON.stringify(doc.firebase_config, null, 2)
    : '';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Push Notifications"
        subtitle="Firebase Cloud Messaging configuration."
        icon={BellPlus}
      />

      <ClayCard>
        {!doc && !id ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : null}

        <form action={saveFormAction} className="space-y-4">
          {id ? <input type="hidden" name="_id" value={id} /> : null}
          <input
            type="hidden"
            name="is_enabled"
            value={enabled ? 'true' : 'false'}
          />

          <div className="flex items-center justify-between rounded-clay-md border border-clay-border bg-clay-surface px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-clay-ink">
                Push notifications enabled
              </div>
              <div className="text-[12px] text-clay-ink-muted">
                Deliver realtime notifications via FCM.
              </div>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label="Push notifications enabled"
            />
          </div>

          <div>
            <Label htmlFor="firebase_config" className="text-clay-ink">
              Firebase Config (JSON)
            </Label>
            <div className="mt-1.5">
              <Textarea
                id="firebase_config"
                name="firebase_config"
                rows={10}
                defaultValue={firebaseConfigStr}
                placeholder='{"apiKey":"...","projectId":"..."}'
                className="rounded-clay-md border-clay-border bg-clay-surface font-mono text-[12.5px]"
              />
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
