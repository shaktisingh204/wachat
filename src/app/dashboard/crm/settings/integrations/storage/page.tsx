'use client';

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';
import {
  AlertCircle,
  Archive,
  Cloud,
  Database,
  HardDrive,
  LoaderCircle,
  Upload,
} from 'lucide-react';

import { Badge, Button, Card, CardBody, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from '@/components/sabcrm/20ui/compat';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  ConnectionHeader,
  IntegrationActivityFeed,
  IntegrationKpiGrid,
  IntegrationSection,
  useIntegrationToast,
  type ConnectionState,
} from '@/components/crm/integration-console';
import {
  getStorageSetting,
  saveStorageSetting,
  testIntegration,
  disconnectIntegration,
  getIntegrationEvents,
  getIntegrationStats,
  type IntegrationEvent,
  type IntegrationStats,
} from '@/app/actions/worksuite/integrations.actions';
import type {
  WsStorageDriver,
  WsStorageSetting,
} from '@/lib/worksuite/integrations-types';

type Doc = (WsStorageSetting & { _id: unknown }) | null;

const DRIVER_LABELS: Record<WsStorageDriver, string> = {
  local: 'Local disk',
  s3: 'Amazon S3 / R2',
  'google-drive': 'Google Drive',
  azure: 'Azure Blob',
};

export default function StorageIntegrationPage() {
  const { reportResult } = useIntegrationToast();
  const [doc, setDoc] = useState<Doc>(null);
  const [driver, setDriver] = useState<WsStorageDriver>('local');
  const [events, setEvents] = useState<IntegrationEvent[]>([]);
  const [stats, setStats] = useState<IntegrationStats | null>(null);
  const [, startLoading] = useTransition();
  const [isTesting, startTesting] = useTransition();
  const [isDisconnecting, startDisconnect] = useTransition();
  const [saveState, saveFormAction, isSaving] = useActionState(
    saveStorageSetting,
    { message: '', error: '' } as {
      message?: string;
      error?: string;
      id?: string;
    },
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [d, ev, st] = await Promise.all([
        getStorageSetting() as Promise<Doc>,
        getIntegrationEvents('storage', 10),
        getIntegrationStats('storage'),
      ]);
      setDoc(d);
      setDriver((d?.storage_driver as WsStorageDriver) || 'local');
      setEvents(ev);
      setStats(st);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      reportResult('storage', saveState);
      refresh();
    } else if (saveState?.error) {
      reportResult('storage', saveState);
    }
  }, [saveState, reportResult, refresh]);

  const v = (k: keyof WsStorageSetting) => {
    const val = doc ? (doc as any)[k] : undefined;
    return val == null ? '' : String(val);
  };

  const docId = doc && (doc as any)._id ? String((doc as any)._id) : '';

  const bucketLabel = useMemo(() => {
    if (driver === 's3') return doc?.aws_bucket || 'no bucket';
    if (driver === 'google-drive') return 'Google Drive root';
    if (driver === 'azure') return doc?.azure_account || 'no container';
    return 'Local /storage';
  }, [driver, doc]);

  const isConfigured = useMemo(() => {
    if (!doc) return false;
    if (driver === 's3') {
      return Boolean(doc.aws_access_key && doc.aws_secret && doc.aws_bucket);
    }
    if (driver === 'google-drive') {
      return Boolean(doc.gd_client_id && doc.gd_client_secret);
    }
    if (driver === 'azure') return Boolean(doc.azure_account);
    return true; // local driver always usable
  }, [doc, driver]);

  const state: ConnectionState = isConfigured
    ? stats?.lastErrorMessage
      ? 'error'
      : 'connected'
    : 'disconnected';

  // Files stored / MB used derive from "upload" events on this provider.
  const filesStored = useMemo(() => {
    return events
      .filter((e) => e.kind === 'upload' && e.status === 'success')
      .reduce((n, e) => n + (e.count ?? 1), 0);
  }, [events]);

  const mbUsed = useMemo(() => {
    return events
      .filter((e) => e.kind === 'upload' && e.status === 'success')
      .reduce((n, e) => {
        const mb = (e.meta as any)?.sizeMb;
        return n + (typeof mb === 'number' ? mb : 0);
      }, 0);
  }, [events]);

  const lastUpload = events.find(
    (e) => e.kind === 'upload' && e.status === 'success',
  );
  const lastUploadLabel = lastUpload
    ? new Date(lastUpload.createdAt).toLocaleString()
    : 'Never';

  const onTest = () => {
    startTesting(async () => {
      const res = await testIntegration('storage');
      reportResult('storage', res);
      refresh();
    });
  };

  const onDisconnect = () => {
    startDisconnect(async () => {
      const res = await disconnectIntegration('storage');
      reportResult('storage', res);
      refresh();
    });
  };

  return (
    <EntityListShell
      title="Storage"
      subtitle="Filesystem driver and bucket for CRM uploads."
    >
      <div className="space-y-4">
        <ConnectionHeader
          name="Storage"
          description="Where CRM files (invoices, attachments, exports) are persisted."
          icon={HardDrive}
          state={state}
          connectedAs={`${DRIVER_LABELS[driver]} · ${bucketLabel}`}
          connectedAt={(doc as any)?.updatedAt || (doc as any)?.createdAt || null}
          scopes={[driver]}
          onTest={isConfigured ? onTest : undefined}
          isTesting={isTesting}
          onDisconnect={onDisconnect}
          isDisconnecting={isDisconnecting}
        />

        <IntegrationKpiGrid
          kpis={[
            {
              label: 'Bucket / driver',
              value: (
                <span className="inline-flex items-center gap-1.5">
                  <Cloud className="h-4 w-4" />
                  {DRIVER_LABELS[driver]}
                </span>
              ),
              period: bucketLabel,
              icon: <Database />,
            },
            {
              label: 'Files stored',
              value: filesStored,
              period: 'Tracked via upload events',
              icon: <Archive />,
            },
            {
              label: 'Storage used',
              value: `${mbUsed.toFixed(1)} MB`,
              period: `${stats?.deliveriesThisMonth ?? 0} uploads / month`,
              icon: <HardDrive />,
            },
            {
              label: 'Last upload',
              value: lastUploadLabel,
              period: stats?.failuresToday
                ? `${stats.failuresToday} failed today`
                : 'Healthy',
              icon: <Upload />,
              invertDelta: true,
              delta: stats?.failuresToday ?? 0,
            },
          ]}
        />

        <IntegrationSection
          title="Driver & credentials"
          description="Pick a storage driver and provide the credentials it needs."
          actions={
            <Badge variant="secondary">
              Active: {DRIVER_LABELS[driver]}
            </Badge>
          }
        >
          {!doc && !docId ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}

          <form action={saveFormAction} className="space-y-4">
            {docId ? <input type="hidden" name="_id" value={docId} /> : null}
            <input type="hidden" name="storage_driver" value={driver} />

            <div>
              <Label htmlFor="storage_driver_select">
                Storage driver
              </Label>
              <div className="mt-1.5">
                <Select
                  value={driver}
                  onValueChange={(val) => setDriver(val as WsStorageDriver)}
                >
                  <SelectTrigger id="storage_driver_select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DRIVER_LABELS) as WsStorageDriver[]).map(
                      (k) => (
                        <SelectItem key={k} value={k}>
                          {DRIVER_LABELS[k]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {driver === 's3' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="aws_access_key">Access key</Label>
                  <div className="mt-1.5">
                    <Input
                      id="aws_access_key"
                      name="aws_access_key"
                      defaultValue={v('aws_access_key')}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="aws_secret">Secret key</Label>
                  <div className="mt-1.5">
                    <Input
                      id="aws_secret"
                      name="aws_secret"
                      type="password"
                      defaultValue={v('aws_secret')}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="aws_region">Region</Label>
                  <div className="mt-1.5">
                    <Input
                      id="aws_region"
                      name="aws_region"
                      defaultValue={v('aws_region')}
                      placeholder="us-east-1"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="aws_bucket">Bucket</Label>
                  <div className="mt-1.5">
                    <Input
                      id="aws_bucket"
                      name="aws_bucket"
                      defaultValue={v('aws_bucket')}
                      placeholder="sabnode-prod"
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {driver === 'google-drive' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="gd_client_id">Client ID</Label>
                  <div className="mt-1.5">
                    <Input
                      id="gd_client_id"
                      name="gd_client_id"
                      defaultValue={v('gd_client_id')}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="gd_client_secret">
                    Client secret
                  </Label>
                  <div className="mt-1.5">
                    <Input
                      id="gd_client_secret"
                      name="gd_client_secret"
                      type="password"
                      defaultValue={v('gd_client_secret')}
                    />
                  </div>
                </div>
              </div>
            ) : null}

            {driver === 'azure' ? (
              <div>
                <Label htmlFor="azure_account">Account / container</Label>
                <div className="mt-1.5">
                  <Input
                    id="azure_account"
                    name="azure_account"
                    defaultValue={v('azure_account')}
                  />
                </div>
              </div>
            ) : null}

            {driver === 'local' ? (
              <div className="rounded-lg border border-dashed border-[var(--st-border)] bg-[var(--st-bg)] p-4 text-xs text-[var(--st-text-secondary)]">
                Local driver writes to the application&apos;s storage folder.
                No credentials required.
              </div>
            ) : null}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : null}
                Save changes
              </Button>
            </div>
          </form>
        </IntegrationSection>

        {stats?.lastErrorMessage ? (
          <Card>
            <CardBody className="flex items-start gap-3 border-l-2 border-[var(--st-danger)]/40 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 text-[var(--st-danger)]" />
              <div>
                <p className="text-sm font-medium text-[var(--st-text)]">
                  Last upload error
                </p>
                <p className="mt-0.5 text-xs text-[var(--st-text-secondary)] break-words">
                  {stats.lastErrorMessage}
                </p>
              </div>
            </CardBody>
          </Card>
        ) : null}

        <IntegrationActivityFeed
          title="Upload activity"
          description="Uploads, deletes and driver health checks."
          events={events}
          emptyMessage="No uploads yet."
        />
      </div>
    </EntityListShell>
  );
}
