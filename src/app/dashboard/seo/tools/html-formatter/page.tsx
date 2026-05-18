'use client';

import { cn as _zoruCn } from '@/components/zoruui';
void _zoruCn;

import { useMemo, useState } from 'react';
import { ZoruTextarea } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';

function format(html: string): string {
  const tokens = html.replace(/>\s*</g, '>\n<').split('\n');
  let depth = 0;
  const out: string[] = [];
  const selfClosing = /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i;
  for (const token of tokens) {
    const t = token.trim();
    if (!t) continue;
    if (/^<\//.test(t)) depth = Math.max(0, depth - 1);
    out.push('  '.repeat(depth) + t);
    if (/^<[^!?/]/.test(t) && !/<\/[^>]+>\s*$/.test(t) && !selfClosing.test(t) && !/\/>$/.test(t)) depth++;
  }
  return out.join('\n');
}

export default function HtmlFormatterPage() {
  const [text, setText] = useState('');
  const out = useMemo(() => format(text), [text]);
  return (
    <ToolShell title="HTML Formatter" description="Pretty-print minified or messy HTML.">
      <ZoruTextarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[200px] font-mono text-xs" placeholder="Paste HTML…" />
      <ZoruTextarea readOnly value={out} className="min-h-[240px] font-mono text-xs" />
    </ToolShell>
  );
}
