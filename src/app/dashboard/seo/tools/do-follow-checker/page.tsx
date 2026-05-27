'use client';

import { Button, Input, Card, ZoruCardContent } from '@/components/zoruui';
import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Copy, Download, AlertTriangle } from 'lucide-react';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';
import { useToast } from '@/hooks/use-toast';

export default function DoFollowCheckerPage() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<{
    dofollow: { href: string; text: string }[];
    nofollow: { href: string; text: string }[];
  } | null>(null);

  const run = async () => {
    if (!url) return;
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
      setUrl(targetUrl);
    }
    setLoading(true);
    setError('');
    setData(null);
    try {
      // apiFetchUrl proxies the request, avoiding direct CORS issues.
      const r = await apiFetchUrl(targetUrl);
      if (r.error) {
        setError(r.error);
        return;
      }
      const parsed = parseHtml(r.body || '');
      const dofollow: { href: string; text: string }[] = [];
      const nofollow: { href: string; text: string }[] = [];
      for (const l of parsed.links || []) {
        if (!l.href) continue;
        // Basic filtering to ensure we capture relevant links.
        if (l.href.startsWith('javascript:')) continue;
        if (l.href.startsWith('mailto:')) continue;
        if (l.href.startsWith('tel:')) continue;
        if (l.href.startsWith('#')) continue;

        let absoluteUrl = l.href;
        try {
          absoluteUrl = new URL(l.href, targetUrl).href;
        } catch {
          // fallback to original if unparseable
        }

        (l.nofollow ? nofollow : dofollow).push({ href: absoluteUrl, text: l.text || absoluteUrl });
      }
      setData({ dofollow, nofollow });
    } catch (err: any) {
      setError(err.message || 'An unexpected network error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ['URL', 'Anchor Text', 'Type'],
      ...data.dofollow.map((l) => [l.href, l.text, 'dofollow']),
      ...data.nofollow.map((l) => [l.href, l.text, 'nofollow']),
    ];
    const csv = rows.map((r) => r.map((c) => `"${(c || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = 'links.csv';
    link.click();
    URL.revokeObjectURL(blobUrl);
  };

  const copyToClipboard = () => {
    if (!data) return;
    const lines = [
      'URL\tText\tType',
      ...data.dofollow.map((l) => `${l.href}\t${l.text}\tdofollow`),
      ...data.nofollow.map((l) => `${l.href}\t${l.text}\tnofollow`),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    toast({ title: 'Copied to clipboard!', description: 'The links have been copied.' });
  };

  return (
    <ToolShell title="DoFollow / NoFollow Checker" description="Split a page's outbound links into DoFollow vs NoFollow buckets.">
      <div className="flex gap-2">
        <Input
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run();
          }}
        />
        <Button onClick={run} disabled={loading || !url}>
          {loading ? 'Checking…' : 'Check'}
        </Button>
      </div>

      {error && (
        <Card className="border-zoru-line/50">
          <ZoruCardContent className="p-4 text-sm text-zoru-ink flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </ZoruCardContent>
        </Card>
      )}

      {data && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              <Copy className="w-4 h-4 mr-2" />
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <ZoruCardContent className="p-4 space-y-2">
                <div className="text-sm font-semibold">DoFollow ({data.dofollow.length})</div>
                <div className="space-y-1 max-h-96 overflow-auto">
                  {data.dofollow.map((l, i) => (
                    <div key={i} className="flex flex-col text-xs break-all border-b pb-2 last:border-0 space-y-1" title={l.text}>
                      <span className="font-medium">{l.text || '(no text)'}</span>
                      <span className="font-mono text-zoru-text-muted">{l.href}</span>
                    </div>
                  ))}
                </div>
              </ZoruCardContent>
            </Card>
            <Card>
              <ZoruCardContent className="p-4 space-y-2">
                <div className="text-sm font-semibold">NoFollow ({data.nofollow.length})</div>
                <div className="space-y-1 max-h-96 overflow-auto">
                  {data.nofollow.map((l, i) => (
                    <div key={i} className="flex flex-col text-xs break-all border-b pb-2 last:border-0 space-y-1" title={l.text}>
                      <span className="font-medium">{l.text || '(no text)'}</span>
                      <span className="font-mono text-zoru-text-muted">{l.href}</span>
                    </div>
                  ))}
                </div>
              </ZoruCardContent>
            </Card>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
