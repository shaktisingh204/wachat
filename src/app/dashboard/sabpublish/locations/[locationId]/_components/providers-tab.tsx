'use client';

import * as React from 'react';
import { Link2Off, Plug, RefreshCw } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dot,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
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

function statusMeta(status: string | undefined): {
  tone: BadgeTone;
  label: string;
} {
  switch (status) {
    case 'connected':
      return { tone: 'success', label: 'Connected' };
    case 'error':
      return { tone: 'danger', label: 'Error' };
    case 'pending':
      return { tone: 'info', label: 'Pending' };
    default:
      return { tone: 'neutral', label: 'Not connected' };
  }
}

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
      setRows(
        (prev) =>
          [
            ...prev.filter((r) => r.providerId !== p),
            res.data,
          ] as SabpublishProviderDoc[],
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
    <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {ALL_SABPUBLISH_PROVIDER_IDS.map((p) => {
        const row = byProvider[p];
        const connected = row?.connectionStatus === 'connected';
        const meta = statusMeta(row?.connectionStatus);
        return (
          <li key={p}>
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Plug size={16} aria-hidden="true" />
                    {SABPUBLISH_PROVIDER_LABELS[p]}
                  </span>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                </CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-3">
                <p className="flex items-center gap-2 text-sm text-[var(--st-text-secondary)] tabular-nums">
                  <Dot tone={connected ? 'success' : 'neutral'} />
                  {row?.lastSyncAt
                    ? `Last sync ${new Date(row.lastSyncAt).toLocaleString()}`
                    : 'Never synced'}
                </p>
                {row?.errorMessage ? (
                  <p className="text-sm text-[var(--st-danger)]">
                    {row.errorMessage}
                  </p>
                ) : null}
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  {connected ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        iconLeft={RefreshCw}
                        onClick={() => handleSyncNow(p)}
                        loading={busy === p}
                      >
                        Sync now
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        iconLeft={Link2Off}
                        onClick={() => row && handleDisconnect(row._id, p)}
                        disabled={busy === p}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      iconLeft={Plug}
                      onClick={() => handleConnect(p)}
                      loading={busy === p}
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
