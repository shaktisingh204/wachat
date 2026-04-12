'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiWhois } from '@/lib/seo-tools/api-client';

export default function WhoisLookupPage() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [showRaw, setShowRaw] = useState(false);

  const run = async () => {
    setLoading(true); setError(''); setData(null);
    try {
      const r = await apiWhois(domain);
      if (r.error) setError(r.error);
      else setData(r);
    } finally { setLoading(false); }
  };

  return (
    <ToolShell title="WHOIS Lookup" description="Query WHOIS registration data for any domain.">
      <div className="flex gap-2">
        <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
        <Button onClick={run} disabled={loading}>{loading ? 'Looking up…' : 'Lookup'}</Button>
      </div>
      {error && <Card className="border-red-500"><CardContent className="p-4 text-red-600 text-sm">{error}</CardContent></Card>}
      {data && (
        <>
          <Card><CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-2">Server: {data.server}</div>
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(data.parsed || {}).map(([k, v]) => (
                  <tr key={k} className="border-t"><td className="py-1 font-semibold w-40 align-top">{k}</td><td className="py-1">{String(v)}</td></tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
          <Button variant="outline" onClick={() => setShowRaw((s) => !s)}>{showRaw ? 'Hide' : 'Show'} raw WHOIS</Button>
          {showRaw && <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96 whitespace-pre-wrap">{data.raw}</pre>}
        </>
      )}
    </ToolShell>
  );
}
