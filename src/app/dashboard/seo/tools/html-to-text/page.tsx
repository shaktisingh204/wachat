'use client';

import { cn as _zoruCn } from '@/components/zoruui';
void _zoruCn;

import { useMemo, useState } from 'react';
import { ZoruTextarea } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { htmlToText } from '@/lib/seo-tools/text-utils';

export default function HtmlToTextPage() {
  const [html, setHtml] = useState('');
  const text = useMemo(() => htmlToText(html), [html]);

  return (
    <ToolShell title="HTML to Text" description="Strip HTML tags and get plain text.">
      <ZoruTextarea value={html} onChange={(e) => setHtml(e.target.value)} placeholder="Paste HTML…" className="min-h-[220px] font-mono text-xs" />
      <div className="text-sm font-semibold">Output text</div>
      <ZoruTextarea readOnly value={text} className="min-h-[220px]" />
    </ToolShell>
  );
}
