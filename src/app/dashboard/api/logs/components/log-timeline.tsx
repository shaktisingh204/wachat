'use client';

import { Badge } from '@/components/zoruui';
import { useEffect, useState } from 'react';

// Hydration-safe date component
function ClientDate({ ts, className }: { ts: number | string; className?: string }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className={className}>Loading date...</span>;
  }

  return (
    <span className={className}>
      {new Date(ts).toLocaleString()}
    </span>
  );
}

interface LogRow {
  _id: string;
  method: string;
  path: string;
  status: number;
  ts: number | string;
  latencyMs: number;
  keyId: string;
  errorType?: string;
}

export function LogTimeline({ logs }: { logs: LogRow[] }) {
  if (logs.length === 0) {
    return (
      <div className="text-center text-zoru-ink-muted py-8 text-sm">
        No requests match the current filter.
      </div>
    );
  }

  return (
    <ol className="relative space-y-6 border-l border-zinc-200 pl-6 dark:border-zinc-800">
      {logs.map((r) => (
        <li key={r._id} className="relative">
          <span
            className="absolute -left-[29px] top-1.5 inline-block size-3 rounded-full border border-white dark:border-zinc-950 bg-zinc-300 dark:bg-zinc-700"
            aria-hidden
          />
          <div className="flex flex-wrap items-baseline gap-2 text-sm mb-1">
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              {r.method}
            </Badge>
            <span className="font-mono text-zoru-ink">{r.path}</span>
            <span
              className={
                r.status >= 500
                  ? 'text-zoru-danger text-xs font-semibold px-1.5 py-0.5 rounded bg-red-500/10'
                  : r.status >= 400
                  ? 'text-zoru-warning text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-500/10'
                  : r.status >= 300
                  ? 'text-blue-500 text-xs font-semibold px-1.5 py-0.5 rounded bg-blue-500/10'
                  : 'text-zoru-success text-xs font-semibold px-1.5 py-0.5 rounded bg-green-500/10'
              }
            >
              {r.status}
            </span>
            <ClientDate ts={r.ts} className="ml-auto text-xs text-zoru-ink-muted" />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-zoru-ink-muted">
            <span>
              Latency: <span className="font-mono">{r.latencyMs} ms</span>
            </span>
            <span>
              Key ID: <span className="font-mono text-zoru-ink-subtle">{r.keyId.slice(0, 10)}…</span>
            </span>
            {r.errorType && (
              <span className="text-zoru-danger">Error: {r.errorType}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
