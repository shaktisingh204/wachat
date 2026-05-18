'use client';

import { ZoruButton, ZoruCard, ZoruSkeleton, ZoruSwitch, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';
import { BellRing,
  LoaderCircle } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  getEmailNotificationSetting,
  saveEmailNotificationSetting,
} from '@/app/actions/worksuite/integrations.actions';
import {
  WS_EMAIL_NOTIFICATION_KEYS,
  type WsEmailNotificationSetting,
} from '@/lib/worksuite/integrations-types';

type Doc = (WsEmailNotificationSetting & { _id: unknown }) | null;

type ToggleKey = (typeof WS_EMAIL_NOTIFICATION_KEYS)[number]['key'];

export default function EmailNotificationsIntegrationPage() {
  const { toast } = useZoruToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [values, setValues] = useState<Record<ToggleKey, boolean>>(
    () =>
      WS_EMAIL_NOTIFICATION_KEYS.reduce(
        (acc, row) => {
          acc[row.key] = false;
          return acc;
        },
        {} as Record<ToggleKey, boolean>,
      ),
  );
  const [, startLoading] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveEmailNotificationSetting,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const d = (await getEmailNotificationSetting()) as Doc;
      setDoc(d);
      if (d) {
        setValues((prev) => {
          const next = { ...prev };
          for (const row of WS_EMAIL_NOTIFICATION_KEYS) {
            next[row.key] = Boolean((d as any)[row.key]);
          }
          return next;
        });
      }
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

  const setValue = (key: ToggleKey, next: boolean) => {
    setValues((prev) => ({ ...prev, [key]: next }));
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Email Notifications"
        subtitle="Per-event email delivery toggles."
        icon={BellRing}
      />

      <ZoruCard className="p-6">
        {!doc && !id ? (
          <div className="space-y-3">
            <ZoruSkeleton className="h-10 w-full" />
            <ZoruSkeleton className="h-10 w-full" />
            <ZoruSkeleton className="h-10 w-full" />
          </div>
        ) : null}

        <form action={saveFormAction} className="space-y-4">
          {id ? <input type="hidden" name="_id" value={id} /> : null}
          {WS_EMAIL_NOTIFICATION_KEYS.map((row) => (
            <input
              key={`hidden-${row.key}`}
              type="hidden"
              name={row.key}
              value={values[row.key] ? 'true' : 'false'}
            />
          ))}

          <div className="divide-y divide-zoru-line rounded-lg border border-zoru-line bg-zoru-bg">
            {WS_EMAIL_NOTIFICATION_KEYS.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-[13px] text-zoru-ink">{row.label}</div>
                  <div className="text-[12px] text-zoru-ink-muted">
                    {row.description}
                  </div>
                </div>
                <ZoruSwitch
                  checked={values[row.key]}
                  onCheckedChange={(n) => setValue(row.key, n)}
                  aria-label={row.label}
                />
              </div>
            ))}
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
