'use client';

import { useMemo, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';

function md2html(md: string): string {
  let html = md
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/```([a-z]*)\n([\s\S]*?)```/g, (_, lang, code) => `<pre><code class="language-${lang}">${code}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^######\s+(.+)$/gm, '<h6>$1</h6>')
    .replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s+(.+)$/gm, '<h4>$1</h4>')
    .replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>').replace(/<\/ul>\s*<ul>/g, '');
  html = html.split(/\n{2,}/).map((p) => (/^\s*<(h\d|ul|pre|ol)/.test(p) ? p : p.trim() ? `<p>${p.replace(/\n/g, '<br />')}</p>` : '')).join('\n');
  return html;
}

export default function MarkdownToHtmlPage() {
  const [md, setMd] = useState('# Hello\n\nThis is **markdown** with [a link](https://example.com).');
  const html = useMemo(() => md2html(md), [md]);

  return (
    <ToolShell title="Markdown to HTML" description="Convert Markdown to HTML (basic subset: headings, bold, italic, links, lists, code).">
      <Textarea value={md} onChange={(e) => setMd(e.target.value)} className="min-h-[220px] font-mono text-xs" />
      <Textarea readOnly value={html} className="min-h-[220px] font-mono text-xs" />
    </ToolShell>
  );
}
