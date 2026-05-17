/**
 * Usage analytics page — last 24h by default.
 *
 * Pulls summary + top + per-key in parallel from the Rust
 * `developer-api-usage` crate. Pure server-rendered; no client JS.
 */

import {
  getUsageSummary,
  getUsageTop,
  getUsageByKey,
} from '@/app/actions/developer-platform.actions';

export const dynamic = 'force-dynamic';

function pct(n: number, d: number): string {
  if (!d) return '0%';
  return `${((n / d) * 100).toFixed(1)}%`;
}

export default async function UsagePage(): Promise<JSX.Element> {
  const [summaryRes, topRes, keysRes] = await Promise.all([
    getUsageSummary(),
    getUsageTop({ limit: 15 }),
    getUsageByKey(),
  ]);

  const errors = [
    !summaryRes.success ? summaryRes.error : null,
    !topRes.success ? topRes.error : null,
    !keysRes.success ? keysRes.error : null,
  ].filter(Boolean);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <header className="mb-6">
        <a href="/dashboard/api" className="text-xs text-amber-300 hover:text-amber-200">
          ← Developer platform
        </a>
        <h1 className="text-3xl font-bold mt-2">Usage analytics</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Aggregated over the last 24 hours. Raw entries live in <a href="/dashboard/api/logs" className="text-amber-300 hover:text-amber-200">/dashboard/api/logs</a>.
        </p>
      </header>

      {errors.length ? (
        <div className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {errors.join(' · ')}
        </div>
      ) : null}

      {summaryRes.success ? (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total requests" value={summaryRes.totalRequests.toLocaleString()} />
          <StatCard
            label="Errors"
            value={`${summaryRes.errorRequests.toLocaleString()} (${pct(summaryRes.errorRequests, summaryRes.totalRequests)})`}
            tone={summaryRes.errorRequests > 0 ? 'warn' : 'ok'}
          />
          <StatCard label="Avg latency" value={`${Math.round(summaryRes.avgLatencyMs)} ms`} />
          <StatCard label="p95 latency" value={`${Math.round(summaryRes.p95LatencyMs)} ms`} />
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Top endpoints</h2>
        <div className="rounded-md border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/50 text-zinc-400 text-xs">
              <tr>
                <th className="text-left px-3 py-2">Endpoint</th>
                <th className="text-left px-3 py-2">Requests</th>
                <th className="text-left px-3 py-2">Errors</th>
                <th className="text-left px-3 py-2">Avg latency</th>
              </tr>
            </thead>
            <tbody>
              {topRes.success && topRes.rows.length > 0 ? (
                topRes.rows.map((r, i) => (
                  <tr key={i} className="border-t border-zinc-800">
                    <td className="px-3 py-2 font-mono text-zinc-200">
                      {r.method} {r.path}
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{r.count.toLocaleString()}</td>
                    <td className="px-3 py-2 text-zinc-400">
                      {r.errorCount} ({pct(r.errorCount, r.count)})
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{Math.round(r.avgLatencyMs)} ms</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-zinc-500 text-sm">
                    No data yet for the selected window.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">By key</h2>
        <div className="rounded-md border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/50 text-zinc-400 text-xs">
              <tr>
                <th className="text-left px-3 py-2">Key id</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Env</th>
                <th className="text-left px-3 py-2">Requests</th>
                <th className="text-left px-3 py-2">Errors</th>
                <th className="text-left px-3 py-2">Last used</th>
              </tr>
            </thead>
            <tbody>
              {keysRes.success && keysRes.rows.length > 0 ? (
                keysRes.rows.map((r) => (
                  <tr key={r.keyId} className="border-t border-zinc-800">
                    <td className="px-3 py-2 font-mono text-zinc-200 text-xs">{r.keyId}</td>
                    <td className="px-3 py-2 text-zinc-400 text-xs">{r.kind}</td>
                    <td className="px-3 py-2 text-zinc-400 text-xs">{r.env}</td>
                    <td className="px-3 py-2 text-zinc-300">{r.count.toLocaleString()}</td>
                    <td className="px-3 py-2 text-zinc-400">{r.errorCount}</td>
                    <td className="px-3 py-2 text-zinc-400 text-xs">
                      {r.lastUsedAt ? new Date(r.lastUsedAt).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-zinc-500 text-sm">
                    No data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'ok' | 'warn';
}): JSX.Element {
  const cls =
    tone === 'warn'
      ? 'border-amber-500/40'
      : 'border-zinc-800';
  return (
    <div className={`rounded-md border ${cls} bg-zinc-900/30 p-4`}>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-2xl font-bold mt-1 text-zinc-100">{value}</div>
    </div>
  );
}
