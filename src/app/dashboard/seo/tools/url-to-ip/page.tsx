'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiDnsLookup } from '@/lib/seo-tools/api-client';

export default function UrlToIpPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setResult(null);
    try {
      const host = new URL(/^https?:\/\//.test(url) ? url : `http://${url}`).hostname;
      const r = await apiDnsLookup(host, 'A');
      if (r.error) setError(r.error);
      else setResult({ host, records: r.records });
    } catch (e: any) {
      setError(e?.message || 'invalid url');
    } finally { setLoading(false); }
  };

  return (
    <ToolShell title="URL to IP" description="Resolve a URL or hostname to its IP addresses.">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="example.com or https://example.com" />
        <Button onClick={run} disabled={loading}>{loading ? 'Looking up…' : 'Resolve'}</Button>
      </div>
      {error && <Card className="border-red-500"><CardContent className="p-4 text-red-600 text-sm">{error}</CardContent></Card>}
      {result && (
        <Card><CardContent className="p-4">
          <div className="text-sm font-semibold mb-2">{result.host}</div>
          <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(result.records, null, 2)}</pre>
        </CardContent></Card>
      )}
    </ToolShell>
  );
}
