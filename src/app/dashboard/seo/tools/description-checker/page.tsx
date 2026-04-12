'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

export default function DescriptionCheckerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [desc, setDesc] = useState<string | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setDesc(null);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) setError(r.error);
      else setDesc(parseHtml(r.body).metaDescription);
    } finally { setLoading(false); }
  };

  const len = desc?.length || 0;
  const status = desc === null ? null : len < 120 ? 'too-short' : len > 160 ? 'too-long' : 'ok';

  return (
    <ToolShell title="Meta Description Checker" description="Check the meta description length (120–160 chars recommended).">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        <Button onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Check'}</Button>
      </div>
      {error && <Card className="border-red-500"><CardContent className="p-4 text-red-600 text-sm">{error}</CardContent></Card>}
      {desc !== null && (
        <Card><CardContent className="p-4 space-y-2">
          <div className="text-sm font-semibold">Description</div>
          <div className="text-sm">{desc || <span className="text-muted-foreground">(missing)</span>}</div>
          <div className="flex items-center justify-between text-xs">
            <span>{len} characters</span>
            <span className={status === 'ok' ? 'text-green-600' : 'text-red-600'}>
              {status === 'ok' ? 'Length OK' : status === 'too-short' ? 'Too short (< 120)' : 'Too long (> 160)'}
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded">
            <div className={`h-full rounded ${status === 'ok' ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, (len / 160) * 100)}%` }} />
          </div>
        </CardContent></Card>
      )}
    </ToolShell>
  );
}
