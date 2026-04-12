'use client';

import { useMemo, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function HtmlMinifierPage() {
  const [text, setText] = useState('');
  const min = useMemo(() => text.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\s{2,}/g, ' ').trim(), [text]);
  return (
    <ToolShell title="HTML Minifier" description="Remove whitespace and comments from HTML.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[200px] font-mono text-xs" placeholder="Paste HTML…" />
      <div className="text-sm text-muted-foreground">{text.length} → {min.length} bytes ({text.length ? ((1 - min.length / text.length) * 100).toFixed(1) : 0}% saved)</div>
      <Textarea readOnly value={min} className="min-h-[200px] font-mono text-xs" />
    </ToolShell>
  );
}
