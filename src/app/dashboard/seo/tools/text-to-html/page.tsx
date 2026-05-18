'use client';

import { cn as _zoruCn } from '@/components/zoruui';
void _zoruCn;

import { useMemo, useState } from 'react';
import { ZoruTextarea } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { textToHtml } from '@/lib/seo-tools/text-utils';

export default function TextToHtmlPage() {
  const [text, setText] = useState('');
  const html = useMemo(() => textToHtml(text), [text]);

  return (
    <ToolShell title="Text to HTML" description="Convert plain text into HTML paragraphs with line breaks.">
      <ZoruTextarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste plain text…" className="min-h-[220px]" />
      <div className="text-sm font-semibold">Output HTML</div>
      <ZoruTextarea readOnly value={html} className="min-h-[220px] font-mono text-xs" />
    </ToolShell>
  );
}
