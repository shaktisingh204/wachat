'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useState } from 'react';
import { ZoruInput } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';

function hash(s: string): number { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }

export default function PageSpeedPage() {
  const [url, setUrl] = useState('');
  const [data, setData] = useState<any>(null);

  const run = () => {
    if (!url) return;
    const h = hash(url);
    setData({
      performance: 60 + (h % 40),
      lcp: (1.5 + ((h % 300) / 100)).toFixed(1),
      fid: (h % 100),
      cls: ((h % 25) / 100).toFixed(2),
      ttfb: (200 + (h % 600)),
    });
  };

  return (
    <ToolShell title="Page Speed Insights" description="Core Web Vitals placeholder (plug in Google PSI API for real data).">
      <ZoruCard className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
        <ZoruCardContent className="p-3 text-xs">Production speed data requires the Google PageSpeed Insights API key. Values shown are deterministic placeholders.</ZoruCardContent>
      </ZoruCard>
      <div className="flex gap-2">
        <ZoruInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        <ZoruButton onClick={run}>Measure</ZoruButton>
      </div>
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <ZoruCard><ZoruCardContent className="p-4"><div className="text-3xl font-bold">{data.performance}</div><div className="text-xs text-muted-foreground">Performance</div></ZoruCardContent></ZoruCard>
          <ZoruCard><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{data.lcp}s</div><div className="text-xs text-muted-foreground">LCP</div></ZoruCardContent></ZoruCard>
          <ZoruCard><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{data.fid}ms</div><div className="text-xs text-muted-foreground">FID</div></ZoruCardContent></ZoruCard>
          <ZoruCard><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{data.cls}</div><div className="text-xs text-muted-foreground">CLS</div></ZoruCardContent></ZoruCard>
          <ZoruCard><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{data.ttfb}ms</div><div className="text-xs text-muted-foreground">TTFB</div></ZoruCardContent></ZoruCard>
        </div>
      )}
    </ToolShell>
  );
}
