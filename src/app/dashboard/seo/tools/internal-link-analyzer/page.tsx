'use client';

import { Button, Input, Card, ZoruCardContent, cn } from '@/components/zoruui';
import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

interface LinkItem {
  href: string;
  resolvedUrl: string;
  text: string;
  nofollow: boolean;
  isAbsolute: boolean;
}

export default function InternalLinkAnalyzerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [links, setLinks] = useState<LinkItem[] | null>(null);

  const run = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    setLinks(null);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) {
        setError(r.error);
        return;
      }
      let host = '';
      try {
        host = new URL(r.finalUrl || url).hostname;
      } catch {
        setError('Invalid URL.');
        return;
      }
      const parsed = parseHtml(r.body || '');

      let baseUrl = r.finalUrl || url;
      const baseMatch = r.body?.match(/<base\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/i);
      const baseHref = baseMatch ? (baseMatch[1] || baseMatch[2] || baseMatch[3]) : null;
      if (baseHref) {
        try {
          baseUrl = new URL(baseHref, r.finalUrl || url).href;
        } catch {
          // ignore invalid base href
        }
      }

      const internal = (parsed.links || [])
        .map((l) => {
          let resolved = '';
          try {
            resolved = new URL(l.href, baseUrl).href;
          } catch {
            return null; // invalid URL even with base
          }
          
          let u: URL;
          try {
            u = new URL(resolved);
          } catch {
            return null;
          }

          const isSameHost = u.hostname === host;
          const isSubdomain = u.hostname.endsWith('.' + host) || host.endsWith('.' + u.hostname);
          
          if (!isSameHost && !isSubdomain) {
            return null;
          }

          const isAbsolute = /^https?:\/\//i.test(l.href) || l.href.startsWith('//');
          
          return {
            href: l.href,
            resolvedUrl: resolved,
            text: l.text,
            nofollow: !!l.nofollow,
            isAbsolute
          };
        })
        .filter((l): l is LinkItem => l !== null);

      setLinks(internal);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!links) return;
    const header = ['Resolved URL', 'Original Href', 'Anchor Text', 'Type', 'Nofollow'].join(',');
    const rows = links.map((l) => {
      const textEscaped = `"${(l.text || '').replace(/"/g, '""')}"`;
      return [
        `"${l.resolvedUrl.replace(/"/g, '""')}"`,
        `"${l.href.replace(/"/g, '""')}"`,
        textEscaped,
        l.isAbsolute ? 'Absolute' : 'Relative',
        l.nofollow ? 'Yes' : 'No',
      ].join(',');
    });
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const urlBlob = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = urlBlob;
    a.download = 'internal_links.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(urlBlob);
  };

  return (
    <ToolShell title="Internal Link Analyzer" description="List all links that point to the same domain as the page.">
      <div className="flex gap-2">
        <Input
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button onClick={run} disabled={loading || !url}>
          {loading ? 'Analyzing…' : 'Analyze'}
        </Button>
      </div>

      {error && (
        <Card className="border-zoru-line/50">
          <ZoruCardContent className="p-4 text-sm text-zoru-ink">{error}</ZoruCardContent>
        </Card>
      )}

      {links && (
        <Card>
          <ZoruCardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{links.length} internal links</div>
              <Button size="sm" variant="outline" onClick={exportCsv}>
                Export CSV
              </Button>
            </div>
            <div className="space-y-2 max-h-[600px] overflow-auto">
              {links.map((l, i) => (
                <div key={i} className="text-sm border-b pb-2">
                  <div className="font-mono text-xs break-all flex items-center flex-wrap gap-2 mb-1">
                    <span className="font-semibold text-zoru-ink">{l.resolvedUrl}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
                      l.isAbsolute ? "bg-zoru-ink/20 text-zoru-ink" : "bg-zoru-ink/20 text-zoru-ink"
                    )}>
                      {l.isAbsolute ? 'Absolute' : 'Relative'}
                    </span>
                    {l.nofollow && (
                      <span className="bg-zoru-ink/20 text-zoru-ink px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">
                        Nofollow
                      </span>
                    )}
                  </div>
                  {l.href !== l.resolvedUrl && (
                    <div className="text-xs text-zoru-ink-muted font-mono mb-1">
                      Raw: {l.href}
                    </div>
                  )}
                  {l.text && <div className="text-zoru-ink-muted">{l.text}</div>}
                </div>
              ))}
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
