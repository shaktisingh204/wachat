'use client';

import * as React from 'react';

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/sabcrm/20ui/compat';
import {
  connectSabpublishProvider,
  disconnectSabpublishProvider,
  syncSabpublishLocation,
} from '@/app/actions/sabpublish.actions';
import type { SabpublishProviderDoc } from '@/lib/rust-client/sabpublish-providers';
import {
  ALL_SABPUBLISH_PROVIDER_IDS,
  SABPUBLISH_PROVIDER_LABELS,
  type SabpublishProviderId,
} from '@/lib/sabpublish/provider-ids';

export function SabpublishProvidersTab({
  locationId,
  initial,
}: {
  locationId: string;
  initial: SabpublishProviderDoc[];
}) {
  const [rows, setRows] = React.useState(initial);
  const [busy, setBusy] = React.useState<string | null>(null);

  const byProvider = React.useMemo(() => {
    const m: Partial<Record<SabpublishProviderId, SabpublishProviderDoc>> = {};
    for (const r of rows) m[r.providerId as SabpublishProviderId] = r;
    return m;
  }, [rows]);

  async function handleConnect(p: SabpublishProviderId) {
    setBusy(p);
    const res = await connectSabpublishProvider(locationId, p);
    if (res.ok)
      setRows((prev) =>
        [...prev.filter((r) => r.providerId !== p), res.data] as SabpublishProviderDoc[],
      );
    setBusy(null);
  }

  async function handleDisconnect(rowId: string, providerId: string) {
    setBusy(providerId);
    const res = await disconnectSabpublishProvider(rowId);
    if (res.ok) setRows((prev) => prev.filter((r) => r._id !== rowId));
    setBusy(null);
  }

  async function handleSyncNow(p: SabpublishProviderId) {
    setBusy(p);
    await syncSabpublishLocation(locationId, [p]);
    setBusy(null);
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ALL_SABPUBLISH_PROVIDER_IDS.map((p) => {
        const row = byProvider[p];
        const connected = row?.connectionStatus === 'connected';
        return (
          <Card key={p}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{SABPUBLISH_PROVIDER_LABELS[p]}</span>
                <Badge variant={connected ? 'default' : 'outline'}>
                  {row?.connectionStatus ?? 'not_connected'}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {row?.lastSyncAt ? (
                <p className="text-sm text-[var(--st-text-secondary)]">
                  Last sync: {new Date(row.lastSyncAt).toLocaleString()}
                </p>
              ) : (
                <p className="text-sm text-[var(--st-text-secondary)]">
                  Never synced.
                </p>
              )}
              {row?.errorMessage ? (
                <p className="text-sm text-[var(--st-text)]">{row.errorMessage}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {connected ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => handleSyncNow(p)}
                      disabled={busy === p}
                    >
                      Sync now
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        row && handleDisconnect(row._id, p)
                      }
                      disabled={busy === p}
                    >
                      Disconnect
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleConnect(p)}
                    disabled={busy === p}
                  >
                    {busy === p ? 'Connecting…' : 'Connect'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
