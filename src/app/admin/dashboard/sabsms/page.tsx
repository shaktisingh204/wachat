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
import { SabsmsHistoricalChart } from './HistoricalChart';
import { QueueActions } from './QueueActions';

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

async function countMessages() {
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

async function getHistoricalData() {
  const { db } = await connectToDatabase();
  const col = db.collection(SABSMS_COLLECTIONS.messages);
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const rawStats = await col.aggregate([
    {
      $match: {
        createdAt: { $gte: thirtyDaysAgo }
      }
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
        },
        sent: {
          $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
        },
        delivered: {
          $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] }
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
        },
        queued: {
          $sum: { $cond: [{ $eq: ['$status', 'queued'] }, 1, 0] }
        }
      }
    },
    {
      $sort: { _id: 1 }
    }
  ]).toArray();

  return rawStats.map(stat => ({
    _id: stat._id,
    sent: stat.sent || 0,
    delivered: stat.delivered || 0,
    failed: stat.failed || 0,
    queued: stat.queued || 0,
  }));
}

export default async function SabsmsAdminOverviewPage() {
  const { isAdmin } = await getAdminSession();
  if (!isAdmin) redirect('/admin-login');

  const [health, counts, historicalData] = await Promise.all([
    probeEngine(), 
    countMessages(),
    getHistoricalData()
  ]);

  return (
    <div className="space-y-6">
      <PageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>SabSMS</ZoruPageTitle>
          <ZoruPageDescription>
            Rust engine at{' '}
            <code className="rounded bg-zoru-surface px-1 py-0.5 text-xs">
              {process.env.SABSMS_ENGINE_URL ?? 'http://localhost:4002'}
            </code>{' '}
            ·{' '}
            <Link
              href="/admin/dashboard/sabsms/debug"
              className="text-zoru-ink underline underline-offset-2"
            >
              open send debug
            </Link>
          </ZoruPageDescription>
        </ZoruPageHeading>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <ZoruCardHeader>
            <ZoruCardTitle>Engine</ZoruCardTitle>
            <ZoruCardDescription>
              Live status reported by the Rust service.
            </ZoruCardDescription>
          </ZoruCardHeader>
          <ZoruCardContent className="flex flex-wrap items-center gap-3 text-sm">
            {health.reachable ? (
              <Badge variant="default">healthy</Badge>
            ) : (
              <Badge variant="destructive">unreachable</Badge>
            )}
            {health.version && (
              <span className="text-zoru-ink-muted">version {health.version}</span>
            )}
            {health.error && (
              <span className="text-zoru-ink">{health.error}</span>
            )}
          </ZoruCardContent>
        </Card>
        
        <QueueActions />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Total" value={counts.total.toLocaleString()} />
        <StatCard label="Queued" value={counts.queued.toLocaleString()} />
        <StatCard label="Sent" value={counts.sent.toLocaleString()} />
        <StatCard label="Delivered" value={counts.delivered.toLocaleString()} />
        <StatCard label="Failed" value={counts.failed.toLocaleString()} />
      </div>

      <SabsmsHistoricalChart data={historicalData} />
    </div>
  );
}
