'use client';

import { useMemo, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function JsMinifierPage() {
  const [text, setText] = useState('');
  // Naive minifier: strips comments and extra whitespace. Does NOT preserve strings perfectly.
  const min = useMemo(
    () =>
      text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
        .replace(/\n+/g, '\n')
        .replace(/\s*([{};,()\[\]=+\-*/<>!&|])\s*/g, '$1')
        .trim(),
    [text],
  );
  return (
    <ToolShell title="JS Minifier" description="Naive JavaScript minifier (strips comments + whitespace). Avoid on code with strings containing those chars.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[200px] font-mono text-xs" placeholder="Paste JS…" />
      <div className="text-sm text-muted-foreground">{text.length} → {min.length} bytes</div>
      <Textarea readOnly value={min} className="min-h-[200px] font-mono text-xs" />
    </ToolShell>
  );
}
