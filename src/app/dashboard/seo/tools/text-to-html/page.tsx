'use client';

import { Textarea, cn } from '@/components/sabcrm/20ui/compat';
import { cn as _zoruCn, useMemo, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { textToHtml } from '@/lib/seo-tools/text-utils';

export default function TextToHtmlPage() {
  const [text, setText] = useState('');
  const html = useMemo(() => textToHtml(text), [text]);

  const srcDoc = useMemo(() => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            line-height: 1.5;
            color: #333;
            padding: 16px;
            margin: 0;
            word-wrap: break-word;
          }
          a { color: #2563eb; text-decoration: none; }
          a:hover { text-decoration: underline; }
          strong { font-weight: 600; }
          em { font-style: italic; }
          h1, h2, h3, h4, h5, h6 { margin-top: 24px; margin-bottom: 16px; font-weight: 600; line-height: 1.25; }
          h1 { font-size: 2em; }
          h2 { font-size: 1.5em; }
          h3 { font-size: 1.25em; }
          p { margin-top: 0; margin-bottom: 16px; }
          @media (prefers-color-scheme: dark) {
            body { color: #e5e7eb; background: transparent; }
            a { color: #60a5fa; }
          }
        </style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `;
  }, [html]);

  return (
    <ToolShell title="Text to HTML" description="Convert plain text and minimal Markdown into HTML paragraphs.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold">Input Text</div>
          <Textarea 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            placeholder="Paste plain text or simple markdown here…" 
            className="min-h-[300px] resize-y" 
          />
        </div>
        
        <div className="flex flex-col gap-2">
          <div className="text-sm font-semibold">Output HTML</div>
          <Textarea 
            readOnly 
            value={html} 
            className="min-h-[300px] font-mono text-xs resize-y" 
          />
        </div>
      </div>
      
      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold">Preview</div>
        <div className="rounded-md border bg-zoru-surface overflow-hidden min-h-[300px] flex">
          <iframe
            srcDoc={srcDoc}
            title="HTML Preview"
            className="w-full flex-1 border-none min-h-[300px] bg-transparent"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </ToolShell>
  );
}
