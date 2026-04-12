'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiDnsLookup } from '@/lib/seo-tools/api-client';

export default function DnsLookupPage() {
  const [host, setHost] = useState('');
  const [type, setType] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setData(null);
    try {
      const r = await apiDnsLookup(host, type === 'ALL' ? undefined : type);
      if (r.error) setError(r.error);
      else setData(r);
    } finally { setLoading(false); }
  };

  return (
    <ToolShell title="DNS Lookup" description="Query DNS records for any hostname.">
      <div className="flex gap-2">
        <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="example.com" />
        <select className="border rounded h-9 px-2 bg-background" value={type} onChange={(e) => setType(e.target.value)}>
          <option>ALL</option><option>A</option><option>AAAA</option><option>MX</option><option>TXT</option><option>NS</option><option>CNAME</option><option>SOA</option>
        </select>
        <Button onClick={run} disabled={loading}>{loading ? 'Looking up…' : 'Lookup'}</Button>
      </div>
      {error && <Card className="border-red-500"><CardContent className="p-4 text-red-600 text-sm">{error}</CardContent></Card>}
      {data && (
        <Card><CardContent className="p-4">
          <div className="text-sm font-semibold mb-2">{data.host}</div>
          <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(data.records, null, 2)}</pre>
        </CardContent></Card>
      )}
    </ToolShell>
  );
}
