'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

export default function BacklinkCheckerPage() {
  const [domain, setDomain] = useState('');
  const [rows, setRows] = useState<{ source: string; anchor: string; dr: number }[] | null>(null);

  const run = () => {
    if (!domain) return;
    const base = hash(domain);
    const sources = ['blog.example.com', 'news.example.org', 'tech.example.io', 'forum.example.net', 'medium.com'];
    const anchors = ['Read more', 'Learn here', 'Great resource', 'Check this', 'Visit site'];
    const out = sources.map((s, i) => ({
      source: `${s}/${domain.replace(/[^a-z0-9]/gi, '')}-post`,
      anchor: anchors[(base + i) % anchors.length],
      dr: ((base + i * 7) % 70) + 20,
    }));
    setRows(out);
  };

  return (
    <ToolShell title="Backlink Checker" description="Placeholder backlink metrics preview.">
      <div className="flex gap-2">
        <Input
          placeholder="example.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
        />
        <Button onClick={run} disabled={!domain}>
          Check
        </Button>
      </div>

      {rows && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-xs text-muted-foreground border-l-2 border-amber-500 pl-3">
              Backlinks data requires third-party API integration (Ahrefs/Majestic). Currently showing
              placeholder metrics.
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-[2fr_1.5fr_80px] gap-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <div>Source</div>
                <div>Anchor</div>
                <div className="text-right">DR</div>
              </div>
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[2fr_1.5fr_80px] gap-3 text-sm items-center border-b pb-2">
                  <div className="font-mono text-xs break-all">{r.source}</div>
                  <div>{r.anchor}</div>
                  <div className="text-right">
                    <Badge variant="secondary">{r.dr}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
