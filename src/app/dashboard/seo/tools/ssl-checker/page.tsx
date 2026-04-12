'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiSsl } from '@/lib/seo-tools/api-client';

export default function SslCheckerPage() {
  const [host, setHost] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setData(null);
    try {
      const r = await apiSsl(host);
      if (r.error) setError(r.error);
      else setData(r);
    } finally { setLoading(false); }
  };

  return (
    <ToolShell title="SSL Certificate Checker" description="Inspect the SSL certificate of any host.">
      <div className="flex gap-2">
        <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="example.com" />
        <Button onClick={run} disabled={loading}>{loading ? 'Checking…' : 'Check'}</Button>
      </div>
      {error && <Card className="border-red-500"><CardContent className="p-4 text-red-600 text-sm">{error}</CardContent></Card>}
      {data && (
        <Card><CardContent className="p-4 space-y-2 text-sm">
          <div><span className="font-semibold">Host:</span> {data.host}</div>
          <div><span className="font-semibold">Trusted:</span> {data.authorized ? '✅ yes' : '⚠️ no'}</div>
          <div><span className="font-semibold">Protocol:</span> {data.protocol || '—'}</div>
          <div><span className="font-semibold">Subject:</span> {data.subject?.CN || '—'}</div>
          <div><span className="font-semibold">Issuer:</span> {data.issuer?.CN || data.issuer?.O || '—'}</div>
          <div><span className="font-semibold">Valid from:</span> {data.validFrom || '—'}</div>
          <div><span className="font-semibold">Valid to:</span> {data.validTo || '—'}</div>
          <div><span className="font-semibold">Days remaining:</span> {data.daysRemaining ?? '—'}</div>
          <div className="font-mono text-xs break-all"><span className="font-semibold">SHA-256:</span> {data.fingerprint256 || '—'}</div>
        </CardContent></Card>
      )}
    </ToolShell>
  );
}
