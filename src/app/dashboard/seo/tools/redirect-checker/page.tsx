'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { ZoruInput } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { ZoruBadge } from '@/components/zoruui';
import { apiFetchUrl, type FetchUrlResult } from '@/lib/seo-tools/api-client';

export default function RedirectCheckerPage() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<FetchUrlResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!url) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await apiFetchUrl(url);
      setResult(r);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolShell title="Redirect Checker" description="Trace the redirect chain from an initial URL to its final destination.">
      <div className="flex gap-2">
        <ZoruInput
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <ZoruButton onClick={run} disabled={loading || !url}>
          {loading ? 'Checking…' : 'Check'}
        </ZoruButton>
      </div>

      {result?.error && (
        <ZoruCard className="border-red-500/50">
          <ZoruCardContent className="p-4 text-sm text-red-500">{result.error}</ZoruCardContent>
        </ZoruCard>
      )}

      {result && !result.error && (
        <ZoruCard>
          <ZoruCardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Stat label="Hops" value={String(result.redirectChain?.length ?? 0)} />
              <Stat label="Final status" value={String(result.status)} />
              <Stat label="Final URL" value={result.finalUrl} mono />
            </div>

            <div className="space-y-2">
              <div className="text-sm font-semibold">Redirect chain</div>
              {(result.redirectChain?.length ?? 0) === 0 ? (
                <div className="text-sm text-muted-foreground">No redirects.</div>
              ) : (
                <div className="space-y-2">
                  {result.redirectChain.map((hop, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm">
                      <ZoruBadge variant="secondary">{i + 1}</ZoruBadge>
                      <ZoruBadge>{hop.status}</ZoruBadge>
                      <div className="font-mono break-all">{hop.url}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ZoruCardContent>
        </ZoruCard>
      )}
    </ToolShell>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? 'font-mono text-sm break-all' : 'text-lg font-semibold'}>{value}</div>
    </div>
  );
}
