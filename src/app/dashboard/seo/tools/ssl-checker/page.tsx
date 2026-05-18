'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useState } from 'react';
import { ZoruInput } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
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
        <ZoruInput value={host} onChange={(e) => setHost(e.target.value)} placeholder="example.com" />
        <ZoruButton onClick={run} disabled={loading}>{loading ? 'Checking…' : 'Check'}</ZoruButton>
      </div>
      {error && <ZoruCard className="border-red-500"><ZoruCardContent className="p-4 text-red-600 text-sm">{error}</ZoruCardContent></ZoruCard>}
      {data && (
        <ZoruCard><ZoruCardContent className="p-4 space-y-2 text-sm">
          <div><span className="font-semibold">Host:</span> {data.host}</div>
          <div><span className="font-semibold">Trusted:</span> {data.authorized ? '✅ yes' : '⚠️ no'}</div>
          <div><span className="font-semibold">Protocol:</span> {data.protocol || '—'}</div>
          <div><span className="font-semibold">Subject:</span> {data.subject?.CN || '—'}</div>
          <div><span className="font-semibold">Issuer:</span> {data.issuer?.CN || data.issuer?.O || '—'}</div>
          <div><span className="font-semibold">Valid from:</span> {data.validFrom || '—'}</div>
          <div><span className="font-semibold">Valid to:</span> {data.validTo || '—'}</div>
          <div><span className="font-semibold">Days remaining:</span> {data.daysRemaining ?? '—'}</div>
          <div className="font-mono text-xs break-all"><span className="font-semibold">SHA-256:</span> {data.fingerprint256 || '—'}</div>
        </ZoruCardContent></ZoruCard>
      )}
    </ToolShell>
  );
}
