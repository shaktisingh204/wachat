'use client';

import * as React from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { LoaderCircle, Play, Zap } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getPusherSetting,
  savePusherSetting,
  testPusher,
} from '@/app/actions/worksuite/integrations.actions';
import type { WsPusherSetting } from '@/lib/worksuite/integrations-types';

type Doc = (WsPusherSetting & { _id: unknown }) | null;

export default function PusherIntegrationPage() {
  const { toast } = useToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [isActive, setIsActive] = useState(false);
  const [, startLoading] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    savePusherSetting,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const d = (await getPusherSetting()) as Doc;
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

  const v = (k: keyof WsPusherSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const id = doc && (doc as any)._id ? String((doc as any)._id) : '';

  const onTest = () => {
    startTesting(async () => {
      const res = await testPusher();
      if (res.message) toast({ title: 'Pusher', description: res.message });
      else if (res.error)
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Pusher"
        subtitle="Realtime channel credentials for live updates."
        icon={Zap}
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
            name="is_active"
            value={isActive ? 'true' : 'false'}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="app_id" className="text-clay-ink">
                App ID
              </Label>
              <div className="mt-1.5">
                <Input
                  id="app_id"
                  name="app_id"
                  defaultValue={v('app_id')}
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="cluster" className="text-clay-ink">
                Cluster
              </Label>
              <div className="mt-1.5">
                <Input
                  id="cluster"
                  name="cluster"
                  defaultValue={v('cluster')}
                  placeholder="mt1"
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="app_key" className="text-clay-ink">
                App Key
              </Label>
              <div className="mt-1.5">
                <Input
                  id="app_key"
                  name="app_key"
                  defaultValue={v('app_key')}
                  className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="app_secret" className="text-clay-ink">
                App Secret
              </Label>
              <div className="mt-1.5">
                <Input
                  id="app_secret"
                  name="app_secret"
                  type="password"
                  defaultValue={v('app_secret')}
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
                  Enable Pusher realtime.
                </div>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                aria-label="Pusher active"
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
              Test
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
