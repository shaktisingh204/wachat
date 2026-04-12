'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function GtmSnippetPage() {
  const [id, setId] = useState('GTM-XXXXXXX');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { head, body } = useMemo(() => {
    const safeId = (id || '').trim() || 'GTM-XXXXXXX';
    const headSnippet = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${safeId}');</script>
<!-- End Google Tag Manager -->`;
    const bodySnippet = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${safeId}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;
    return { head: headSnippet, body: bodySnippet };
  }, [id]);

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <ToolShell
      title="GTM Snippet Generator"
      description="Generate Google Tag Manager head and body snippets for your website."
    >
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="gtm-id">GTM Container ID</Label>
          <Input
            id="gtm-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="GTM-XXXXXXX"
          />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Head snippet (paste in &lt;head&gt;)</Label>
          <Button size="sm" variant="outline" onClick={() => copy('head', head)}>
            {copiedKey === 'head' ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <Textarea readOnly value={head} className="min-h-[180px] font-mono text-xs" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Body snippet (paste just after &lt;body&gt;)</Label>
          <Button size="sm" variant="outline" onClick={() => copy('body', body)}>
            {copiedKey === 'body' ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <Textarea readOnly value={body} className="min-h-[120px] font-mono text-xs" />
      </div>
    </ToolShell>
  );
}
