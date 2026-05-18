'use client';

import { ZoruButton, ZoruInput, ZoruCard, ZoruCardContent, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

function deterministicRank(seed: string): number {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  return ((Math.abs(h) % 100) + 1);
}

export default function KeywordRankCheckerPage() {
  const [keyword, setKeyword] = useState('');
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState<{ rank: number; keyword: string; domain: string } | null>(null);

  const run = () => {
    if (!keyword || !domain) return;
    setResult({ rank: deterministicRank(keyword + domain), keyword, domain });
  };

  return (
    <ToolShell title="Keyword Rank Checker" description="Check keyword ranking for a domain. (Requires SERP API for production data.)">
      <ZoruCard className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
        <ZoruCardContent className="p-3 text-xs">
          Production rank data requires a SERP API provider (e.g. DataForSEO). The number below is a deterministic placeholder.
        </ZoruCardContent>
      </ZoruCard>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <ZoruInput value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Keyword" />
        <ZoruInput value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
      </div>
      <ZoruButton onClick={run}>Check rank</ZoruButton>
      {result && (
        <ZoruCard><ZoruCardContent className="p-6 text-center">
          <div className="text-5xl font-bold">#{result.rank}</div>
          <div className="text-sm text-muted-foreground mt-2">{result.keyword} → {result.domain}</div>
        </ZoruCardContent></ZoruCard>
      )}
    </ToolShell>
  );
}
