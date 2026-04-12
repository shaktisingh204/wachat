'use client';

import { useMemo, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function RobotsMetaPage() {
  const [flags, setFlags] = useState({ index: true, follow: true, noarchive: false, nosnippet: false, noimageindex: false });
  const toggle = (k: keyof typeof flags) => setFlags((f) => ({ ...f, [k]: !f[k] }));
  const content = useMemo(() => {
    const parts: string[] = [];
    parts.push(flags.index ? 'index' : 'noindex');
    parts.push(flags.follow ? 'follow' : 'nofollow');
    if (flags.noarchive) parts.push('noarchive');
    if (flags.nosnippet) parts.push('nosnippet');
    if (flags.noimageindex) parts.push('noimageindex');
    return parts.join(', ');
  }, [flags]);
  const output = `<meta name="robots" content="${content}" />`;

  return (
    <ToolShell title="Robots Meta Tag Generator" description="Generate a robots meta tag with your crawl preferences.">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {(Object.keys(flags) as (keyof typeof flags)[]).map((k) => (
          <div key={k} className="flex items-center gap-2">
            <Switch checked={flags[k]} onCheckedChange={() => toggle(k)} />
            <Label className="capitalize">{k}</Label>
          </div>
        ))}
      </div>
      <div className="font-mono text-sm bg-muted p-3 rounded">{output}</div>
      <Button onClick={() => navigator.clipboard.writeText(output)}>Copy</Button>
    </ToolShell>
  );
}
