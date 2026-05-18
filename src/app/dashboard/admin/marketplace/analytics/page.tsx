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

import { getAdminSession } from '@/lib/admin-session';
import { connectToDatabase } from '@/lib/mongodb';
import {
  MARKETPLACE_EVENTS_COLLECTION,
} from '@/lib/sabflow/marketplace/telemetry';
import { SABFLOW_MARKETPLACE_TEMPLATES_COLLECTION } from '@/lib/sabflow/marketplace/templates';

export const dynamic = 'force-dynamic';

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

interface AnalyticsData {
  totalTemplates: number;
  totalInstalls: number;
  last30dInstalls: number;
  last30dViews: number;
  topTemplates: TopTemplate[];
  recentSearches: RecentSearch[];
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

  return {
    totalTemplates,
    totalInstalls,
    last30dInstalls,
    last30dViews,
    topTemplates,
    recentSearches,
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-zinc-400">
        <Icon className="h-3.5 w-3.5 text-amber-400/80" />
        {label}
      </div>
      <div className="text-3xl font-semibold text-amber-200 tabular-nums">
        {value.toLocaleString()}
      </div>
      {sub && <div className="text-xs text-zinc-500">{sub}</div>}
    </div>
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8 lg:p-10">

        {/* Header */}
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-amber-400/80">
            <ShieldCheck className="h-3.5 w-3.5" />
            Admin · SabFlow · Phase C.10.10
          </div>
          <h1 className="text-3xl font-semibold text-amber-200">
            Marketplace Analytics
          </h1>
          <p className="max-w-3xl text-sm text-zinc-400">
            Telemetry from{' '}
            <code className="text-amber-300">sabflow_marketplace_events</code> —
            views, installs, and search queries recorded by the marketplace
            telemetry layer. Data is near-real-time (events are written
            fire-and-forget during user sessions).
          </p>
        </header>

        {/* Data-fetch error banner */}
        {fetchError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200">
            <span className="font-semibold text-red-300">Data fetch error: </span>
            {fetchError}
          </div>
        )}

        {/* KPI row */}
        <section>
          <h2 className="mb-4 text-xs uppercase tracking-[0.16em] text-zinc-500">
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
            <BarChart3 className="h-4 w-4 text-amber-400/80" />
            <h2 className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Top 10 Templates by Installs
            </h2>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            {data.topTemplates.length === 0 ? (
              <div className="py-16 text-center text-sm text-zinc-500">
                No install events recorded yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['#', 'Template', 'Installs', 'Views', 'Install rate'].map(
                      (h, i) => (
                        <th
                          key={i}
                          className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.topTemplates.map((t, i) => {
                    const total = t.installs + t.views;
                    const rate =
                      total > 0
                        ? ((t.installs / total) * 100).toFixed(1)
                        : '0.0';
                    return (
                      <tr
                        key={t.id}
                        className="transition-colors hover:bg-zinc-800/50"
                      >
                        <td className="px-5 py-3 tabular-nums text-zinc-500">
                          {i + 1}
                        </td>
                        <td className="px-5 py-3 font-medium text-amber-100">
                          <div className="truncate max-w-xs">{t.name}</div>
                          <div className="font-mono text-[10px] text-zinc-500">
                            {t.id}
                          </div>
                        </td>
                        <td className="px-5 py-3 tabular-nums text-amber-300">
                          {t.installs.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 tabular-nums text-zinc-400">
                          {t.views.toLocaleString()}
                        </td>
                        <td className="px-5 py-3 tabular-nums text-zinc-400">
                          {rate}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Recent search queries table */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-amber-400/80" />
            <h2 className="text-xs uppercase tracking-[0.16em] text-zinc-500">
              Recent Search Queries (last 20)
            </h2>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            {data.recentSearches.length === 0 ? (
              <div className="py-16 text-center text-sm text-zinc-500">
                No search events recorded yet.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['Query', 'Results', 'Time'].map((h, i) => (
                      <th
                        key={i}
                        className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {data.recentSearches.map((s, i) => (
                    <tr
                      key={i}
                      className="transition-colors hover:bg-zinc-800/50"
                    >
                      <td className="px-5 py-3 text-amber-100">
                        {s.query || (
                          <span className="italic text-zinc-500">(empty)</span>
                        )}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-zinc-400">
                        {s.resultCount}
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-500 tabular-nums">
                        {s.ts
                          ? new Date(s.ts).toLocaleString('en-GB', {
                              dateStyle: 'short',
                              timeStyle: 'medium',
                            })
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
