'use client';

/**
 * Wachat Link Tracking — view link click analytics.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback, useMemo } from 'react';
import { LuLink, LuMousePointerClick, LuRefreshCw } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { getLinkClicks } from '@/app/actions/wachat-features.actions';
import { ClayBreadcrumbs, ClayButton, ClayCard } from '@/components/clay';

export const dynamic = 'force-dynamic';

type GroupedLink = { url: string; count: number; lastClicked: string };

export default function LinkTrackingPage() {
  const { activeProject, activeProjectId } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [clicks, setClicks] = useState<any[]>([]);

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getLinkClicks(activeProjectId);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else setClicks(res.clicks ?? []);
    });
  }, [activeProjectId, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const grouped: GroupedLink[] = useMemo(() => {
    const map = new Map<string, { count: number; lastClicked: string }>();
    for (const c of clicks) {
      const url = c.url || c.link || '';
      const existing = map.get(url);
      const ts = c.clickedAt || c.createdAt || '';
      if (existing) {
        existing.count += 1;
        if (ts > existing.lastClicked) existing.lastClicked = ts;
      } else {
        map.set(url, { count: 1, lastClicked: ts });
      }
    }
    return Array.from(map.entries())
      .map(([url, data]) => ({ url, ...data }))
      .sort((a, b) => b.count - a.count);
  }, [clicks]);

  const totalClicks = clicks.length;
  const uniqueLinks = grouped.length;

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs
        items={[
          { label: 'Wachat', href: '/home' },
          { label: activeProject?.name || 'Project', href: '/dashboard' },
          { label: 'Link Tracking' },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">
            Link Tracking
          </h1>
          <p className="mt-1.5 max-w-[720px] text-[13px] text-clay-ink-muted">
            Track clicks on links sent through WhatsApp messages.
          </p>
        </div>
        <ClayButton size="sm" variant="ghost" onClick={fetchData} disabled={isPending}>
          <LuRefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isPending ? 'animate-spin' : ''}`} />
          Refresh
        </ClayButton>
      </div>

      {/* Stat cards */}
      <div className="flex gap-4">
        <ClayCard className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">Total Clicks</div>
          <div className="mt-1 text-[28px] font-semibold text-clay-ink tabular-nums">{totalClicks}</div>
        </ClayCard>
        <ClayCard className="p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">Unique Links</div>
          <div className="mt-1 text-[28px] font-semibold text-clay-ink tabular-nums">{uniqueLinks}</div>
        </ClayCard>
      </div>

      {grouped.length > 0 ? (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                <th className="px-5 py-3">URL</th>
                <th className="px-5 py-3">Clicks</th>
                <th className="px-5 py-3">Last Clicked</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <tr key={g.url} className="border-b border-clay-border last:border-0">
                  <td className="px-5 py-3 max-w-[400px]">
                    <a
                      href={g.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[13px] text-clay-accent hover:underline truncate"
                      title={g.url}
                    >
                      <LuLink className="h-3.5 w-3.5 shrink-0" />
                      {g.url.length > 60 ? `${g.url.slice(0, 60)}...` : g.url}
                    </a>
                  </td>
                  <td className="px-5 py-3 font-mono text-[13px] text-clay-ink tabular-nums">{g.count}</td>
                  <td className="px-5 py-3 text-[12px] text-clay-ink-muted whitespace-nowrap">
                    {g.lastClicked ? new Date(g.lastClicked).toLocaleString() : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
      ) : (
        !isPending && (
          <ClayCard className="p-12 text-center">
            <LuMousePointerClick className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
            <p className="text-sm text-clay-ink-muted">No link clicks recorded yet.</p>
          </ClayCard>
        )
      )}
    </div>
  );
}
