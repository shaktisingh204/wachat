import { Card } from '@/components/sabcrm/20ui';
import type { WithId, ShortUrl } from '@/lib/definitions';
import { useMemo } from 'react';

export function UrlShortenerGeoAnalytics({ urls }: { urls: WithId<ShortUrl>[] }) {
  const topCountries = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const url of urls) {
      if (url.analytics) {
        for (const entry of url.analytics) {
          if (entry.geo && entry.geo.country) {
            counts[entry.geo.country] = (counts[entry.geo.country] || 0) + 1;
          }
        }
      }
    }
    const sorted = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    return sorted;
  }, [urls]);

  if (topCountries.length === 0) return null;

  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-[var(--st-text-secondary)] mb-2">
        Geographic Analytics (Top Countries)
      </div>
      <div className="space-y-2">
        {topCountries.map(([country, count]) => (
          <div key={country} className="flex items-center justify-between text-sm">
            <span className="text-[var(--st-text)]">{country}</span>
            <span className="font-mono text-[var(--st-text-secondary)]">{count.toLocaleString()} clicks</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
