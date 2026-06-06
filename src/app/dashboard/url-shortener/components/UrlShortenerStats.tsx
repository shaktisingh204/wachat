import { Card } from '@/components/sabcrm/20ui';
import type { WithId, ShortUrl } from '@/lib/definitions';
import { useMemo } from 'react';

function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)]">{label}</div>
      <div className="mt-1.5 text-[22px] text-[var(--st-text)] leading-tight">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-[var(--st-text-secondary)]">{hint}</div> : null}
    </Card>
  );
}

export function UrlShortenerStats({
  urls,
  getStatus,
}: {
  urls: WithId<ShortUrl>[];
  getStatus: (url: WithId<ShortUrl>) => 'active' | 'expired' | 'expiring-soon';
}) {
  const stats = useMemo(() => {
    const total = urls.length;
    const totalClicks = urls.reduce((sum, u) => sum + (u.clickCount || 0), 0);
    let active = 0;
    let expired = 0;
    let expiringSoon = 0;
    for (const u of urls) {
      const s = getStatus(u);
      if (s === 'active') active++;
      else if (s === 'expired') expired++;
      else expiringSoon++;
    }
    return { total, totalClicks, active, expired, expiringSoon };
  }, [urls, getStatus]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Total Links" value={stats.total} />
      <StatCard label="Total Clicks" value={stats.totalClicks.toLocaleString()} />
      <StatCard label="Active" value={stats.active} hint={`${stats.expiringSoon} expiring soon`} />
      <StatCard label="Expired" value={stats.expired} />
    </div>
  );
}
