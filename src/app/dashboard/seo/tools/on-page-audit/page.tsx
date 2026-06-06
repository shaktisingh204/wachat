'use client';

import { Button, Input, Card, ZoruCardContent } from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';
import { Check, X, Globe } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { parseHtml } from '@/lib/seo-tools/api-client';
import { runPuppeteerAudit } from './actions';

export default function OnPageAuditPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState<{ label: string; pass: boolean; note?: string }[]>([]);
  const [error, setError] = useState('');

  const run = async () => {
    let targetUrl = url.trim();
    if (!targetUrl) return;
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    setLoading(true); setError(''); setChecks([]);
    try {
      const r = await runPuppeteerAudit(targetUrl);
      if (r.error) { setError(r.error); return; }
      if (!r.body || !r.finalUrl) { setError('Empty response'); return; }

      const p = parseHtml(r.body);
      const imgsWithoutAlt = p.images.filter((i) => !i.alt).length;

      // Calculate internal vs external links
      let internalLinks = 0;
      let externalLinks = 0;
      let baseHost = '';
      try {
        baseHost = new URL(r.finalUrl).hostname;
      } catch (e) {}

      p.links.forEach(link => {
        try {
          if (!link.href) return;
          if (link.href.startsWith('mailto:') || link.href.startsWith('tel:') || link.href.startsWith('javascript:')) return;
          
          if (link.href.startsWith('http://') || link.href.startsWith('https://')) {
            const linkHost = new URL(link.href).hostname;
            if (linkHost === baseHost || linkHost.endsWith('.' + baseHost) || baseHost.endsWith('.' + linkHost)) {
              internalLinks++;
            } else {
              externalLinks++;
            }
          } else {
            // Relative links
            internalLinks++;
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      });

      const wordCount = r.wordCount || 0;

      setChecks([
        { label: 'Title present (10–60 chars)', pass: p.title.length >= 10 && p.title.length <= 60, note: `${p.title.length} chars` },
        { label: 'Meta description (120–160)', pass: p.metaDescription.length >= 120 && p.metaDescription.length <= 160, note: `${p.metaDescription.length} chars` },
        { label: 'Exactly one H1', pass: p.h1.length === 1, note: `${p.h1.length} H1 tags` },
        { label: 'Canonical URL present', pass: !!p.canonical },
        { label: 'Lang attribute on <html>', pass: !!p.lang },
        { label: 'Viewport meta tag', pass: !!p.viewport },
        { label: 'Robots meta tag', pass: !!p.robots },
        { label: 'All images have alt', pass: imgsWithoutAlt === 0, note: imgsWithoutAlt > 0 ? `${imgsWithoutAlt} missing` : '0 missing' },
        { label: 'Has Open Graph tags', pass: Object.keys(p.openGraph).length > 0 },
        { label: 'Has JSON-LD schema', pass: p.schema.length > 0 },
        { label: 'Word count (>= 300 words)', pass: wordCount >= 300, note: `${wordCount} words` },
        { label: 'Internal vs External Links', pass: internalLinks > 0, note: `${internalLinks} internal, ${externalLinks} external` },
      ]);
    } catch (e: any) {
      setError(e.message || 'An unexpected error occurred');
    } finally { 
      setLoading(false); 
    }
  };

  const passed = checks.filter((c) => c.pass).length;

  return (
    <ToolShell title="On-Page SEO Audit (JS Rendered)" description="In-depth audit of on-page SEO factors using a headless browser to execute client-side JavaScript. Ideal for SPAs and React/Vue sites.">
      <div className="flex gap-2">
        <Input 
          value={url} 
          onChange={(e) => setUrl(e.target.value)} 
          placeholder="https://example.com" 
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run} disabled={loading}>
          {loading ? 'Auditing…' : 'Audit'}
        </Button>
      </div>
      {error && <Card className="border-zoru-line"><ZoruCardContent className="p-4 text-zoru-ink text-sm">{error}</ZoruCardContent></Card>}
      
      {loading && (
        <Card className="mt-4 border-dashed">
          <ZoruCardContent className="p-8 text-center text-zoru-ink-muted flex flex-col items-center gap-4">
            <Globe className="h-8 w-8 animate-pulse text-zoru-ink" />
            <p>Launching headless browser & executing JS...</p>
            <p className="text-xs">This may take up to 10-15 seconds depending on the site.</p>
          </ZoruCardContent>
        </Card>
      )}

      {checks.length > 0 && !loading && (
        <Card className="mt-4">
          <ZoruCardContent className="p-4 space-y-2">
            <div className="text-sm font-semibold">Score: {passed} / {checks.length} checks passed</div>
            <div className="space-y-1">
              {checks.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b last:border-0 py-2">
                  <div className="flex items-center gap-3">
                    {c.pass ? <Check className="h-5 w-5 text-zoru-ink flex-shrink-0" /> : <X className="h-5 w-5 text-zoru-ink flex-shrink-0" />}
                    <span className={c.pass ? 'text-zoru-ink' : 'text-zoru-ink font-medium'}>{c.label}</span>
                  </div>
                  {c.note && <span className="text-xs text-zoru-ink-muted whitespace-nowrap ml-4">{c.note}</span>}
                </div>
              ))}
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
