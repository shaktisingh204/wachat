'use client';

import * as React from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { CalendarDays, LoaderCircle } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getGoogleCalendarSetting,
  saveGoogleCalendarSetting,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsGoogleCalendarSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsGoogleCalendarSetting & { _id: unknown }) | null;

export default function GoogleCalendarIntegrationPage() {
  const { toast } = useToast();
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
            name="enabled"
            value={enabled ? 'true' : 'false'}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="client_id" className="text-foreground">
                Client ID
              </Label>
              <div className="mt-1.5">
                <Input
                  id="client_id"
                  name="client_id"
                  defaultValue={v('client_id')}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="client_secret" className="text-foreground">
                Client Secret
              </Label>
              <div className="mt-1.5">
                <Input
                  id="client_secret"
                  name="client_secret"
                  type="password"
                  defaultValue={v('client_secret')}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="redirect_uri" className="text-foreground">
                Redirect URI
              </Label>
              <div className="mt-1.5">
                <Input
                  id="redirect_uri"
                  name="redirect_uri"
                  defaultValue={v('redirect_uri')}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <div>
                <div className="text-[13px] font-medium text-foreground">
                  Enabled
                </div>
                <div className="text-[12px] text-muted-foreground">
                  Allow members to connect their Google Calendar.
                </div>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
                aria-label="Google Calendar enabled"
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
