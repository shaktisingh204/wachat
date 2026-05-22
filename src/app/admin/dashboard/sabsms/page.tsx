import { redirect } from 'next/navigation';
import Link from 'next/link';

import { getAdminSession } from '@/lib/admin-session';
import { sabsmsEngine, SabsmsEngineError } from '@/lib/sabsms/engine-client';
import { connectToDatabase } from '@/lib/mongodb';
import { SABSMS_COLLECTIONS } from '@/lib/sabsms/db/collections';
import {
  Badge,
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageDescription,
  PageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  StatCard,
} from '@/components/zoruui';

export const dynamic = 'force-dynamic';

interface EngineHealth {
  reachable: boolean;
  version?: string;
  error?: string;
}

async function probeEngine(): Promise<EngineHealth> {
  if ((process.env.SABSMS_ENABLED ?? 'false').toLowerCase() !== 'true') {
    return { reachable: false, error: 'SABSMS_ENABLED=false' };
  }
  try {
    const h = await sabsmsEngine.health();
    return { reachable: !!h.ok, version: h.version };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { reachable: false, error: `${e.status} ${e.message}` };
    }
    return { reachable: false, error: (e as Error)?.message ?? 'unreachable' };
  }
}

async function countMessages(): Promise<{
  total: number;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
}> {
  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.messages);
  const [total, queued, sent, delivered, failed] = await Promise.all([
    col.estimatedDocumentCount(),
    col.countDocuments({ status: 'queued' }),
    col.countDocuments({ status: 'sent' }),
    col.countDocuments({ status: 'delivered' }),
    col.countDocuments({ status: 'failed' }),
  ]);
  return { total, queued, sent, delivered, failed };
}

export default async function SabsmsAdminOverviewPage() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) redirect('/admin-login');

  const [health, counts] = await Promise.all([probeEngine(), countMessages()]);

  return (
    <div className="space-y-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>SabSMS</ZoruPageTitle>
          <ZoruPageDescription>
            Rust engine at{' '}
            <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">
              {process.env.SABSMS_ENGINE_URL ?? 'http://localhost:4002'}
            </code>{' '}
            ·{' '}
            <Link
              href="/admin/dashboard/sabsms/debug"
              className="text-amber-600 underline underline-offset-2"
            >
              open send debug
            </Link>
          </ZoruPageDescription>
        </ZoruPageHeading>
      </ZoruPageHeader>

      <ZoruCard>
        <ZoruCardHeader>
          <ZoruCardTitle>Engine</ZoruCardTitle>
          <ZoruCardDescription>
            Live status reported by the Rust service.
          </ZoruCardDescription>
        </ZoruCardHeader>
        <ZoruCardContent className="flex flex-wrap items-center gap-3 text-sm">
          {health.reachable ? (
            <ZoruBadge variant="default">healthy</ZoruBadge>
          ) : (
            <ZoruBadge variant="destructive">unreachable</ZoruBadge>
          )}
          {health.version && (
            <span className="text-slate-600">version {health.version}</span>
          )}
          {health.error && (
            <span className="text-rose-600">{health.error}</span>
          )}
        </ZoruCardContent>
      </ZoruCard>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <ZoruStatCard label="Total" value={counts.total.toLocaleString()} />
        <ZoruStatCard label="Queued" value={counts.queued.toLocaleString()} />
        <ZoruStatCard label="Sent" value={counts.sent.toLocaleString()} />
        <ZoruStatCard label="Delivered" value={counts.delivered.toLocaleString()} />
        <ZoruStatCard label="Failed" value={counts.failed.toLocaleString()} />
      </div>
    </div>
  );
}
