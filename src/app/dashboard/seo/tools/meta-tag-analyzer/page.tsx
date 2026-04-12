'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml, type ParsedHtml } from '@/lib/seo-tools/api-client';

export default function MetaTagAnalyzerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedHtml | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    if (!url) return;
    setLoading(true); setError(''); setParsed(null);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) setError(r.error);
      else setParsed(parseHtml(r.body));
    } finally {
      setLoading(false);
    }
  };

  const rows = parsed
    ? [
        ['Title', parsed.title],
        ['Description', parsed.metaDescription],
        ['Canonical', parsed.canonical],
        ['Robots', parsed.robots],
        ['Viewport', parsed.viewport],
        ['Lang', parsed.lang],
        ['Charset', parsed.charset],
      ]
    : [];

  return (
    <ToolShell title="Meta Tag Analyzer" description="Inspect meta tags, Open Graph, and Twitter cards of any URL.">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        <Button onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Analyze'}</Button>
      </div>
      {error && <Card className="border-red-500"><CardContent className="p-4 text-red-600 text-sm">{error}</CardContent></Card>}
      {parsed && (
        <>
          <Card><CardContent className="p-4">
            <div className="font-semibold text-sm mb-2">Meta Tags</div>
            <table className="w-full text-sm">
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k} className="border-t"><td className="py-1.5 font-semibold w-40">{k}</td><td className="py-1.5">{v || <span className="text-muted-foreground">—</span>}</td></tr>
                ))}
              </tbody>
            </table>
          </CardContent></Card>
          {Object.keys(parsed.openGraph).length > 0 && (
            <Card><CardContent className="p-4">
              <div className="font-semibold text-sm mb-2">Open Graph</div>
              {Object.entries(parsed.openGraph).map(([k, v]) => (
                <div key={k} className="text-xs border-t py-1"><span className="font-mono text-muted-foreground">{k}:</span> {v}</div>
              ))}
            </CardContent></Card>
          )}
          {Object.keys(parsed.twitter).length > 0 && (
            <Card><CardContent className="p-4">
              <div className="font-semibold text-sm mb-2">Twitter</div>
              {Object.entries(parsed.twitter).map(([k, v]) => (
                <div key={k} className="text-xs border-t py-1"><span className="font-mono text-muted-foreground">{k}:</span> {v}</div>
              ))}
            </CardContent></Card>
          )}
        </>
      )}
    </ToolShell>
  );
}
