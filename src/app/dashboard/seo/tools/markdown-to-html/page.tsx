'use client';

import { Textarea, cn } from '@/components/zoruui';
import { cn as _zoruCn, useMemo, useState } from 'react';

void _zoruCn;

import { marked } from 'marked';
import { ToolShell } from '@/components/seo-tools/tool-shell';

function md2html(md: string): string {
  try {
    return marked.parse(md) as string;
  } catch (error) {
    console.error('Error parsing markdown:', error);
    return 'Error parsing markdown';
  }
}

export default function MarkdownToHtmlPage() {
  const [md, setMd] = useState('# Hello\n\nThis is **markdown** with [a link](https://example.com).');
  const html = useMemo(() => md2html(md), [md]);

  return (
    <ToolShell title="Markdown to HTML" description="Convert Markdown to HTML using a robust standard parser.">
      <Textarea value={md} onChange={(e) => setMd(e.target.value)} className="min-h-[220px] font-mono text-xs" />
      <Textarea readOnly value={html} className="min-h-[220px] font-mono text-xs" />
    </ToolShell>
  );
}
