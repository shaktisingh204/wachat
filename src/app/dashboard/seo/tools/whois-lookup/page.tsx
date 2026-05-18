'use client';

import { ZoruButton, ZoruInput, ZoruCard, ZoruCardContent, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

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
        <ZoruInput value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
        <ZoruButton onClick={run} disabled={loading}>{loading ? 'Looking up…' : 'Lookup'}</ZoruButton>
      </div>
      {error && <ZoruCard className="border-red-500"><ZoruCardContent className="p-4 text-red-600 text-sm">{error}</ZoruCardContent></ZoruCard>}
      {data && (
        <>
          <ZoruCard><ZoruCardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-2">Server: {data.server}</div>
            <table className="w-full text-xs">
              <tbody>
                {Object.entries(data.parsed || {}).map(([k, v]) => (
                  <tr key={k} className="border-t"><td className="py-1 font-semibold w-40 align-top">{k}</td><td className="py-1">{String(v)}</td></tr>
                ))}
              </tbody>
            </table>
          </ZoruCardContent></ZoruCard>
          <ZoruButton variant="outline" onClick={() => setShowRaw((s) => !s)}>{showRaw ? 'Hide' : 'Show'} raw WHOIS</ZoruButton>
          {showRaw && <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-96 whitespace-pre-wrap">{data.raw}</pre>}
        </>
      )}
    </ToolShell>
  );
}
