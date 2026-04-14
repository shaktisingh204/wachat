'use client';

import * as React from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { LoaderCircle, Play, Slack } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getSlackSetting,
  saveSlackSetting,
  testSlackWebhook,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsSlackSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsSlackSetting & { _id: unknown }) | null;

export default function SlackIntegrationPage() {
  const { toast } = useToast();
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

      <ClayCard>
        {!doc && !id ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
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
              <Label htmlFor="webhook_url" className="text-clay-ink">
                Webhook URL
              </Label>
              <div className="mt-1.5">
                <Input
                  id="webhook_url"
                  name="webhook_url"
                  defaultValue={v('webhook_url')}
                  placeholder="https://hooks.slack.com/services/..."
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="channel" className="text-clay-ink">
                Channel
              </Label>
              <div className="mt-1.5">
                <Input
                  id="channel"
                  name="channel"
                  defaultValue={v('channel')}
                  placeholder="#general"
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="username" className="text-clay-ink">
                Username
              </Label>
              <div className="mt-1.5">
                <Input
                  id="username"
                  name="username"
                  defaultValue={v('username')}
                  placeholder="SabNode"
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex items-center justify-between rounded-clay-md border border-clay-border bg-clay-surface px-4 py-3">
              <div>
                <div className="text-[13px] font-medium text-clay-ink">
                  Active
                </div>
                <div className="text-[12px] text-clay-ink-muted">
                  Enable Slack notifications.
                </div>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                aria-label="Slack active"
              />
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <ClayButton
              type="button"
              variant="obsidian"
              onClick={onTest}
              disabled={isTesting}
              leading={
                isTesting ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : (
                  <Play className="h-4 w-4" strokeWidth={1.75} />
                )
              }
            >
              Test Webhook
            </ClayButton>
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
