'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { ZoruInput } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { ZoruBadge } from '@/components/zoruui';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

interface LinkRow {
  href: string;
  text: string;
  status?: number;
  state: 'idle' | 'checking' | 'ok' | 'broken';
  error?: string;
}

export default function BrokenLinkCheckerPage() {
  const [url, setUrl] = useState('');
  const [rows, setRows] = useState<LinkRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    setRows(null);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) {
        setError(r.error);
        return;
      }
      const parsed = parseHtml(r.body || '');
      const links = (parsed.links || [])
        .filter((l) => l.href && /^https?:/i.test(l.href))
        .slice(0, 30)
        .map<LinkRow>((l) => ({ href: l.href, text: l.text, state: 'idle' }));
      setRows(links);
    } finally {
      setLoading(false);
    }
  };

  const checkOne = async (i: number) => {
    setRows((prev) => {
      if (!prev) return prev;
      const copy = [...prev];
      copy[i] = { ...copy[i], state: 'checking' };
      return copy;
    });
    try {
      const res = await apiFetchUrl(rows![i].href);
      setRows((prev) => {
        if (!prev) return prev;
        const copy = [...prev];
        const ok = !res.error && res.status >= 200 && res.status < 400;
        copy[i] = {
          ...copy[i],
          status: res.status,
          state: ok ? 'ok' : 'broken',
          error: res.error,
        };
        return copy;
      });
    } catch (e: any) {
      setRows((prev) => {
        if (!prev) return prev;
        const copy = [...prev];
        copy[i] = { ...copy[i], state: 'broken', error: e?.message };
        return copy;
      });
    }
  };

  const checkAll = async () => {
    if (!rows) return;
    for (let i = 0; i < rows.length; i++) {
      await checkOne(i);
    }
  };

  return (
    <ToolShell title="Broken Link Checker" description="Fetch a page and verify its outgoing links (first 30).">
      <div className="flex gap-2">
        <ZoruInput
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <ZoruButton onClick={run} disabled={loading || !url}>
          {loading ? 'Fetching…' : 'Fetch Links'}
        </ZoruButton>
      </div>

      {error && (
        <ZoruCard className="border-red-500/50">
          <ZoruCardContent className="p-4 text-sm text-red-500">{error}</ZoruCardContent>
        </ZoruCard>
      )}

      {rows && (
        <ZoruCard>
          <ZoruCardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{rows.length} links</div>
              <ZoruButton size="sm" variant="outline" onClick={checkAll}>
                Check all
              </ZoruButton>
            </div>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex items-start gap-3 text-sm border-b pb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs break-all">{row.href}</div>
                    {row.text && <div className="text-muted-foreground truncate">{row.text}</div>}
                  </div>
                  <StatusBadge row={row} />
                  <ZoruButton size="sm" variant="ghost" onClick={() => checkOne(i)}>
                    Check
                  </ZoruButton>
                </div>
              ))}
            </div>
          </ZoruCardContent>
        </ZoruCard>
      )}
    </ToolShell>
  );
}

function StatusBadge({ row }: { row: LinkRow }) {
  if (row.state === 'idle') return <ZoruBadge variant="secondary">Pending</ZoruBadge>;
  if (row.state === 'checking') return <ZoruBadge variant="secondary">Checking…</ZoruBadge>;
  if (row.state === 'ok')
    return <ZoruBadge className="bg-green-600 hover:bg-green-600">OK {row.status}</ZoruBadge>;
  return <ZoruBadge variant="destructive">Broken {row.status ?? ''}</ZoruBadge>;
}
