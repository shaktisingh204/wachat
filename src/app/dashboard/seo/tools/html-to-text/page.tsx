'use client';

import { ZoruTextarea, cn } from '@/components/zoruui';
import { cn as _zoruCn, useMemo, useState } from 'react';

void _zoruCn;

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
