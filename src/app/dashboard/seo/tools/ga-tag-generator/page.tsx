'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function GaTagGeneratorPage() {
  const [id, setId] = useState('G-XXXXXXXXXX');
  const [copied, setCopied] = useState(false);

  const snippet = useMemo(() => {
    const safeId = (id || '').trim() || 'G-XXXXXXXXXX';
    return `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${safeId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', '${safeId}');
</script>`;
  }, [id]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <ToolShell
      title="GA4 Tag Generator"
      description="Generate the Google Analytics 4 gtag.js snippet for your website."
    >
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="ga-id">GA4 Measurement ID</Label>
          <Input
            id="ga-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="G-XXXXXXXXXX"
          />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Generated snippet</Label>
          <Button size="sm" variant="outline" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <Textarea readOnly value={snippet} className="min-h-[220px] font-mono text-xs" />
        <p className="text-xs text-muted-foreground">
          Paste this snippet just before the closing &lt;/head&gt; tag on every page you want to track.
        </p>
      </div>
    </ToolShell>
  );
}
