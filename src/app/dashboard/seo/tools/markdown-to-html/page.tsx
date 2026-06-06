'use client';

import { Textarea, cn, Switch, Label, Button } from '@/components/sabcrm/20ui/compat';
import { useState, useMemo } from 'react';
import { marked, type MarkedOptions } from 'marked';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Copy, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

function md2html(md: string, options: MarkedOptions): string {
  try {
    return marked.parse(md, options) as string;
  } catch (error) {
    console.error('Error parsing markdown:', error);
    return 'Error parsing markdown';
  }
}

export default function MarkdownToHtmlPage() {
  const [md, setMd] = useState('# Hello\n\nThis is **markdown** with [a link](https://example.com).\n\n- [ ] Task 1\n- [x] Task 2\n\n| Column 1 | Column 2 |\n| -------- | -------- |\n| Value 1  | Value 2  |');
  const [gfm, setGfm] = useState(true);
  const [breaks, setBreaks] = useState(false);
  const [view, setView] = useState<'html' | 'preview'>('preview');

  const html = useMemo(() => md2html(md, { gfm, breaks }), [md, gfm, breaks]);

  const copyHtml = () => {
    navigator.clipboard.writeText(html);
    toast.success('Copied HTML to clipboard');
  };

  const clearMd = () => {
    setMd('');
    toast.success('Cleared markdown');
  };

  return (
    <ToolShell title="Markdown to HTML" description="Convert Markdown to HTML using a robust standard parser.">
      <div className="flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[var(--st-bg-secondary)] p-4 rounded-xl border border-[var(--st-border)]">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center space-x-2">
              <Switch id="gfm" checked={gfm} onCheckedChange={setGfm} />
              <Label htmlFor="gfm" className="text-sm font-medium cursor-pointer">
                GitHub Flavored Markdown
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch id="breaks" checked={breaks} onCheckedChange={setBreaks} />
              <Label htmlFor="breaks" className="text-sm font-medium cursor-pointer">
                Line Breaks
              </Label>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={clearMd} className="flex-1 sm:flex-none">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
            <Button variant="outline" size="sm" onClick={copyHtml} className="flex-1 sm:flex-none">
              <Copy className="w-4 h-4 mr-2" />
              Copy HTML
            </Button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label className="font-semibold text-[var(--st-text)]">Markdown Input</Label>
            <Textarea 
              value={md} 
              onChange={(e) => setMd(e.target.value)} 
              className="h-[500px] resize-none font-mono text-sm p-4 bg-[var(--st-bg)]" 
              placeholder="Enter your markdown here..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-[var(--st-text)]">Output</Label>
              <div className="flex bg-[var(--st-border)] rounded-lg p-1">
                <button
                  onClick={() => setView('html')}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                    view === 'html' ? "bg-[var(--st-bg)] text-[var(--st-text)] shadow-sm" : "text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                  )}
                >
                  HTML
                </button>
                <button
                  onClick={() => setView('preview')}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                    view === 'preview' ? "bg-[var(--st-bg)] text-[var(--st-text)] shadow-sm" : "text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                  )}
                >
                  Preview
                </button>
              </div>
            </div>
            
            {view === 'html' ? (
              <Textarea 
                readOnly 
                value={html} 
                className="h-[500px] resize-none font-mono text-sm p-4 bg-[var(--st-bg-secondary)] border-[var(--st-border)]" 
              />
            ) : (
              <div className="h-[500px] overflow-auto p-4 bg-[var(--st-bg-secondary)] border border-[var(--st-border)] rounded-[var(--st-radius)]">
                <div 
                  className="prose prose-sm dark:prose-invert max-w-none
                             [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:border-b [&_h1]:border-[var(--st-border-strong)] [&_h1]:pb-2
                             [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:border-b [&_h2]:border-[var(--st-border-strong)] [&_h2]:pb-2
                             [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mb-3 [&_h3]:mt-4
                             [&_p]:mb-4 [&_p]:leading-relaxed
                             [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4
                             [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4
                             [&_li]:mb-1
                             [&_a]:text-[var(--st-text)] [&_a]:underline
                             [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--st-border-strong)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--st-text-secondary)] [&_blockquote]:my-4
                             [&_pre]:bg-[var(--st-border)] [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:mb-4
                             [&_code]:bg-[var(--st-border)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:font-mono [&_code]:text-sm
                             [&_table]:w-full [&_table]:mb-4 [&_table]:border-collapse
                             [&_th]:border [&_th]:border-[var(--st-border-strong)] [&_th]:p-2 [&_th]:bg-[var(--st-bg-muted)] [&_th]:text-left [&_th]:font-semibold
                             [&_td]:border [&_td]:border-[var(--st-border-strong)] [&_td]:p-2
                             [&_input[type=checkbox]]:mr-2 [&_input[type=checkbox]]:mt-1
                             [&_li>input[type=checkbox]]:absolute [&_li>input[type=checkbox]]:-ml-6
                             [&_img]:max-w-full [&_img]:rounded-lg [&_hr]:border-[var(--st-border-strong)] [&_hr]:my-8"
                  dangerouslySetInnerHTML={{ __html: html }} 
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
