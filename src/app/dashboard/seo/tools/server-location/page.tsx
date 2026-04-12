'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiDnsLookup } from '@/lib/seo-tools/api-client';

export default function ServerLocationPage() {
  const [host, setHost] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setData(null);
    try {
      const dns = await apiDnsLookup(host, 'A');
      if (dns.error) { setError(dns.error); return; }
      const ipv4 = dns.records?.A || [];
      if (!ipv4.length) { setError('No A record found'); return; }
      setData({ host, ipv4 });
    } finally { setLoading(false); }
  };

  return (
    <ToolShell title="Server Location Checker" description="Resolve server IPs via local DNS (no third-party geolocation API).">
      <div className="flex gap-2">
        <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="example.com" />
        <Button onClick={run} disabled={loading}>{loading ? 'Looking up…' : 'Locate'}</Button>
      </div>
      {error && <Card className="border-red-500"><CardContent className="p-4 text-red-600 text-sm">{error}</CardContent></Card>}
      {data && (
        <Card><CardContent className="p-4 text-sm space-y-2">
          <div><span className="font-semibold">Host:</span> {data.host}</div>
          <div>
            <span className="font-semibold">IPv4 addresses:</span>
            <ul className="mt-1 font-mono text-xs">
              {data.ipv4.map((ip: string) => (
                <li key={ip} className="border-t py-1 first:border-0">{ip}</li>
              ))}
            </ul>
          </div>
          <div className="text-xs text-muted-foreground pt-2">
            GeoIP requires an offline MaxMind database or paid API; not included in local-only mode.
          </div>
        </CardContent></Card>
      )}
    </ToolShell>
  );
}
