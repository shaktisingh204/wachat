'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { LuInbox, LuClock, LuExternalLink, LuLoader } from 'react-icons/lu';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { RecentSubmissionRow } from '@/lib/sabflow/types';

/* ── Helpers ─────────────────────────────────────────────── */

function timeAgo(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ── Types ───────────────────────────────────────────────── */

/** Wire shape coming from the API (dates are JSON-serialised strings). */
interface RecentSubmissionJSON {
  submissionId: string;
  flowId: string;
  flowName: string;
  completedAt: string;
}

/* ── Component ───────────────────────────────────────────── */

export function RecentActivityFeed() {
  const [rows, setRows] = useState<RecentSubmissionJSON[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch('/api/sabflow/recent-submissions');
        if (!res.ok) throw new Error('Failed to fetch');
        const data: RecentSubmissionJSON[] = await res.json();
        if (!cancelled) setRows(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        <LuInbox className="h-4 w-4 text-amber-500" strokeWidth={1.75} />
        <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-200 mr-auto">
          Recent Submissions
        </span>
        {!loading && !error && rows.length > 0 && (
          <span className="text-[11px] text-zinc-400 tabular-nums">{rows.length} shown</span>
        )}
      </div>

      {/* Body */}
      <div className="max-h-72 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-zinc-400">
            <LuLoader className="h-4 w-4 animate-spin" />
            <span className="text-[12px]">Loading…</span>
          </div>
        ) : error ? (
          <div className="py-8 text-center text-[12px] text-zinc-500 dark:text-zinc-400">
            Could not load recent submissions.
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-zinc-400">
            <LuInbox className="h-7 w-7 opacity-40" strokeWidth={1.25} />
            <span className="text-[12px]">No submissions yet.</span>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map((row) => (
              <li
                key={row.submissionId}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group"
              >
                {/* Flow name */}
                <span className="flex-1 truncate text-[12.5px] font-medium text-zinc-800 dark:text-zinc-200">
                  {row.flowName}
                </span>

                {/* Time ago */}
                <span className={cn(
                  'flex shrink-0 items-center gap-1 text-[11px] text-zinc-400 tabular-nums',
                )}>
                  <LuClock className="h-3 w-3" strokeWidth={1.75} />
                  {timeAgo(row.completedAt)}
                </span>

                {/* View link */}
                <Link
                  href={`/dashboard/sabflow/logs?flowId=${row.flowId}`}
                  className={cn(
                    'shrink-0 flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-colors',
                    'text-zinc-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30',
                    'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
                  )}
                >
                  View
                  <LuExternalLink className="h-2.5 w-2.5" strokeWidth={2} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
