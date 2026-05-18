'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useMemo, useState } from 'react';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
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
      <ZoruCard>
        <ZoruCardContent className="p-4 space-y-3">
          <ZoruLabel htmlFor="gtm-id">GTM Container ID</ZoruLabel>
          <ZoruInput
            id="gtm-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="GTM-XXXXXXX"
          />
        </ZoruCardContent>
      </ZoruCard>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <ZoruLabel>Head snippet (paste in &lt;head&gt;)</ZoruLabel>
          <ZoruButton size="sm" variant="outline" onClick={() => copy('head', head)}>
            {copiedKey === 'head' ? 'Copied!' : 'Copy'}
          </ZoruButton>
        </div>
        <ZoruTextarea readOnly value={head} className="min-h-[180px] font-mono text-xs" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <ZoruLabel>Body snippet (paste just after &lt;body&gt;)</ZoruLabel>
          <ZoruButton size="sm" variant="outline" onClick={() => copy('body', body)}>
            {copiedKey === 'body' ? 'Copied!' : 'Copy'}
          </ZoruButton>
        </div>
        <ZoruTextarea readOnly value={body} className="min-h-[120px] font-mono text-xs" />
      </div>
    </ToolShell>
  );
}
