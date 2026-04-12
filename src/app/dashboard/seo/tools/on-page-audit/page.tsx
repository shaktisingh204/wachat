'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, X } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

export default function OnPageAuditPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState<{ label: string; pass: boolean; note?: string }[]>([]);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setChecks([]);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) { setError(r.error); return; }
      const p = parseHtml(r.body);
      const imgsWithoutAlt = p.images.filter((i) => !i.alt).length;
      setChecks([
        { label: 'Title present (10–60 chars)', pass: p.title.length >= 10 && p.title.length <= 60, note: `${p.title.length} chars` },
        { label: 'Meta description (120–160)', pass: p.metaDescription.length >= 120 && p.metaDescription.length <= 160, note: `${p.metaDescription.length} chars` },
        { label: 'Exactly one H1', pass: p.h1.length === 1, note: `${p.h1.length} H1 tags` },
        { label: 'Canonical URL present', pass: !!p.canonical },
        { label: 'Lang attribute on <html>', pass: !!p.lang },
        { label: 'Viewport meta tag', pass: !!p.viewport },
        { label: 'Robots meta tag', pass: !!p.robots },
        { label: 'All images have alt', pass: imgsWithoutAlt === 0, note: imgsWithoutAlt > 0 ? `${imgsWithoutAlt} missing` : undefined },
        { label: 'Has Open Graph tags', pass: Object.keys(p.openGraph).length > 0 },
        { label: 'Has JSON-LD schema', pass: p.schema.length > 0 },
      ]);
    } finally { setLoading(false); }
  };

  const passed = checks.filter((c) => c.pass).length;

  return (
    <ToolShell title="On-Page SEO Audit" description="Quick audit of on-page SEO factors.">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        <Button onClick={run} disabled={loading}>{loading ? 'Auditing…' : 'Audit'}</Button>
      </div>
      {error && <Card className="border-red-500"><CardContent className="p-4 text-red-600 text-sm">{error}</CardContent></Card>}
      {checks.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="text-sm font-semibold">Score: {passed} / {checks.length}</div>
            {checks.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b last:border-0 py-1.5">
                <div className="flex items-center gap-2">
                  {c.pass ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-600" />}
                  <span>{c.label}</span>
                </div>
                {c.note && <span className="text-xs text-muted-foreground">{c.note}</span>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
