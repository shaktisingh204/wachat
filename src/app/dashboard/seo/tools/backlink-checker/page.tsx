'use client';

import { Button, Input, Card, ZoruCardContent, Badge, cn } from '@/components/sabcrm/20ui/compat';
import { cn as _zoruCn, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';
import { Download, Copy, AlertCircle } from 'lucide-react';

void _zoruCn;

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

interface BacklinkRow {
  source: string;
  anchor: string;
  dr: number;
}

export default function BacklinkCheckerPage() {
  const [domain, setDomain] = useState('');
  const [rows, setRows] = useState<BacklinkRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(false);

  const run = async () => {
    if (!domain) return;
    setLoading(true);
    setError(null);
    setIsMock(false);
    setRows(null);

    try {
      // Connect to a real API (Ahrefs v3 example) using the proxy to bypass CORS
      const apiUrl = `https://api.ahrefs.com/v3/site-explorer/backlinks?target=${encodeURIComponent(domain)}&limit=10&mode=subdomains&token=DEMO_TOKEN`;
      
      const res = await apiFetchUrl(apiUrl, { method: 'GET' });

      // Usually, a 401 or 403 means the demo token is invalid. 
      // We'll catch it and fall back to mock data.
      if (res.error || res.status !== 200) {
        throw new Error(res.error || `API Error: Status ${res.status}`);
      }

      let parsedRows: BacklinkRow[] = [];
      try {
        const data = JSON.parse(res.body);
        if (data && data.backlinks) {
          parsedRows = data.backlinks.map((b: any) => ({
            source: b.url_from,
            anchor: b.anchor || 'No anchor',
            dr: b.domain_rating || 0
          }));
        } else {
          throw new Error('Unexpected API response format');
        }
      } catch (parseErr) {
        throw new Error('Failed to parse API response');
      }

      setRows(parsedRows);

    } catch (err: any) {
      setError(`Real API connection failed (${err.message}). Showing generated placeholder metrics.`);
      setIsMock(true);
      
      // Fallback to placeholder metrics using domain hash
      const base = hash(domain);
      const sources = ['blog.example.com', 'news.example.org', 'tech.example.io', 'forum.example.net', 'medium.com'];
      const anchors = ['Read more', 'Learn here', 'Great resource', 'Check this', 'Visit site'];
      const out = sources.map((s, i) => ({
        source: `https://${s}/${domain.replace(/[^a-z0-9]/gi, '')}-post`,
        anchor: anchors[(base + i) % anchors.length],
        dr: ((base + i * 7) % 70) + 20,
      }));
      setRows(out);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!rows) return;
    const text = [
      ['Source', 'Anchor', 'DR'].join('\t'),
      ...rows.map(r => `${r.source}\t${r.anchor}\t${r.dr}`)
    ].join('\n');
    navigator.clipboard.writeText(text);
  };

  const exportCSV = () => {
    if (!rows) return;
    const csv = [
      ['Source', 'Anchor', 'DR'].join(','),
      ...rows.map(r => `"${r.source}","${r.anchor}",${r.dr}`)
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backlinks-${domain.replace(/[^a-z0-9]/gi, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ToolShell title="Backlink Checker" description="Analyze incoming links to a domain.">
      <div className="flex gap-2">
        <Input
          placeholder="example.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run} disabled={!domain || loading}>
          {loading ? 'Checking...' : 'Check'}
        </Button>
      </div>

      {error && (
        <Card className="border-[var(--st-border)]/50 bg-[var(--st-text)]/10">
          <ZoruCardContent className="p-4 flex items-center gap-3 text-sm text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <div>{error}</div>
          </ZoruCardContent>
        </Card>
      )}

      {rows && (
        <Card>
          <ZoruCardContent className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-sm font-medium text-[var(--st-text-secondary)]">
                Found {rows.length} backlinks
                {isMock && " (Mock Data)"}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={exportCSV}>
                  <Download className="w-4 h-4 mr-2" />
                  CSV
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[2fr_1.5fr_80px] gap-3 text-xs font-semibold text-[var(--st-text-secondary)] uppercase tracking-wide px-2">
                <div>Source</div>
                <div>Anchor</div>
                <div className="text-right">DR</div>
              </div>
              <div className="divide-y rounded-md border">
                {rows.map((r, i) => (
                  <div key={i} className="grid grid-cols-[2fr_1.5fr_80px] gap-3 text-sm items-center p-3 hover:bg-[var(--st-bg-muted)]/50 transition-colors">
                    <div className="font-mono text-xs break-all truncate" title={r.source}>
                      <a href={r.source} target="_blank" rel="noreferrer" className="hover:underline text-[var(--st-text)] dark:text-[var(--st-text-secondary)]">
                        {r.source}
                      </a>
                    </div>
                    <div className="truncate" title={r.anchor}>{r.anchor}</div>
                    <div className="text-right">
                      <Badge variant="secondary" className={
                        r.dr > 60 ? "bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-[var(--st-text-secondary)]" :
                        r.dr > 30 ? "bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-[var(--st-text-secondary)]" :
                        "bg-[var(--st-bg-muted)] text-[var(--st-text)] dark:bg-[var(--st-text)] dark:text-[var(--st-text-secondary)]"
                      }>
                        {r.dr}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
