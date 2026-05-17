/**
 * Request log explorer.
 *
 * Query params drive filtering — pure server-rendered so the URL stays
 * shareable. A small client component would be nice for incremental
 * cursor pagination later; for now the page links to "next page" via
 * a regular anchor that adds the cursor to the query string.
 */

import Link from 'next/link';
import { getUsageLogs } from '@/app/actions/developer-platform.actions';

export const dynamic = 'force-dynamic';

interface SearchParams {
  keyId?: string;
  path?: string;
  minStatus?: string;
  cursor?: string;
  limit?: string;
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<JSX.Element> {
  const params = await searchParams;
  const limit = params.limit ? Math.min(Math.max(Number(params.limit) || 50, 1), 200) : 50;
  const minStatus = params.minStatus ? Number(params.minStatus) : undefined;

  const res = await getUsageLogs({
    keyId: params.keyId,
    path: params.path,
    minStatus: Number.isFinite(minStatus) ? minStatus : undefined,
    cursor: params.cursor,
    limit,
  });

  const nextUrl = res.success && res.nextCursor
    ? '/dashboard/api/logs?' +
      new URLSearchParams({
        ...(params.keyId ? { keyId: params.keyId } : {}),
        ...(params.path ? { path: params.path } : {}),
        ...(params.minStatus ? { minStatus: params.minStatus } : {}),
        cursor: res.nextCursor,
        limit: String(limit),
      }).toString()
    : null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <header className="mb-6">
        <a href="/dashboard/api" className="text-xs text-amber-300 hover:text-amber-200">
          ← Developer platform
        </a>
        <h1 className="text-3xl font-bold mt-2">Request log</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Last 30 days. Filter via query string: <code>?keyId=…</code>, <code>?path=…</code>,
          <code> ?minStatus=400</code>.
        </p>
      </header>

      <form method="get" className="mb-4 grid grid-cols-1 sm:grid-cols-4 gap-2">
        <input
          name="path"
          defaultValue={params.path ?? ''}
          placeholder="path (e.g. /api/v1/me)"
          className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono"
        />
        <input
          name="keyId"
          defaultValue={params.keyId ?? ''}
          placeholder="key id"
          className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm font-mono"
        />
        <input
          name="minStatus"
          type="number"
          defaultValue={params.minStatus ?? ''}
          placeholder="min status (e.g. 400)"
          className="bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold rounded px-4 py-2 text-sm"
        >
          Filter
        </button>
      </form>

      {!res.success ? (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {res.error}
        </div>
      ) : (
        <>
          <div className="rounded-md border border-zinc-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-zinc-900/50 text-zinc-400">
                <tr>
                  <th className="text-left px-3 py-2">When</th>
                  <th className="text-left px-3 py-2">Method</th>
                  <th className="text-left px-3 py-2">Path</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-left px-3 py-2">Latency</th>
                  <th className="text-left px-3 py-2">Key</th>
                  <th className="text-left px-3 py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {res.rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-zinc-500">
                      No requests match the current filter.
                    </td>
                  </tr>
                ) : null}
                {res.rows.map((r) => (
                  <tr key={r._id} className="border-t border-zinc-800">
                    <td className="px-3 py-2 text-zinc-400">{new Date(r.ts).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-zinc-300">{r.method}</td>
                    <td className="px-3 py-2 font-mono text-zinc-200">{r.path}</td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          r.status >= 500
                            ? 'text-red-400'
                            : r.status >= 400
                              ? 'text-amber-300'
                              : r.status >= 300
                                ? 'text-blue-300'
                                : 'text-green-400'
                        }
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-400">{r.latencyMs} ms</td>
                    <td className="px-3 py-2 font-mono text-zinc-500">{r.keyId.slice(0, 10)}…</td>
                    <td className="px-3 py-2 text-zinc-400">{r.errorType ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nextUrl ? (
            <div className="mt-4 flex justify-end">
              <Link
                href={nextUrl}
                className="text-xs text-amber-300 hover:text-amber-200"
              >
                Next page →
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
