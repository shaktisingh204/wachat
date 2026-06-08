import { listDeveloperKeys, getUsageByKey, getUsageLogs } from '@/app/actions/developer-platform.actions';
import {
  PageHeader,
  PageHeading,
  PageEyebrow,
  PageTitle,
  PageDescription,
  StatCard,
  Alert,
  AlertDescription,
} from '@/components/sabcrm/20ui';
import { Key, CheckCircle2, Activity } from 'lucide-react';
import { KeysClient } from './_KeysClient';

export const dynamic = 'force-dynamic';

export default async function ApiKeysPage(): Promise<JSX.Element> {
  const [res, usageRes, logsRes] = await Promise.all([
    listDeveloperKeys(),
    getUsageByKey(),
    getUsageLogs({ limit: 10 }),
  ]);
  const initialKeys = res.success ? (res.keys as Parameters<typeof KeysClient>[0]['initialKeys']) : [];
  const usageData = usageRes.success ? usageRes.rows : [];
  const logsData = logsRes.success ? logsRes.rows : [];
  const loadError = res.success ? null : res.error;

  const totalKeys = initialKeys.length;
  const activeKeys = initialKeys.filter((k) => !k.revoked).length;
  const totalRequests = initialKeys.reduce((sum, k) => {
    const usage = usageData.find((u) => u.keyId === k._id)?.count;
    return sum + (usage ?? k.requestCount ?? 0);
  }, 0);

  return (
    <div className="20ui flex min-h-full flex-col gap-6">
      <PageHeader>
        <PageHeading>
          <PageEyebrow>Developer platform</PageEyebrow>
          <PageTitle>API keys</PageTitle>
          <PageDescription>
            Tenant-scoped Bearer tokens for server-to-server integrations. Treat them like
            passwords — they grant full programmatic access.
          </PageDescription>
        </PageHeading>
      </PageHeader>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Total keys" value={String(totalKeys)} icon={<Key />} accent="#3b7af5" />
        <StatCard label="Active" value={String(activeKeys)} icon={<CheckCircle2 />} accent="#1f9d55" />
        <StatCard
          label="Requests"
          value={totalRequests.toLocaleString('en-US')}
          icon={<Activity />}
          accent="#7c3aed"
        />
      </div>

      {loadError ? (
        <Alert tone="danger" title="Failed to load keys">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <KeysClient initialKeys={initialKeys} usageData={usageData} logsData={logsData} />
    </div>
  );
}
