'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Check, X } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

export default function MobileFriendlyPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [checks, setChecks] = useState<{ label: string; pass: boolean }[]>([]);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setChecks([]);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) { setError(r.error); return; }
      const p = parseHtml(r.body);
      const html = r.body.toLowerCase();
      setChecks([
        { label: 'Has viewport meta tag', pass: !!p.viewport },
        { label: 'Viewport includes width=device-width', pass: /width\s*=\s*device-width/.test(p.viewport) },
        { label: 'Responsive CSS (media queries)', pass: /@media/.test(html) },
        { label: 'No Flash content', pass: !/<object[^>]*flash|\.swf/.test(html) },
        { label: 'Readable font size (uses rem/em or ≥14px)', pass: /font-size:\s*(\d{2,})(px|rem|em)/.test(html) || !/font-size/.test(html) },
      ]);
    } finally { setLoading(false); }
  };

  const passed = checks.filter((c) => c.pass).length;

  return (
    <ToolShell title="Mobile-Friendly Test" description="Basic mobile-readiness checks on any page.">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        <Button onClick={run} disabled={loading}>{loading ? 'Testing…' : 'Test'}</Button>
      </div>
      {error && <Card className="border-red-500"><CardContent className="p-4 text-red-600 text-sm">{error}</CardContent></Card>}
      {checks.length > 0 && (
        <Card><CardContent className="p-4 space-y-2">
          <div className="text-sm font-semibold">Passed: {passed} / {checks.length}</div>
          {checks.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-sm border-b last:border-0 py-1.5">
              {c.pass ? <Check className="h-4 w-4 text-green-600" /> : <X className="h-4 w-4 text-red-600" />}
              <span>{c.label}</span>
            </div>
          ))}
        </CardContent></Card>
      )}
    </ToolShell>
  );
}
