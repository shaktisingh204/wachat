import { StatCard } from '@/components/sabcrm/20ui';
import type { WithId, ShortUrl } from '@/lib/definitions';
import { Link2, MousePointerClick, CheckCircle2, CircleSlash } from 'lucide-react';
import { useMemo } from 'react';

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

  const ctr = stats.total > 0 ? stats.totalClicks / stats.total : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        label="Total links"
        value={<span className="tabular-nums">{stats.total.toLocaleString()}</span>}
        icon={Link2}
        accent="#3b7af5"
        delta={
          stats.total > 0
            ? { value: `${ctr.toFixed(1)} avg clicks/link`, tone: 'neutral' }
            : undefined
        }
      />
      <StatCard
        label="Total clicks"
        value={<span className="tabular-nums">{stats.totalClicks.toLocaleString()}</span>}
        icon={MousePointerClick}
        accent="#7c3aed"
      />
      <StatCard
        label="Active"
        value={<span className="tabular-nums">{stats.active.toLocaleString()}</span>}
        icon={CheckCircle2}
        accent="#1f9d55"
        delta={
          stats.expiringSoon > 0
            ? { value: `${stats.expiringSoon} expiring soon`, tone: 'down' }
            : undefined
        }
      />
      <StatCard
        label="Expired"
        value={<span className="tabular-nums">{stats.expired.toLocaleString()}</span>}
        icon={CircleSlash}
        accent="#e0484e"
      />
    </div>
  );
}
