'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';

function hash(s: string): number {
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export default function DomainAuthorityPage() {
  const [domain, setDomain] = useState('');
  const [result, setResult] = useState<{ da: number; pa: number; backlinks: number } | null>(null);

  const run = () => {
    if (!domain) return;
    const h = hash(domain);
    setResult({ da: h % 70 + 20, pa: h % 60 + 20, backlinks: (h % 50000) + 100 });
  };

  return (
    <ToolShell title="Domain Authority Checker" description="Estimate DA/PA metrics (placeholder; production needs Moz/Ahrefs API).">
      <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
        <CardContent className="p-3 text-xs">Production DA/PA requires Moz or Ahrefs API credentials. The values shown are deterministic placeholders.</CardContent>
      </Card>
      <div className="flex gap-2">
        <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
        <Button onClick={run}>Check</Button>
      </div>
      {result && (
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><div className="text-3xl font-bold">{result.da}</div><div className="text-xs text-muted-foreground">Domain Authority</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-3xl font-bold">{result.pa}</div><div className="text-xs text-muted-foreground">Page Authority</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-3xl font-bold">{result.backlinks.toLocaleString()}</div><div className="text-xs text-muted-foreground">Est. backlinks</div></CardContent></Card>
        </div>
      )}
    </ToolShell>
  );
}
