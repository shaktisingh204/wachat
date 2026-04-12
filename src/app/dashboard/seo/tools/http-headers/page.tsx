'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';

export default function HttpHeadersPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setData(null);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) setError(r.error);
      else setData(r);
    } finally { setLoading(false); }
  };

  return (
    <ToolShell title="HTTP Headers Checker" description="View HTTP response headers for any URL.">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        <Button onClick={run} disabled={loading}>{loading ? 'Checking…' : 'Check'}</Button>
      </div>
      {error && <Card className="border-red-500"><CardContent className="p-4 text-red-600 text-sm">{error}</CardContent></Card>}
      {data && (
        <Card><CardContent className="p-4">
          <div className="text-sm mb-3"><span className="font-semibold">Status:</span> {data.status}</div>
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(data.headers || {}).map(([k, v]) => (
                <tr key={k} className="border-t"><td className="py-1 font-mono w-60 align-top">{k}</td><td className="py-1 break-all">{String(v)}</td></tr>
              ))}
            </tbody>
          </table>
        </CardContent></Card>
      )}
    </ToolShell>
  );
}
