'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

interface LinkRow {
  href: string;
  text: string;
  rel: string;
  nofollow: boolean;
}

export default function LinkExtractorPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<LinkRow[] | null>(null);

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
      setRows(parsed.links || []);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!rows) return;
    const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
    const header = 'href,text,rel,nofollow\n';
    const body = rows.map((r) => [esc(r.href), esc(r.text), esc(r.rel), r.nofollow].join(',')).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'links.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <ToolShell title="Link Extractor" description="Extract all links from a page and export them as CSV.">
      <div className="flex gap-2">
        <Input
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button onClick={run} disabled={loading || !url}>
          {loading ? 'Extracting…' : 'Extract'}
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
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{rows.length} links</div>
              <Button size="sm" variant="outline" onClick={exportCsv}>
                Export CSV
              </Button>
            </div>
            <div className="overflow-auto max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase">
                  <tr className="border-b">
                    <th className="text-left p-2">Href</th>
                    <th className="text-left p-2">Text</th>
                    <th className="text-left p-2">Rel</th>
                    <th className="text-left p-2">Nofollow</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2 font-mono text-xs break-all max-w-xs">{r.href}</td>
                      <td className="p-2 truncate max-w-xs">{r.text}</td>
                      <td className="p-2 text-xs">{r.rel}</td>
                      <td className="p-2">{r.nofollow ? <Badge variant="destructive">Yes</Badge> : <Badge variant="secondary">No</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
