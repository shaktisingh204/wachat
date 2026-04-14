'use client';

import * as React from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { BellRing, LoaderCircle } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
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

      <ClayCard>
        {!doc && !id ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
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

          <div className="divide-y divide-clay-border rounded-clay-md border border-clay-border bg-clay-surface">
            {WS_EMAIL_NOTIFICATION_KEYS.map((row) => (
              <div
                key={row.key}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-clay-ink">
                    {row.label}
                  </div>
                  <div className="text-[12px] text-clay-ink-muted">
                    {row.description}
                  </div>
                </div>
                <Switch
                  checked={values[row.key]}
                  onCheckedChange={(n) => setValue(row.key, n)}
                  aria-label={row.label}
                />
              </div>
            ))}
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
