'use client';

import { Button, Input, Card, ZoruCardContent, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

export default function CanonicalTagPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [canonical, setCanonical] = useState<string | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setCanonical(null);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) setError(r.error);
      else setCanonical(parseHtml(r.body).canonical || '(missing)');
    } finally { setLoading(false); }
  };

  return (
    <ToolShell title="Canonical Tag Checker" description="Check the canonical URL of a web page.">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        <Button onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Check'}</Button>
      </div>
      {error && <Card className="border-red-500"><ZoruCardContent className="p-4 text-red-600 text-sm">{error}</ZoruCardContent></Card>}
      {canonical !== null && (
        <Card><ZoruCardContent className="p-4">
          <div className="text-xs font-semibold text-muted-foreground mb-1">Canonical URL</div>
          <div className="font-mono text-sm break-all">{canonical}</div>
        </ZoruCardContent></Card>
      )}
    </ToolShell>
  );
}
