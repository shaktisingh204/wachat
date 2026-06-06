'use client';

import {
  Textarea,
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Card
} from '@/components/sabcrm/20ui/compat';
import { useZoruToast } from '@/components/sabcrm/20ui/compat';
import { useMemo, useState, useEffect } from 'react';
import { Copy, Check, Settings2 } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

import TurndownService from 'turndown';
const { gfm } = require('turndown-plugin-gfm');

export default function HtmlToMarkdownPage() {
  const [html, setHtml] = useState('<h1>Hello World</h1>\n<p>This is a <strong>bold</strong> statement.</p>\n<ul>\n  <li>List item 1</li>\n  <li>List item 2</li>\n</ul>\n<table>\n  <tr><th>Header 1</th><th>Header 2</th></tr>\n  <tr><td>Cell 1</td><td>Cell 2</td></tr>\n</table>\n<blockquote>Quote goes here</blockquote>\n<img src="image.jpg" alt="Description" />');
  const [mounted, setMounted] = useState(false);

  // Turndown Settings
  const [headingStyle, setHeadingStyle] = useState<'atx' | 'setext'>('atx');
  const [hr, setHr] = useState<'* * *' | '- - -' | '_ _ _'>('* * *');
  const [bulletListMarker, setBulletListMarker] = useState<'-' | '*' | '+'>('-');
  const [codeBlockStyle, setCodeBlockStyle] = useState<'indented' | 'fenced'>('fenced');
  const [emDelimiter, setEmDelimiter] = useState<'_' | '*'>('_');
  const [strongDelimiter, setStrongDelimiter] = useState<'**' | '__'>('**');
  const [linkStyle, setLinkStyle] = useState<'inlined' | 'referenced'>('inlined');

  useEffect(() => {
    setMounted(true);
  }, []);

  const md = useMemo(() => {
    if (!html) return '';
    try {
      const turndownService = new TurndownService({
        headingStyle,
        hr,
        bulletListMarker,
        codeBlockStyle,
        emDelimiter,
        strongDelimiter,
        linkStyle
      });
      // Plugin for tables, strikethrough, etc.
      turndownService.use(gfm);
      return turndownService.turndown(html);
    } catch (error) {
      console.error('Error converting HTML to Markdown:', error);
      return 'Error converting HTML to Markdown';
    }
  }, [html, headingStyle, hr, bulletListMarker, codeBlockStyle, emDelimiter, strongDelimiter, linkStyle]);

  const { toast } = useZoruToast();
  const [isCopied, setIsCopied] = useState(false);

  const copyToClipboard = async () => {
    if (!md) return;
    try {
      await navigator.clipboard.writeText(md);
      setIsCopied(true);
      toast({
        title: "Copied!",
        description: "Markdown copied to clipboard.",
      });
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try selecting the text and copying manually.",
      });
    }
  };

  if (!mounted) {
    return null; // Avoid hydration mismatch on initial render
  }

  return (
    <ToolShell 
      title="HTML to Markdown" 
      description="Convert HTML to Markdown with GFM support (tables, blockquotes, images)."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="flex flex-col gap-3">
          <Label className="text-sm font-medium">HTML Input</Label>
          <Textarea 
            value={html} 
            onChange={(e) => setHtml(e.target.value)} 
            className="min-h-[400px] font-mono text-sm p-4 resize-y shadow-sm" 
            placeholder="<h1>Hello World</h1>..." 
          />
        </div>
        
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Markdown Output</Label>
            <Button variant="outline" size="sm" onClick={copyToClipboard} disabled={!md}>
              {isCopied ? <Check className="w-4 h-4 mr-2 text-zoru-ink" /> : <Copy className="w-4 h-4 mr-2" />}
              {isCopied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <Textarea 
            readOnly 
            value={md} 
            className="min-h-[400px] font-mono text-sm bg-zoru-surface-2/30 p-4 resize-y shadow-sm" 
            placeholder="# Hello World..." 
          />
        </div>
      </div>

      <Card className="mt-8 p-6 shadow-sm border-zoru-line/50 bg-zoru-surface/50 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-6">
          <Settings2 className="w-5 h-5 text-zoru-ink" />
          <h3 className="text-lg font-semibold m-0">Conversion Settings</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-6">
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-zoru-ink-muted font-semibold uppercase tracking-wider">Heading Style</Label>
            <Select value={headingStyle} onValueChange={(v: any) => setHeadingStyle(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="atx">ATX (# Heading)</SelectItem>
                <SelectItem value="setext">Setext (Heading =)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex flex-col gap-2">
            <Label className="text-xs text-zoru-ink-muted font-semibold uppercase tracking-wider">Code Block Style</Label>
            <Select value={codeBlockStyle} onValueChange={(v: any) => setCodeBlockStyle(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fenced">Fenced (```)</SelectItem>
                <SelectItem value="indented">Indented (4 spaces)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-zoru-ink-muted font-semibold uppercase tracking-wider">Bullet List Marker</Label>
            <Select value={bulletListMarker} onValueChange={(v: any) => setBulletListMarker(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="-">Dash (-)</SelectItem>
                <SelectItem value="*">Asterisk (*)</SelectItem>
                <SelectItem value="+">Plus (+)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-zoru-ink-muted font-semibold uppercase tracking-wider">Horizontal Rule</Label>
            <Select value={hr} onValueChange={(v: any) => setHr(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="* * *">Asterisks (* * *)</SelectItem>
                <SelectItem value="- - -">Dashes (- - -)</SelectItem>
                <SelectItem value="_ _ _">Underscores (_ _ _)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-zoru-ink-muted font-semibold uppercase tracking-wider">Strong Delimiter</Label>
            <Select value={strongDelimiter} onValueChange={(v: any) => setStrongDelimiter(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="**">Asterisks (**)</SelectItem>
                <SelectItem value="__">Underscores (__)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-zoru-ink-muted font-semibold uppercase tracking-wider">Em Delimiter</Label>
            <Select value={emDelimiter} onValueChange={(v: any) => setEmDelimiter(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">Underscores (_)</SelectItem>
                <SelectItem value="*">Asterisks (*)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs text-zoru-ink-muted font-semibold uppercase tracking-wider">Link Style</Label>
            <Select value={linkStyle} onValueChange={(v: any) => setLinkStyle(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inlined">Inlined</SelectItem>
                <SelectItem value="referenced">Referenced</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>
    </ToolShell>
  );
}
