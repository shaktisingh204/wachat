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

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Total Links" value={stats.total} icon={Link2} />
      <StatCard
        label="Total Clicks"
        value={stats.totalClicks.toLocaleString()}
        icon={MousePointerClick}
      />
      <StatCard
        label="Active"
        value={stats.active}
        icon={CheckCircle2}
        delta={
          stats.expiringSoon > 0
            ? { value: `${stats.expiringSoon} expiring soon`, tone: 'neutral' }
            : undefined
        }
      />
      <StatCard label="Expired" value={stats.expired} icon={CircleSlash} />
    </div>
  );
}
