'use client';

import { ZoruBadge, ZoruButton, ZoruCard, ZoruInput, ZoruLabel, ZoruSkeleton, useZoruToast } from '@/components/zoruui';
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

import { EnumFormField } from '@/components/crm/enum-form-field';
import { CrmPageHeader } from '../../../_components/crm-page-header';
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
  const { toast } = useZoruToast();
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

      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ZoruBadge variant={isConnected ? 'success' : 'ghost'}>
              {isConnected ? 'Connected' : 'Not Connected'}
            </ZoruBadge>
            <div className="text-[12.5px] text-zoru-ink-muted">
              Last synced: <span className="text-zoru-ink">{lastSyncedAt}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ZoruButton
              type="button"
              variant="outline"
              onClick={onSync}
              disabled={isSyncing || !isConnected}
            >
              {isSyncing ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sync Now
            </ZoruButton>
            {isConnected ? (
              <ZoruButton
                type="button"
                variant="outline"
                onClick={onDisconnect}
                disabled={isDisconnecting}
              >
                {isDisconnecting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="h-4 w-4" />
                )}
                Disconnect
              </ZoruButton>
            ) : (
              <ZoruButton
                type="button"
                onClick={() =>
                  toast({
                    title: 'QuickBooks',
                    description: 'OAuth connect is not wired yet (stub).',
                  })
                }
              >
                <Plug className="h-4 w-4" />
                Connect
              </ZoruButton>
            )}
          </div>
        </div>

        {!doc && !id ? (
          <div className="space-y-4">
            <ZoruSkeleton className="h-10 w-full" />
            <ZoruSkeleton className="h-10 w-full" />
          </div>
        ) : null}

        <form action={saveFormAction} className="space-y-4">
          {id ? <input type="hidden" name="_id" value={id} /> : null}

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
                  placeholder="https://example.com/oauth/quickbooks/callback"
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="realm_id">Realm ID</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="realm_id"
                  name="realm_id"
                  defaultValue={v('realm_id')}
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="environment">Environment</ZoruLabel>
              <div className="mt-1.5">
                <EnumFormField
                  name="environment"
                  enumName="quickbooksEnvironment"
                  initialId={env}
                  onChange={(id) => setEnv((id ?? 'sandbox') as WsQuickBooksEnv)}
                  placeholder="Select environment"
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="access_token">Access Token</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="access_token"
                  name="access_token"
                  type="password"
                  defaultValue={v('access_token')}
                />
              </div>
            </div>

            <div>
              <ZoruLabel htmlFor="refresh_token">Refresh Token</ZoruLabel>
              <div className="mt-1.5">
                <ZoruInput
                  id="refresh_token"
                  name="refresh_token"
                  type="password"
                  defaultValue={v('refresh_token')}
                />
              </div>
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
