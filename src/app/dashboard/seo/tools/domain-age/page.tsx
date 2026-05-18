'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useState } from 'react';
import { ZoruInput } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiWhois } from '@/lib/seo-tools/api-client';

export default function DomainAgePage() {
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<{ created: string; age: string; registrar: string; expires: string } | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setInfo(null);
    try {
      const r = await apiWhois(domain);
      if (r.error) { setError(r.error); return; }
      const p = r.parsed || {};
      const created = p['creation date'] || p['created'] || p['registered'] || '';
      const registrar = p['registrar'] || '';
      const expires = p['registry expiry date'] || p['expires'] || p['expiration date'] || '';
      let age = '—';
      if (created) {
        const d = new Date(created);
        if (!isNaN(d.getTime())) {
          const years = (Date.now() - d.getTime()) / (365 * 86400000);
          age = `${years.toFixed(1)} years`;
        }
      }
      setInfo({ created, age, registrar, expires });
    } finally { setLoading(false); }
  };

  return (
    <ToolShell title="Domain Age Checker" description="Check when a domain was first registered.">
      <div className="flex gap-2">
        <ZoruInput value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
        <ZoruButton onClick={run} disabled={loading}>{loading ? 'Checking…' : 'Check'}</ZoruButton>
      </div>
      {error && <ZoruCard className="border-red-500"><ZoruCardContent className="p-4 text-red-600 text-sm">{error}</ZoruCardContent></ZoruCard>}
      {info && (
        <ZoruCard><ZoruCardContent className="p-4 space-y-2 text-sm">
          <div><span className="font-semibold">Age:</span> {info.age}</div>
          <div><span className="font-semibold">Created:</span> {info.created || '—'}</div>
          <div><span className="font-semibold">Expires:</span> {info.expires || '—'}</div>
          <div><span className="font-semibold">Registrar:</span> {info.registrar || '—'}</div>
        </ZoruCardContent></ZoruCard>
      )}
    </ToolShell>
  );
}
