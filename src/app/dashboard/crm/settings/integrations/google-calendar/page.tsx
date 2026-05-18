'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruSkeleton, ZoruSwitch, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';
import { CalendarDays,
  LoaderCircle } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  getGoogleCalendarSetting,
  saveGoogleCalendarSetting,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsGoogleCalendarSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsGoogleCalendarSetting & { _id: unknown }) | null;

export default function GoogleCalendarIntegrationPage() {
  const { toast } = useZoruToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [enabled, setEnabled] = useState(false);
  const [, startLoading] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveGoogleCalendarSetting,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const d = (await getGoogleCalendarSetting()) as Doc;
      setDoc(d);
      setEnabled(Boolean(d?.enabled));
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

  const v = (k: keyof WsGoogleCalendarSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const id = doc && (doc as any)._id ? String((doc as any)._id) : '';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Google Calendar"
        subtitle="OAuth credentials for Google Calendar sync."
        icon={CalendarDays}
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
            name="enabled"
            value={enabled ? 'true' : 'false'}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <ZoruLabel htmlFor="client_id">Client ID</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="client_id"
                  name="client_id"
                  defaultValue={v('client_id')}
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="client_secret">Client Secret</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="client_secret"
                  name="client_secret"
                  type="password"
                  defaultValue={v('client_secret')}
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <ZoruLabel htmlFor="redirect_uri">Redirect URI</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="redirect_uri"
                  name="redirect_uri"
                  defaultValue={v('redirect_uri')}
                />
              </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
              <div>
                <div className="text-[13px] text-zoru-ink">Enabled</div>
                <div className="text-[12px] text-zoru-ink-muted">
                  Allow members to connect their Google Calendar.
                </div>
              </div>
              <ZoruSwitch
                checked={enabled}
                onCheckedChange={setEnabled}
                aria-label="Google Calendar enabled"
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
