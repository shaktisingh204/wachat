'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
        <CardContent className="p-3 text-xs">
          Production rank data requires a SERP API provider (e.g. DataForSEO). The number below is a deterministic placeholder.
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Keyword" />
        <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
      </div>
      <Button onClick={run}>Check rank</Button>
      {result && (
        <Card><CardContent className="p-6 text-center">
          <div className="text-5xl font-bold">#{result.rank}</div>
          <div className="text-sm text-muted-foreground mt-2">{result.keyword} → {result.domain}</div>
        </CardContent></Card>
      )}
    </ToolShell>
  );
}
