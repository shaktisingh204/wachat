'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

export default function DoFollowCheckerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<{
    dofollow: { href: string; text: string }[];
    nofollow: { href: string; text: string }[];
  } | null>(null);

  const run = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    setData(null);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) {
        setError(r.error);
        return;
      }
      const parsed = parseHtml(r.body || '');
      const dofollow: { href: string; text: string }[] = [];
      const nofollow: { href: string; text: string }[] = [];
      for (const l of parsed.links || []) {
        if (!l.href) continue;
        (l.nofollow ? nofollow : dofollow).push({ href: l.href, text: l.text });
      }
      setData({ dofollow, nofollow });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolShell title="DoFollow / NoFollow Checker" description="Split a page's outbound links into DoFollow vs NoFollow buckets.">
      <div className="flex gap-2">
        <Input
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button onClick={run} disabled={loading || !url}>
          {loading ? 'Checking…' : 'Check'}
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/50">
          <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
        </Card>
      )}

      {data && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="text-sm font-semibold">DoFollow ({data.dofollow.length})</div>
              <div className="space-y-1 max-h-96 overflow-auto">
                {data.dofollow.slice(0, 50).map((l, i) => (
                  <div key={i} className="text-xs font-mono break-all border-b pb-1">
                    {l.href}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="text-sm font-semibold">NoFollow ({data.nofollow.length})</div>
              <div className="space-y-1 max-h-96 overflow-auto">
                {data.nofollow.slice(0, 50).map((l, i) => (
                  <div key={i} className="text-xs font-mono break-all border-b pb-1">
                    {l.href}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ToolShell>
  );
}
