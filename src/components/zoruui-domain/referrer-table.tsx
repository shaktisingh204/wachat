'use client';

import {
  Card,
  Skeleton,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  EmptyState,
} from '@/components/sabcrm/20ui';
import { ExternalLink, Inbox } from 'lucide-react';

interface ReferrerTableProps {
  data: { domain: string; count: number }[];
  total: number;
  isLoading?: boolean;
}

function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=16`;
}

function ShareBar({ pct }: { pct: number }) {
  return (
    <div className="h-1 w-full rounded-full bg-[var(--st-bg-muted)] overflow-hidden mt-0.5">
      <div
        className="h-full rounded-full bg-[var(--st-text)]/60"
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

export function ReferrerTable({ data, total, isLoading }: ReferrerTableProps) {
  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-28 mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded" />
          ))}
        </div>
      </Card>
    );
  }

  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 20);

  const directCount = sorted
    .filter((r) => !r.domain || r.domain === 'direct' || r.domain === 'unknown')
    .reduce((sum, r) => sum + r.count, 0);

  const named = sorted.filter((r) => r.domain && r.domain !== 'direct' && r.domain !== 'unknown');

  const rows: { domain: string; count: number; isDirect?: boolean }[] = [
    ...named,
    ...(directCount > 0 ? [{ domain: 'Direct / Unknown', count: directCount, isDirect: true }] : []),
  ];

  const effectiveTotal = total > 0 ? total : rows.reduce((s, r) => s + r.count, 0);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <ExternalLink className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden="true" />
        <span className="text-[13px] text-[var(--st-text)]">Referrer Sources</span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          size="sm"
          icon={Inbox}
          title="No referrer data yet"
          description="Sources will appear here once your links start receiving traffic."
        />
      ) : (
        <div className="overflow-x-auto">
          <Table density="compact" hover={false} className="text-[12.5px]">
            <THead>
              <Tr>
                <Th className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)] font-normal">
                  Source
                </Th>
                <Th
                  align="right"
                  width={64}
                  className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)] font-normal"
                >
                  Clicks
                </Th>
                <Th
                  align="right"
                  width={64}
                  className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)] font-normal"
                >
                  Share
                </Th>
              </Tr>
            </THead>
            <TBody>
              {rows.map((row, i) => {
                const sharePct = effectiveTotal > 0 ? (row.count / effectiveTotal) * 100 : 0;
                return (
                  <Tr key={i}>
                    <Td>
                      <div className="flex items-center gap-2 min-w-0">
                        {row.isDirect ? (
                          <span className="h-4 w-4 shrink-0 rounded-full bg-[var(--st-bg-muted)] flex items-center justify-center text-[9px] text-[var(--st-text-secondary)]">
                            -
                          </span>
                        ) : (
                          <img
                            src={getFaviconUrl(row.domain)}
                            alt=""
                            width={16}
                            height={16}
                            className="h-4 w-4 shrink-0 rounded-sm"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )}
                        <span className="truncate text-[var(--st-text)]">{row.domain}</span>
                      </div>
                      <ShareBar pct={sharePct} />
                    </Td>
                    <Td align="right" className="tabular-nums text-[var(--st-text)]">
                      {row.count.toLocaleString()}
                    </Td>
                    <Td align="right" className="tabular-nums text-[var(--st-text-secondary)]">
                      {sharePct.toFixed(1)}%
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
