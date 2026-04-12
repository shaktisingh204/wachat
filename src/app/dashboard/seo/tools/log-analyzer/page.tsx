'use client';

import { useMemo, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';

const LOG_RE = /^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) ([^"]+) HTTP\/\d\.\d" (\d+) \d+ "([^"]*)" "([^"]*)"/;

export default function LogAnalyzerPage() {
  const [text, setText] = useState('');
  const { total, bots, topIps, topPaths, topUAs } = useMemo(() => {
    const ipCounts = new Map<string, number>();
    const pathCounts = new Map<string, number>();
    const uaCounts = new Map<string, number>();
    let total = 0, bots = 0;
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(LOG_RE);
      if (!m) continue;
      total++;
      ipCounts.set(m[1], (ipCounts.get(m[1]) || 0) + 1);
      pathCounts.set(m[4], (pathCounts.get(m[4]) || 0) + 1);
      uaCounts.set(m[7], (uaCounts.get(m[7]) || 0) + 1);
      if (/googlebot|bingbot|yandex|baiduspider|duckduckbot|facebot/i.test(m[7])) bots++;
    }
    const sort = (m: Map<string, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 15);
    return { total, bots, topIps: sort(ipCounts), topPaths: sort(pathCounts), topUAs: sort(uaCounts) };
  }, [text]);

  return (
    <ToolShell title="Server Log Analyzer" description="Parse NCSA/Combined access logs and find top IPs, paths, and bots.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[180px] font-mono text-xs" placeholder="Paste access log lines…" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{total}</div><div className="text-xs text-muted-foreground">Lines parsed</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{bots}</div><div className="text-xs text-muted-foreground">Bot hits</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-2xl font-bold">{topIps.length}</div><div className="text-xs text-muted-foreground">Unique IPs (top)</div></CardContent></Card>
      </div>
      {[['Top IPs', topIps], ['Top paths', topPaths], ['Top user agents', topUAs]].map(([title, list]) => (
        <Card key={title as string}><CardContent className="p-4">
          <div className="font-semibold text-sm mb-2">{title as string}</div>
          {(list as any[]).map(([k, v]) => <div key={k} className="flex justify-between text-xs border-t py-1"><span className="font-mono truncate max-w-xl">{k}</span><span>{v}</span></div>)}
        </CardContent></Card>
      ))}
    </ToolShell>
  );
}
