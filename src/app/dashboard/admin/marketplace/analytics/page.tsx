/**
 * /dashboard/admin/marketplace/analytics
 *
 * Phase C.10.10 — Marketplace telemetry & analytics admin page.
 *
 * Server component (no 'use client' — data is fetched server-side at
 * request time). Gated by the admin session cookie, matching the pattern
 * used by `src/app/dashboard/internal/sabflow-coverage/page.tsx`.
 *
 * Displays:
 *   - KPI row: total published templates, all-time installs, last-30d installs,
 *     last-30d views.
 *   - Top 10 templates table (by install count, last 30-day window included).
 *   - Recent search queries table (last 20 searches from the events collection).
 *
 * On any data-fetch error the page degrades gracefully to an empty-state
 * banner per section without breaking the rest of the view.
 */

import { redirect } from 'next/navigation';
import { BarChart3, Download, Eye, Search, ShieldCheck, Store } from 'lucide-react';

import { Card, CardContent } from '@/components/sabcrm/20ui/compat';
import { Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';

import { getAdminSession } from '@/lib/admin-session';
import { connectToDatabase } from '@/lib/mongodb';
import {
  MARKETPLACE_EVENTS_COLLECTION,
} from '@/lib/sabflow/marketplace/telemetry';
import { SABFLOW_MARKETPLACE_TEMPLATES_COLLECTION } from '@/lib/sabflow/marketplace/templates';

import { TopTemplatesChart, InstallTrendsChart } from './analytics-charts';

export const metadata = {
  title: 'Marketplace Analytics | SabFlow Admin',
};

/* ── Data types ─────────────────────────────────────────────────────────── */

interface TopTemplate {
  id: string;
  name: string;
  installs: number;
  views: number;
}

interface RecentSearch {
  query: string;
  resultCount: number;
  ts: number;
}

interface TrendData {
  date: string;
  installs: number;
}

interface AnalyticsData {
  totalTemplates: number;
  totalInstalls: number;
  last30dInstalls: number;
  last30dViews: number;
  topTemplates: TopTemplate[];
  recentSearches: RecentSearch[];
  installTrends: TrendData[];
}

/* ── Data fetcher ───────────────────────────────────────────────────────── */

async function fetchAnalytics(): Promise<AnalyticsData> {
  const { db } = await connectToDatabase();
  const eventsCol = db.collection(MARKETPLACE_EVENTS_COLLECTION);
  const templatesCol = db.collection(SABFLOW_MARKETPLACE_TEMPLATES_COLLECTION);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const [
    totalTemplates,
    totalInstalls,
    last30dInstalls,
    last30dViews,
    topInstallsRaw,
    recentSearchesRaw,
    installTrendsRaw,
  ] = await Promise.all([
    templatesCol.countDocuments({ status: 'published' }),
    eventsCol.countDocuments({ type: 'install' }),
    eventsCol.countDocuments({ type: 'install', ts: { $gte: thirtyDaysAgo } }),
    eventsCol.countDocuments({ type: 'view', ts: { $gte: thirtyDaysAgo } }),

    // Top 10 templates by install event count
    eventsCol
      .aggregate<{ _id: string; installs: number; views: number }>([
        {
          $match: {
            type: { $in: ['install', 'view'] },
            templateId: { $exists: true },
          },
        },
        {
          $group: {
            _id: '$templateId',
            installs: {
              $sum: { $cond: [{ $eq: ['$type', 'install'] }, 1, 0] },
            },
            views: {
              $sum: { $cond: [{ $eq: ['$type', 'view'] }, 1, 0] },
            },
          },
        },
        { $sort: { installs: -1 } },
        { $limit: 10 },
      ])
      .toArray(),

    // Last 20 search events, newest first
    eventsCol
      .find(
        { type: 'search' },
        { projection: { query: 1, resultCount: 1, ts: 1 } },
      )
      .sort({ ts: -1 })
      .limit(20)
      .toArray(),

    // Daily install trends (last 30 days)
    eventsCol
      .aggregate<{ _id: string; count: number }>([
        {
          $match: {
            type: 'install',
            ts: { $gte: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: { $toDate: '$ts' },
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
  ]);

  // Enrich top templates with human-readable names
  let topTemplates: TopTemplate[] = [];
  if (topInstallsRaw.length > 0) {
    const { ObjectId } = await import('mongodb');
    const ids = topInstallsRaw
      .map((r) => {
        try {
          return new ObjectId(r._id);
        } catch {
          return null;
        }
      })
      .filter((id): id is InstanceType<typeof ObjectId> => id !== null);

    const nameDocs =
      ids.length > 0
        ? await templatesCol
            .find(
              { _id: { $in: ids } },
              { projection: { _id: 1, name: 1 } },
            )
            .toArray()
        : [];

    const nameMap = new Map<string, string>(
      nameDocs.map((d) => [
        (d._id as { toHexString(): string }).toHexString(),
        (d as { name: string }).name,
      ]),
    );

    topTemplates = topInstallsRaw.map((r) => ({
      id: r._id,
      name: nameMap.get(r._id) ?? r._id,
      installs: r.installs,
      views: r.views,
    }));
  }

  const recentSearches: RecentSearch[] = recentSearchesRaw.map((d) => ({
    query: (d as { query?: string }).query ?? '',
    resultCount: (d as { resultCount?: number }).resultCount ?? 0,
    ts: (d as { ts?: number }).ts ?? 0,
  }));

  const installTrends: TrendData[] = (installTrendsRaw as any[]).map((d: any) => ({
    date: d._id,
    installs: d.count,
  }));

  // Ensure 30 days of data
  const trendsMap = new Map(installTrends.map((t) => [t.date, t.installs]));
  const fullTrends: TrendData[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = d.toISOString().split('T')[0];
    fullTrends.push({
      date: dateStr,
      installs: trendsMap.get(dateStr) ?? 0,
    });
  }

  return {
    totalTemplates,
    totalInstalls,
    last30dInstalls,
    last30dViews,
    topTemplates,
    recentSearches,
    installTrends: fullTrends,
  };
}

/* ── KPI card ───────────────────────────────────────────────────────────── */

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <Card className="border-[var(--st-border)] bg-[var(--st-text)] shadow-none">
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[var(--st-text-secondary)]">
          <Icon className="h-3.5 w-3.5 text-[var(--st-text-secondary)]/80" />
          {label}
        </div>
        <div className="text-3xl font-semibold text-white tabular-nums">
          {value.toLocaleString()}
        </div>
        {sub && <div className="text-xs text-[var(--st-text)]">{sub}</div>}
      </CardContent>
    </Card>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default async function MarketplaceAnalyticsPage() {
  const session = await getAdminSession();
  if (!session.isAdmin) {
    redirect('/admin-login');
  }

  let data: AnalyticsData;
  let fetchError: string | null = null;

  try {
    data = await fetchAnalytics();
  } catch (err) {
    fetchError = (err as Error)?.message ?? 'Unknown error';
    data = {
      totalTemplates: 0,
      totalInstalls: 0,
      last30dInstalls: 0,
      last30dViews: 0,
      topTemplates: [],
      recentSearches: [],
    };
  }

  return (
    <div className="min-h-screen bg-[var(--st-text)] text-white">
      <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8 lg:p-10">

        {/* Header */}
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--st-text-secondary)]/80">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin · SabFlow · Phase C.10.10
          </div>
          <h1 className="text-3xl font-semibold text-white">
            Marketplace Analytics
          </h1>
          <p className="max-w-3xl text-sm text-[var(--st-text-secondary)]">
            Telemetry from{' '}
            <code className="text-[var(--st-text-secondary)]">sabflow_marketplace_events</code> —
            views, installs, and search queries recorded by the marketplace
            telemetry layer. Data is near-real-time (events are written
            fire-and-forget during user sessions).
          </p>
        </header>

        {/* Data-fetch error banner */}
        {fetchError && (
          <div className="rounded-xl border border-[var(--st-border)]/30 bg-[var(--st-text)]/10 p-4 text-xs text-white">
            <span className="font-semibold text-[var(--st-text-secondary)]">Data fetch error: </span>
            {fetchError}
          </div>
        )}

        {/* KPI row */}
        <section>
          <h2 className="mb-4 text-xs uppercase tracking-[0.16em] text-[var(--st-text)]">
            Overview
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={Store}
              label="Published templates"
              value={data.totalTemplates}
            />
            <KpiCard
              icon={Download}
              label="All-time installs"
              value={data.totalInstalls}
            />
            <KpiCard
              icon={Download}
              label="Installs (last 30 d)"
              value={data.last30dInstalls}
              sub="from sabflow_marketplace_events"
            />
            <KpiCard
              icon={Eye}
              label="Views (last 30 d)"
              value={data.last30dViews}
              sub="from sabflow_marketplace_events"
            />
          </div>
        </section>

        {/* Top 10 templates table */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-[var(--st-text-secondary)]/80" />
            <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--st-text)]">
              Top 10 Templates by Installs
            </h2>
          </div>
          <Card className="overflow-hidden border-[var(--st-border)] bg-[var(--st-text)] shadow-none">
            <TopTemplatesChart data={data.topTemplates} />
          </Card>
        </section>

        {/* Install Trends */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-[var(--st-text-secondary)]/80" />
            <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--st-text)]">
              Install Trends (Last 30 Days)
            </h2>
          </div>
          <Card className="overflow-hidden border-[var(--st-border)] bg-[var(--st-text)] shadow-none">
            <InstallTrendsChart data={data.installTrends} />
          </Card>
        </section>

        {/* Recent search queries table */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-[var(--st-text-secondary)]/80" />
            <h2 className="text-xs uppercase tracking-[0.16em] text-[var(--st-text)]">
              Recent Search Queries (last 20)
            </h2>
          </div>
          <Card className="overflow-hidden border-[var(--st-border)] bg-[var(--st-text)] shadow-none">
            {data.recentSearches.length === 0 ? (
              <div className="py-16 text-center text-sm text-[var(--st-text)]">
                No search events recorded yet.
              </div>
            ) : (
              <Table className="w-full text-sm">
                <THead>
                  <Tr className="border-b border-[var(--st-border)] hover:bg-transparent">
                    {['Query', 'Results', 'Time'].map((h, i) => (
                      <Th
                        key={i}
                        className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--st-text)]"
                      >
                        {h}
                      </Th>
                    ))}
                  </Tr>
                </THead>
                <TBody className="divide-y divide-[var(--st-border)]">
                  {data.recentSearches.map((s, i) => (
                    <Tr
                      key={i}
                      className="border-[var(--st-border)] transition-colors hover:bg-[var(--st-text)]/50"
                    >
                      <Td className="px-5 py-3 text-white">
                        {s.query || (
                          <span className="italic text-[var(--st-text)]">(empty)</span>
                        )}
                      </Td>
                      <Td className="px-5 py-3 tabular-nums text-[var(--st-text-secondary)]">
                        {s.resultCount}
                      </Td>
                      <Td className="px-5 py-3 text-xs text-[var(--st-text)] tabular-nums">
                        {s.ts
                          ? new Date(s.ts).toLocaleString('en-GB', {
                              dateStyle: 'short',
                              timeStyle: 'medium',
                            })
                          : '—'}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </section>

      </div>
    </div>
  );
}
