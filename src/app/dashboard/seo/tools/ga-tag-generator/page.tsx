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
      <ZoruCard>
        <ZoruCardContent className="p-4 space-y-3">
          <ZoruLabel htmlFor="ga-id">GA4 Measurement ID</ZoruLabel>
          <ZoruInput
            id="ga-id"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="G-XXXXXXXXXX"
          />
        </ZoruCardContent>
      </ZoruCard>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <ZoruLabel>Generated snippet</ZoruLabel>
          <ZoruButton size="sm" variant="outline" onClick={handleCopy}>
            {copied ? 'Copied!' : 'Copy'}
          </ZoruButton>
        </div>
        <ZoruTextarea readOnly value={snippet} className="min-h-[220px] font-mono text-xs" />
        <p className="text-xs text-muted-foreground">
          Paste this snippet just before the closing &lt;/head&gt; tag on every page you want to track.
        </p>
      </div>
    </ToolShell>
  );
}
