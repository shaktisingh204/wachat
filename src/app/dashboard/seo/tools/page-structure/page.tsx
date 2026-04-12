'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml, type ParsedHtml } from '@/lib/seo-tools/api-client';

export default function PageStructurePage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [p, setP] = useState<ParsedHtml | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setP(null);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) setError(r.error);
      else setP(parseHtml(r.body));
    } finally { setLoading(false); }
  };

  return (
    <ToolShell title="Page Structure Analyzer" description="Analyze the H1–H6 heading hierarchy of a page.">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        <Button onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Analyze'}</Button>
      </div>
      {error && <Card className="border-red-500"><CardContent className="p-4 text-red-600 text-sm">{error}</CardContent></Card>}
      {p && (
        <>
          {p.h1.length !== 1 && (
            <Card className="border-amber-400"><CardContent className="p-3 text-xs">Warning: page has {p.h1.length} H1 tag(s). Recommended: exactly 1.</CardContent></Card>
          )}
          {(['h1','h2','h3','h4','h5','h6'] as const).map((tag) => {
            const items: string[] = p[tag];
            return (
              <Card key={tag}>
                <CardContent className="p-4">
                  <div className="text-sm font-semibold mb-1">{tag.toUpperCase()} ({items.length})</div>
                  <ul className="space-y-0.5">
                    {items.map((h, i) => <li key={i} className="text-xs border-b last:border-0 py-0.5">{h}</li>)}
                    {items.length === 0 && <li className="text-xs text-muted-foreground">None</li>}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </>
      )}
    </ToolShell>
  );
}
