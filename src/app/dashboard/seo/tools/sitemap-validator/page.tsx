'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';

export default function SitemapValidatorPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) { setError(r.error); return; }
      const body = r.body.trim();
      const isXml = body.startsWith('<?xml');
      const hasUrlset = /<urlset/.test(body);
      const isIndex = /<sitemapindex/.test(body);
      const urls = Array.from(body.matchAll(/<loc>([^<]+)<\/loc>/g)).map((m) => m[1]);
      setResult({ isXml, hasUrlset, isIndex, count: urls.length, samples: urls.slice(0, 20) });
    } finally { setLoading(false); }
  };

  return (
    <ToolShell title="Sitemap Validator" description="Validate a sitemap.xml and list its URLs.">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/sitemap.xml" />
        <Button onClick={run} disabled={loading}>{loading ? 'Validating…' : 'Validate'}</Button>
      </div>
      {error && <Card className="border-red-500"><CardContent className="p-4 text-red-600 text-sm">{error}</CardContent></Card>}
      {result && (
        <Card><CardContent className="p-4 space-y-1 text-sm">
          <div>XML header: {result.isXml ? '✅' : '❌'}</div>
          <div>Urlset: {result.hasUrlset ? '✅' : '❌'}</div>
          <div>Sitemap index: {result.isIndex ? '✅' : '—'}</div>
          <div>URLs: {result.count}</div>
          <div className="mt-3 text-xs font-semibold">First {result.samples.length}:</div>
          {result.samples.map((u: string, i: number) => <div key={i} className="text-xs font-mono border-t py-0.5 truncate">{u}</div>)}
        </CardContent></Card>
      )}
    </ToolShell>
  );
}
