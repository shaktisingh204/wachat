'use client';

import { Textarea, cn } from '@/components/zoruui';
import { cn as _zoruCn, useMemo, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

import TurndownService from 'turndown';

function html2md(html: string): string {
  if (!html) return '';
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
  });
  
  try {
    return turndownService.turndown(html);
  } catch (error) {
    console.error('Error converting HTML to Markdown:', error);
    return 'Error converting HTML to Markdown';
  }
}

export default function HtmlToMarkdownPage() {
  const [html, setHtml] = useState('');
  const md = useMemo(() => html2md(html), [html]);
  return (
    <ToolShell title="HTML to Markdown" description="Convert basic HTML to Markdown.">
      <Textarea value={html} onChange={(e) => setHtml(e.target.value)} className="min-h-[220px] font-mono text-xs" placeholder="Paste HTML…" />
      <Textarea readOnly value={md} className="min-h-[220px] font-mono text-xs" />
    </ToolShell>
  );
}
