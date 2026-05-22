'use client';

import { Button, Input, Card, ZoruCardContent, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';

export default function PageSizeCheckerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setRes(null);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) setError(r.error);
      else setRes(r);
    } finally { setLoading(false); }
  };

  return (
    <ToolShell title="Page Size Checker" description="Check the byte size and content-type of a web page.">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        <Button onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Check'}</Button>
      </div>
      {error && <Card className="border-red-500"><ZoruCardContent className="p-4 text-red-600 text-sm">{error}</ZoruCardContent></Card>}
      {res && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{res.status}</div><div className="text-xs text-muted-foreground">Status</div></ZoruCardContent></Card>
          <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{(res.bytes / 1024).toFixed(1)} KB</div><div className="text-xs text-muted-foreground">Size</div></ZoruCardContent></Card>
          <Card><ZoruCardContent className="p-4"><div className="text-sm font-bold truncate">{res.contentType || '—'}</div><div className="text-xs text-muted-foreground">Content-Type</div></ZoruCardContent></Card>
          <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{res.redirectChain.length}</div><div className="text-xs text-muted-foreground">Hops</div></ZoruCardContent></Card>
        </div>
      )}
    </ToolShell>
  );
}
