'use client';

import { ZoruButton, ZoruCard, ZoruLabel, ZoruSkeleton, ZoruSwitch, ZoruTextarea, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';
import { BellPlus,
  LoaderCircle } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  getPushNotificationSetting,
  savePushNotificationSetting,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsPushNotificationSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsPushNotificationSetting & { _id: unknown }) | null;

export default function PushNotificationsIntegrationPage() {
  const { toast } = useZoruToast();
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

      <ZoruCard className="p-6">
        {!doc && !id ? (
          <div className="space-y-4">
            <ZoruSkeleton className="h-10 w-full" />
            <ZoruSkeleton className="h-32 w-full" />
          </div>
        ) : null}

        <form action={saveFormAction} className="space-y-4">
          {id ? <input type="hidden" name="_id" value={id} /> : null}
          <input
            type="hidden"
            name="is_enabled"
            value={enabled ? 'true' : 'false'}
          />

          <div className="flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
            <div>
              <div className="text-[13px] text-zoru-ink">
                Push notifications enabled
              </div>
              <div className="text-[12px] text-zoru-ink-muted">
                Deliver realtime notifications via FCM.
              </div>
            </div>
            <ZoruSwitch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label="Push notifications enabled"
            />
          </div>

          <div>
            <ZoruLabel htmlFor="firebase_config">Firebase Config (JSON)</ZoruLabel>
            <div className="mt-1.5">
              <ZoruTextarea
                id="firebase_config"
                name="firebase_config"
                rows={10}
                defaultValue={firebaseConfigStr}
                placeholder='{"apiKey":"...","projectId":"..."}'
                className="font-mono text-[12.5px]"
              />
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
