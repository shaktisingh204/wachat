'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

export default function InternalLinkAnalyzerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [links, setLinks] = useState<{ href: string; text: string }[] | null>(null);

  const run = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    setLinks(null);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) {
        setError(r.error);
        return;
      }
      let host = '';
      try {
        host = new URL(r.finalUrl || url).hostname;
      } catch {
        setError('Invalid URL.');
        return;
      }
      const parsed = parseHtml(r.body || '');
      const internal = (parsed.links || [])
        .filter((l) => {
          if (!l.href) return false;
          try {
            const u = new URL(l.href, r.finalUrl || url);
            return u.hostname === host;
          } catch {
            return false;
          }
        })
        .map((l) => ({ href: l.href, text: l.text }));
      setLinks(internal);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolShell title="Internal Link Analyzer" description="List all links that point to the same domain as the page.">
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

      {links && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-semibold">{links.length} internal links</div>
            <div className="space-y-2 max-h-[600px] overflow-auto">
              {links.map((l, i) => (
                <div key={i} className="text-sm border-b pb-2">
                  <div className="font-mono text-xs break-all">{l.href}</div>
                  {l.text && <div className="text-muted-foreground">{l.text}</div>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
