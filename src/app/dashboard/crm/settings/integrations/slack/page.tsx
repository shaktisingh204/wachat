'use client';

import { ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruSkeleton, ZoruSwitch, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
  } from 'react';
import { LoaderCircle,
  Play,
  Slack } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  getSlackSetting,
  saveSlackSetting,
  testSlackWebhook,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsSlackSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsSlackSetting & { _id: unknown }) | null;

export default function SlackIntegrationPage() {
  const { toast } = useZoruToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [isActive, setIsActive] = useState(false);
  const [, startLoading] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveSlackSetting,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const d = (await getSlackSetting()) as Doc;
      setDoc(d);
      setIsActive(Boolean(d?.is_active));
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
    if (saveState?.error) {
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refresh]);

  const v = (k: keyof WsSlackSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const id = doc && (doc as any)._id ? String((doc as any)._id) : '';

  const onTest = () => {
    startTesting(async () => {
      const res = await testSlackWebhook();
      if (res.message) {
        toast({ title: 'Slack', description: res.message });
      } else if (res.error) {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Slack"
        subtitle="Post notifications to a Slack channel via incoming webhook."
        icon={Slack}
      />

      <ZoruCard className="p-6">
        {!doc && !id ? (
          <div className="space-y-4">
            <ZoruSkeleton className="h-10 w-full" />
            <ZoruSkeleton className="h-10 w-full" />
            <ZoruSkeleton className="h-10 w-full" />
          </div>
        ) : null}

        <form action={saveFormAction} className="space-y-4">
          {id ? <input type="hidden" name="_id" value={id} /> : null}
          <input
            type="hidden"
            name="is_active"
            value={isActive ? 'true' : 'false'}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <ZoruLabel htmlFor="webhook_url">Webhook URL</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="webhook_url"
                  name="webhook_url"
                  defaultValue={v('webhook_url')}
                  placeholder="https://hooks.slack.com/services/..."
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="channel">Channel</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="channel"
                  name="channel"
                  defaultValue={v('channel')}
                  placeholder="#general"
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="username">Username</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="username"
                  name="username"
                  defaultValue={v('username')}
                  placeholder="SabNode"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
              <div>
                <div className="text-[13px] text-zoru-ink">Active</div>
                <div className="text-[12px] text-zoru-ink-muted">
                  Enable Slack notifications.
                </div>
              </div>
              <ZoruSwitch
                checked={isActive}
                onCheckedChange={setIsActive}
                aria-label="Slack active"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <ZoruButton
              type="button"
              onClick={onTest}
              disabled={isTesting}
            >
              {isTesting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Test Webhook
            </ZoruButton>
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
