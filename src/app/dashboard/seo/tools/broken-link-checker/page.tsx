'use client';

import { Button, Input, Card, ZoruCardContent, Badge, cn, useZoruToast } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Download, Copy } from 'lucide-react';

void _zoruCn;

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
  const { toast } = useZoruToast();

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
      const finalUrl = r.finalUrl || url;
      
      const linkMap = new Map<string, LinkRow>();
      
      for (const l of parsed.links || []) {
        if (!l.href) continue;
        if (l.href.startsWith('mailto:') || l.href.startsWith('tel:') || l.href.startsWith('javascript:')) continue;
        
        try {
          const absoluteUrl = new URL(l.href, finalUrl).href;
          if (/^https?:/i.test(absoluteUrl)) {
             if (!linkMap.has(absoluteUrl)) {
                linkMap.set(absoluteUrl, { href: absoluteUrl, text: l.text, state: 'idle' });
             }
          }
        } catch {
          // Ignore invalid URLs
        }
      }
      
      const links = Array.from(linkMap.values()).slice(0, 30);
      setRows(links);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching the page.');
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
      let res = await apiFetchUrl(rows![i].href, { method: 'HEAD' });
      if (res.status === 405 || res.status === 403) {
        res = await apiFetchUrl(rows![i].href, { method: 'GET' });
      }
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

  const exportCsv = () => {
    if (!rows) return;
    const header = ['URL', 'Text', 'Status', 'State', 'Error'];
    const csvRows = rows.map(r => [
      r.href,
      r.text,
      r.status || '',
      r.state,
      r.error || ''
    ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','));
    
    const csvContent = [header.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.setAttribute('download', 'broken_links.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: 'Success', description: 'CSV exported successfully.' });
  };

  const copyToClipboard = () => {
    if (!rows) return;
    const text = rows.map(r => `${r.href}\t${r.text}\t${r.status || ''}\t${r.state}\t${r.error || ''}`).join('\n');
    navigator.clipboard.writeText(`URL\tText\tStatus\tState\tError\n${text}`);
    toast({ title: 'Copied', description: 'Link data copied to clipboard.' });
  };

  return (
    <ToolShell title="Broken Link Checker" description="Fetch a page and verify its outgoing links (first 30).">
      <div className="flex gap-2">
        <Input
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button onClick={run} disabled={loading || !url}>
          {loading ? 'Fetching…' : 'Fetch Links'}
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/50">
          <ZoruCardContent className="p-4 text-sm text-red-500">{error}</ZoruCardContent>
        </Card>
      )}

      {rows && (
        <Card>
          <ZoruCardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">{rows.length} links</div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={copyToClipboard} title="Copy to clipboard">
                  <Copy className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={exportCsv} title="Export CSV">
                  <Download className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={checkAll}>
                  Check all
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {rows.map((row, i) => (
                <div key={i} className="flex items-start gap-3 text-sm border-b pb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs break-all">{row.href}</div>
                    {row.text && <div className="text-muted-foreground truncate">{row.text}</div>}
                  </div>
                  <StatusBadge row={row} />
                  <Button size="sm" variant="ghost" onClick={() => checkOne(i)}>
                    Check
                  </Button>
                </div>
              ))}
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}

function StatusBadge({ row }: { row: LinkRow }) {
  if (row.state === 'idle') return <Badge variant="secondary">Pending</Badge>;
  if (row.state === 'checking') return <Badge variant="secondary">Checking…</Badge>;
  if (row.state === 'ok')
    return <Badge className="bg-green-600 hover:bg-green-600">OK {row.status}</Badge>;
  return <Badge variant="destructive">Broken {row.status ?? ''}</Badge>;
}
