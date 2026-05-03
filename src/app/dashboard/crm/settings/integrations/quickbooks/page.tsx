'use client';

import * as React from 'react';
import {
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import {
  FileSpreadsheet,
  LoaderCircle,
  Plug,
  RefreshCw,
  Unplug,
} from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getQuickBooksSetting,
  saveQuickBooksSetting,
  disconnectQuickBooks,
  syncQuickBooks,
} from '@/app/actions/worksuite/integrations.actions';
import type {
  WsQuickBooksSetting,
  WsQuickBooksEnv,
} from '@/lib/worksuite/integrations-types';

type Doc = (WsQuickBooksSetting & { _id: unknown }) | null;

export default function QuickBooksIntegrationPage() {
  const { toast } = useToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [env, setEnv] = useState<WsQuickBooksEnv>('sandbox');
  const [, startLoading] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [isSyncing, startSync] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveQuickBooksSetting,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const d = (await getQuickBooksSetting()) as Doc;
      setDoc(d);
      setEnv((d?.environment as WsQuickBooksEnv) || 'sandbox');
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

  const v = (k: keyof WsQuickBooksSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const id = doc && (doc as any)._id ? String((doc as any)._id) : '';
  const isConnected = Boolean(doc?.access_token && doc?.realm_id);
  const lastSyncedAt = doc?.last_synced_at
    ? new Date(doc.last_synced_at as any).toLocaleString()
    : 'Never';

  const onDisconnect = () => {
    startDisconnect(async () => {
      const res = await disconnectQuickBooks();
      if (res.message) {
        toast({ title: 'QuickBooks', description: res.message });
        refresh();
      } else if (res.error)
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
    });
  };

  const onSync = () => {
    startSync(async () => {
      const res = await syncQuickBooks();
      if (res.message) {
        toast({ title: 'QuickBooks', description: res.message });
        refresh();
      } else if (res.error)
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
        title="QuickBooks"
        subtitle="Sync invoices and payments with QuickBooks Online."
        icon={FileSpreadsheet}
      />

      <ClayCard>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ClayBadge tone={isConnected ? 'green' : 'neutral'}>
              {isConnected ? 'Connected' : 'Not Connected'}
            </ClayBadge>
            <div className="text-[12.5px] text-muted-foreground">
              Last synced: <span className="text-foreground">{lastSyncedAt}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ClayButton
              type="button"
              variant="pill"
              onClick={onSync}
              disabled={isSyncing || !isConnected}
              leading={
                isSyncing ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : (
                  <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                )
              }
            >
              Sync Now
            </ClayButton>
            {isConnected ? (
              <ClayButton
                type="button"
                variant="pill"
                onClick={onDisconnect}
                disabled={isDisconnecting}
                leading={
                  isDisconnecting ? (
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      strokeWidth={1.75}
                    />
                  ) : (
                    <Unplug className="h-4 w-4" strokeWidth={1.75} />
                  )
                }
              >
                Disconnect
              </ClayButton>
            ) : (
              <ClayButton
                type="button"
                variant="obsidian"
                leading={<Plug className="h-4 w-4" strokeWidth={1.75} />}
                onClick={() =>
                  toast({
                    title: 'QuickBooks',
                    description: 'OAuth connect is not wired yet (stub).',
                  })
                }
              >
                Connect
              </ClayButton>
            )}
          </div>
        </div>

        {!doc && !id ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}

        <form action={saveFormAction} className="space-y-4">
          {id ? <input type="hidden" name="_id" value={id} /> : null}

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
                  placeholder="https://example.com/oauth/quickbooks/callback"
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="realm_id" className="text-foreground">
                Realm ID
              </Label>
              <div className="mt-1.5">
                <Input
                  id="realm_id"
                  name="realm_id"
                  defaultValue={v('realm_id')}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="environment" className="text-foreground">
                Environment
              </Label>
              <div className="mt-1.5">
                <Select
                  value={env}
                  onValueChange={(val) => setEnv(val as WsQuickBooksEnv)}
                  name="environment"
                >
                  <SelectTrigger
                    id="environment"
                    className="h-10 rounded-lg border-border bg-card text-[13px]"
                  >
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="access_token" className="text-foreground">
                Access Token
              </Label>
              <div className="mt-1.5">
                <Input
                  id="access_token"
                  name="access_token"
                  type="password"
                  defaultValue={v('access_token')}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="refresh_token" className="text-foreground">
                Refresh Token
              </Label>
              <div className="mt-1.5">
                <Input
                  id="refresh_token"
                  name="refresh_token"
                  type="password"
                  defaultValue={v('refresh_token')}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
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
