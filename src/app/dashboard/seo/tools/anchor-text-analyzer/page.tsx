'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

export default function AnchorTextAnalyzerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<{ anchor: string; count: number }[] | null>(null);

  const run = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    setRows(null);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) {
        setError(r.error);
        return;
      }
      const parsed = parseHtml(r.body || '');
      const map = new Map<string, number>();
      for (const l of parsed.links || []) {
        const t = (l.text || '').trim();
        if (!t) continue;
        map.set(t, (map.get(t) || 0) + 1);
      }
      const arr = Array.from(map.entries())
        .map(([anchor, count]) => ({ anchor, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      setRows(arr);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolShell title="Anchor Text Analyzer" description="Group links by anchor text and show the most common ones.">
      <div className="flex gap-2">
        <Input
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button onClick={run} disabled={loading || !url}>
          {loading ? 'Analyzing…' : 'Analyze'}
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/50">
          <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
        </Card>
      )}

      {rows && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-semibold">Top {rows.length} anchors</div>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b pb-2">
                  <div className="truncate pr-3">{r.anchor}</div>
                  <Badge variant="secondary">{r.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
