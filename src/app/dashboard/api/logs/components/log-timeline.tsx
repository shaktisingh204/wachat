'use client';

import { Badge, EmptyState, type BadgeTone } from '@/components/sabcrm/20ui';
import { Inbox } from 'lucide-react';
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

  return <span className={className}>{new Date(ts).toLocaleString()}</span>;
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

function statusTone(status: number): BadgeTone {
  if (status >= 500) return 'danger';
  if (status >= 400) return 'warning';
  if (status >= 300) return 'info';
  return 'success';
}

export function LogTimeline({ logs }: { logs: LogRow[] }) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No requests"
        description="No requests match the current filter."
        size="sm"
      />
    );
  }

  return (
    <ol className="relative space-y-6 border-l border-[var(--st-border)] pl-6">
      {logs.map((r) => (
        <li key={r._id} className="relative">
          <span
            className="absolute -left-[29px] top-1.5 inline-block size-3 rounded-full border border-[var(--st-bg)] bg-[var(--st-text-secondary)]"
            aria-hidden="true"
          />
          <div className="mb-1 flex flex-wrap items-baseline gap-2 text-sm">
            <Badge kind="outline" className="font-mono text-[10px] uppercase">
              {r.method}
            </Badge>
            <span className="font-mono text-[var(--st-text)]">{r.path}</span>
            <Badge tone={statusTone(r.status)} className="font-mono">
              {r.status}
            </Badge>
            <ClientDate ts={r.ts} className="ml-auto text-xs text-[var(--st-text-secondary)]" />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--st-text-secondary)]">
            <span>
              Latency: <span className="font-mono">{r.latencyMs} ms</span>
            </span>
            <span>
              Key ID:{' '}
              <span className="font-mono text-[var(--st-text-tertiary)]">{r.keyId.slice(0, 10)}…</span>
            </span>
            {r.errorType && <span className="text-[var(--st-danger)]">Error: {r.errorType}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
