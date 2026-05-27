'use client';

import { Card, Skeleton } from '@/components/zoruui';
import { Globe2 } from 'lucide-react';

interface GeoHeatmapProps {
  data: { country: string; count: number }[];
  isLoading?: boolean;
}

const FLAG_MAP: Record<string, string> = {
  AF: '🇦🇫', AL: '🇦🇱', DZ: '🇩🇿', AR: '🇦🇷', AU: '🇦🇺',
  AT: '🇦🇹', AZ: '🇦🇿', BD: '🇧🇩', BE: '🇧🇪', BR: '🇧🇷',
  BG: '🇧🇬', CA: '🇨🇦', CL: '🇨🇱', CN: '🇨🇳', CO: '🇨🇴',
  HR: '🇭🇷', CZ: '🇨🇿', DK: '🇩🇰', EG: '🇪🇬', ET: '🇪🇹',
  FI: '🇫🇮', FR: '🇫🇷', DE: '🇩🇪', GH: '🇬🇭', GR: '🇬🇷',
  HK: '🇭🇰', HU: '🇭🇺', IN: '🇮🇳', ID: '🇮🇩', IR: '🇮🇷',
  IQ: '🇮🇶', IE: '🇮🇪', IL: '🇮🇱', IT: '🇮🇹', JP: '🇯🇵',
  JO: '🇯🇴', KZ: '🇰🇿', KE: '🇰🇪', KR: '🇰🇷', KW: '🇰🇼',
  LB: '🇱🇧', LY: '🇱🇾', MY: '🇲🇾', MX: '🇲🇽', MA: '🇲🇦',
  NL: '🇳🇱', NZ: '🇳🇿', NG: '🇳🇬', NO: '🇳🇴', PK: '🇵🇰',
  PE: '🇵🇪', PH: '🇵🇭', PL: '🇵🇱', PT: '🇵🇹', QA: '🇶🇦',
  RO: '🇷🇴', RU: '🇷🇺', SA: '🇸🇦', SG: '🇸🇬', ZA: '🇿🇦',
  ES: '🇪🇸', SE: '🇸🇪', CH: '🇨🇭', TW: '🇹🇼', TH: '🇹🇭',
  TN: '🇹🇳', TR: '🇹🇷', UA: '🇺🇦', AE: '🇦🇪', GB: '🇬🇧',
  US: '🇺🇸', UZ: '🇺🇿', VN: '🇻🇳', YE: '🇾🇪', ZW: '🇿🇼',
};

function getFlag(code: string): string {
  return FLAG_MAP[code.toUpperCase()] ?? '🌐';
}

export function GeoHeatmap({ data, isLoading }: GeoHeatmapProps) {
  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-7 w-full rounded" />
          ))}
        </div>
      </Card>
    );
  }

  const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 20);
  const max = sorted[0]?.count ?? 1;
  const total = sorted.reduce((sum, r) => sum + r.count, 0);

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Globe2 className="h-4 w-4 text-zoru-ink-muted" />
        <span className="text-[13px] text-zoru-ink">Top Countries</span>
      </div>

      {sorted.length === 0 ? (
        <div className="py-10 text-center text-[13px] text-zoru-ink-muted">No geo data yet</div>
      ) : (
        <div className="space-y-2">
          {sorted.map((row) => {
            const pct = total > 0 ? ((row.count / total) * 100).toFixed(1) : '0.0';
            const barWidth = max > 0 ? (row.count / max) * 100 : 0;
            return (
              <div key={row.country} className="flex items-center gap-3 text-[12.5px]">
                <span className="w-7 text-center text-base leading-none shrink-0">
                  {getFlag(row.country)}
                </span>
                <span className="w-8 shrink-0 text-zoru-ink-muted font-mono uppercase">
                  {row.country}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="h-1.5 w-full rounded-full bg-zoru-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-zoru-ink transition-all"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
                <span className="w-10 text-right tabular-nums text-zoru-ink shrink-0">
                  {row.count.toLocaleString()}
                </span>
                <span className="w-10 text-right tabular-nums text-zoru-ink-muted shrink-0">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
