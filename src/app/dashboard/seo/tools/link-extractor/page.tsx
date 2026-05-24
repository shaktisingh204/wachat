'use client';

import { Button, Input, Card, ZoruCardContent, Badge, cn, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

void _zoruCn;

import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

interface LinkRow {
  href: string;
  text: string;
  rel: string;
  nofollow: boolean;
  isInternal?: boolean;
}

export default function LinkExtractorPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<LinkRow[] | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [followFilter, setFollowFilter] = useState<'all' | 'dofollow' | 'nofollow'>('all');

  const run = async () => {
    if (!url) return;
    let validUrl = url;
    if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
      validUrl = 'https://' + validUrl;
      setUrl(validUrl);
    }
    setLoading(true);
    setError('');
    setRows(null);
    try {
      const r = await apiFetchUrl(validUrl);
      if (r.error) {
        setError(r.error);
        return;
      }
      const parsed = parseHtml(r.body || '');
      let baseHost = '';
      try {
        baseHost = new URL(validUrl).hostname;
      } catch (e) {}

      const resolvedLinks = (parsed.links || []).map((l: any) => {
        let finalHref = l.href;
        let isInternal = false;
        try {
          const u = new URL(l.href, validUrl);
          finalHref = u.href;
          if (baseHost) {
            isInternal = u.hostname === baseHost;
          }
        } catch (e) {}
        
        return {
          ...l,
          href: finalHref,
          isInternal
        };
      });
      setRows(resolvedLinks);
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = (rows || []).filter((r) => {
    if (typeFilter === 'internal' && !r.isInternal) return false;
    if (typeFilter === 'external' && r.isInternal) return false;
    if (followFilter === 'dofollow' && r.nofollow) return false;
    if (followFilter === 'nofollow' && !r.nofollow) return false;
    return true;
  });

  const exportCsv = () => {
    if (!filteredRows.length) return;
    const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
    const header = 'href,text,rel,nofollow,type\n';
    const body = filteredRows.map((r) => [esc(r.href), esc(r.text), esc(r.rel), r.nofollow, r.isInternal ? 'internal' : 'external'].join(',')).join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'links.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <ToolShell title="Link Extractor" description="Extract all links from a page and export them as CSV.">
      <div className="flex gap-2">
        <Input
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button onClick={run} disabled={loading || !url}>
          {loading ? 'Extracting…' : 'Extract'}
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
              <div className="flex items-center gap-4">
                <div className="text-sm font-semibold">{filteredRows.length} links</div>
                <div className="flex items-center gap-2">
                  <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue placeholder="Link Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="external">External</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={followFilter} onValueChange={(v: any) => setFollowFilter(v)}>
                    <SelectTrigger className="w-[130px] h-8 text-xs">
                      <SelectValue placeholder="Follow Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Follow</SelectItem>
                      <SelectItem value="dofollow">Dofollow</SelectItem>
                      <SelectItem value="nofollow">Nofollow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={exportCsv}>
                Export CSV
              </Button>
            </div>
            <div className="overflow-auto max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase">
                  <tr className="border-b">
                    <th className="text-left p-2">Href</th>
                    <th className="text-left p-2">Text</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Rel</th>
                    <th className="text-left p-2">Nofollow</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((r, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2 font-mono text-xs break-all max-w-xs">
                        <a href={r.href} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">
                          {r.href}
                        </a>
                      </td>
                      <td className="p-2 truncate max-w-xs">{r.text}</td>
                      <td className="p-2">
                        {r.isInternal ? <Badge variant="outline" className="text-xs">Internal</Badge> : <Badge variant="secondary" className="text-xs">External</Badge>}
                      </td>
                      <td className="p-2 text-xs">{r.rel}</td>
                      <td className="p-2">{r.nofollow ? <Badge variant="destructive">Yes</Badge> : <Badge variant="outline">No</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
