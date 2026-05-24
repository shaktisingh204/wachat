'use client';

import { Button, Card, ZoruCardContent, Input, Label, Textarea, cn, Switch } from '@/components/zoruui';
import { cn as _zoruCn, useMemo, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function GaTagGeneratorPage() {
  const [id, setId] = useState('G-XXXXXXXXXX');
  const [copied, setCopied] = useState(false);
  
  const [advanced, setAdvanced] = useState(false);
  const [domains, setDomains] = useState('');

  const snippet = useMemo(() => {
    const safeId = (id || '').trim() || 'G-XXXXXXXXXX';
    const hasDomains = advanced && domains.trim().length > 0;
    
    let domainStr = '';
    if (hasDomains) {
      const domainList = domains
        .split(',')
        .map(d => d.trim())
        .filter(d => d.length > 0)
        .map(d => `'${d}'`)
        .join(', ');
      
      if (domainList) {
        domainStr = `\n  gtag('set', 'linker', {\n    'domains': [${domainList}]\n  });\n`;
      }
    }

    return `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${safeId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());${domainStr}
  gtag('config', '${safeId}');
</script>`;
  }, [id, advanced, domains]);

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
        <ZoruCardContent className="p-4 space-y-4">
          <div className="space-y-3">
            <Label htmlFor="ga-id">GA4 Measurement ID</Label>
            <Input
              id="ga-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="G-XXXXXXXXXX"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Advanced Configuration</Label>
              <p className="text-[0.8rem] text-muted-foreground">
                Enable cross-domain tracking
              </p>
            </div>
            <Switch
              checked={advanced}
              onCheckedChange={setAdvanced}
            />
          </div>

          {advanced && (
            <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label htmlFor="domains">Cross-Domain Tracking</Label>
              <Input
                id="domains"
                value={domains}
                onChange={(e) => setDomains(e.target.value)}
                placeholder="e.g. example.com, otherdomain.com"
              />
              <p className="text-[0.8rem] text-muted-foreground">
                Enter a comma-separated list of domains to track across.
              </p>
            </div>
          )}
        </ZoruCardContent>
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
