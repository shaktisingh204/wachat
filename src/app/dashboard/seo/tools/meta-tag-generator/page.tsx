'use client';

import { Button, Input, Label, Textarea, Switch, cn } from '@/components/sabcrm/20ui';
import { useMemo, useState } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function MetaTagGeneratorPage() {
  const [fields, setFields] = useState({
    title: '', description: '', keywords: '', author: '', robots: 'index, follow',
    ogTitle: '', ogDescription: '', ogImage: '', ogUrl: '', twitterCard: 'summary_large_image',
  });
  const [enableOg, setEnableOg] = useState(false);
  const [enableTwitter, setEnableTwitter] = useState(false);

  const update = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));
  
  const output = useMemo(() => {
    const lines: string[] = [];
    if (fields.title) lines.push(`<title>${fields.title}</title>`);
    if (fields.description) lines.push(`<meta name="description" content="${fields.description}" />`);
    if (fields.keywords) lines.push(`<meta name="keywords" content="${fields.keywords}" />`);
    if (fields.author) lines.push(`<meta name="author" content="${fields.author}" />`);
    if (fields.robots) lines.push(`<meta name="robots" content="${fields.robots}" />`);
    
    if (enableOg) {
      if (fields.ogTitle || fields.title) lines.push(`<meta property="og:title" content="${fields.ogTitle || fields.title}" />`);
      if (fields.ogDescription || fields.description) lines.push(`<meta property="og:description" content="${fields.ogDescription || fields.description}" />`);
      if (fields.ogImage) lines.push(`<meta property="og:image" content="${fields.ogImage}" />`);
      if (fields.ogUrl) lines.push(`<meta property="og:url" content="${fields.ogUrl}" />`);
      lines.push(`<meta property="og:type" content="website" />`);
    }
    
    if (enableTwitter) {
      lines.push(`<meta name="twitter:card" content="${fields.twitterCard || 'summary_large_image'}" />`);
      if (fields.ogTitle || fields.title) lines.push(`<meta name="twitter:title" content="${fields.ogTitle || fields.title}" />`);
      if (fields.ogDescription || fields.description) lines.push(`<meta name="twitter:description" content="${fields.ogDescription || fields.description}" />`);
      if (fields.ogImage) lines.push(`<meta name="twitter:image" content="${fields.ogImage}" />`);
    }
    
    return lines.join('\n');
  }, [fields, enableOg, enableTwitter]);

  const getCounterColor = (current: number, optimal: number, max: number) => {
    if (current === 0) return 'text-[var(--st-text-secondary)]';
    if (current <= optimal) return 'text-[var(--st-text)] dark:text-[var(--st-text-secondary)]';
    if (current <= max) return 'text-[var(--st-text)] dark:text-[var(--st-text-secondary)] font-medium';
    return 'text-[var(--st-text)] dark:text-[var(--st-text-secondary)] font-bold';
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(output);
  };

  const getHostname = (url: string) => {
    if (!url) return 'example.com';
    try {
      return new URL(url.includes('http') ? url : `https://${url}`).hostname;
    } catch {
      return url;
    }
  };

  return (
    <ToolShell title="Meta Tag Generator" description="Generate meta title, description and Open Graph tags with SEO length guidelines.">
      {/* Google SERP Preview */}
      <div className="mb-8 border rounded-lg p-6 bg-white dark:bg-[var(--st-text)] shadow-sm flex flex-col gap-2">
        <h3 className="text-sm font-medium text-[var(--st-text-secondary)] mb-4 uppercase tracking-wider">Google Search Preview</h3>
        <div className="flex flex-col max-w-[600px] font-sans">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-7 h-7 bg-[var(--st-bg-muted)] rounded-full flex items-center justify-center overflow-hidden shrink-0">
               <svg className="w-4 h-4 text-[var(--st-text-secondary)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[14px] text-[var(--st-text)] dark:text-[var(--st-text-secondary)] leading-tight truncate">
                {getHostname(fields.ogUrl)}
              </span>
              <span className="text-[12px] text-[var(--st-text)] dark:text-[var(--st-text-secondary)] leading-tight truncate">
                {fields.ogUrl || 'https://www.example.com'}
              </span>
            </div>
          </div>
          <div className="text-[20px] text-[var(--st-text)] dark:text-[var(--st-text-secondary)] hover:underline cursor-pointer truncate leading-normal pt-1 pb-1">
            {fields.title || 'Standard SEO Title - Replace with your own'}
          </div>
          <div className="text-[14px] text-[var(--st-text)] dark:text-[var(--st-text-secondary)] mt-[3px] line-clamp-2 leading-[1.58]">
            {fields.description || 'A compelling description of your page for search results. This should summarize the content accurately and encourage clicks.'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="meta-title">Title</Label>
            <span className={cn("text-xs transition-colors", getCounterColor(fields.title.length, 50, 60))}>
              {fields.title.length}/60
            </span>
          </div>
          <Input id="meta-title" value={fields.title} onChange={(e) => update('title', e.target.value)} placeholder="Standard SEO title..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="meta-author">Author</Label>
          <Input id="meta-author" value={fields.author} onChange={(e) => update('author', e.target.value)} placeholder="e.g. John Doe" />
        </div>
        
        <div className="space-y-2 md:col-span-2">
          <div className="flex justify-between items-center">
            <Label htmlFor="meta-description">Description</Label>
            <span className={cn("text-xs transition-colors", getCounterColor(fields.description.length, 120, 160))}>
              {fields.description.length}/160
            </span>
          </div>
          <Textarea 
            id="meta-description" 
            value={fields.description} 
            onChange={(e) => update('description', e.target.value)} 
            placeholder="A compelling description of your page for search results..."
            className="h-20"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="meta-keywords">Keywords (Comma separated)</Label>
          <Input id="meta-keywords" value={fields.keywords} onChange={(e) => update('keywords', e.target.value)} placeholder="seo, tools, generator" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="meta-robots">Robots</Label>
          <Input id="meta-robots" value={fields.robots} onChange={(e) => update('robots', e.target.value)} placeholder="index, follow" />
        </div>

        {/* Toggles */}
        <div className="md:col-span-2 flex flex-col sm:flex-row gap-6 py-4 border-t border-b mt-4">
          <div className="flex items-center gap-3">
            <Switch 
              id="enable-og"
              checked={enableOg}
              onCheckedChange={setEnableOg}
            />
            <Label htmlFor="enable-og" className="cursor-pointer">Include Open Graph tags</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch 
              id="enable-twitter"
              checked={enableTwitter}
              onCheckedChange={setEnableTwitter}
            />
            <Label htmlFor="enable-twitter" className="cursor-pointer">Include Twitter Card tags</Label>
          </div>
        </div>

        {enableOg && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="og-title">OG Title</Label>
                <span className={cn("text-xs transition-colors", getCounterColor((fields.ogTitle || fields.title).length, 60, 95))}>
                  {(fields.ogTitle || fields.title).length}/95
                </span>
              </div>
              <Input id="og-title" value={fields.ogTitle} onChange={(e) => update('ogTitle', e.target.value)} placeholder={fields.title || "Open Graph Title..."} />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="og-description">OG Description</Label>
                <span className={cn("text-xs transition-colors", getCounterColor((fields.ogDescription || fields.description).length, 160, 200))}>
                  {(fields.ogDescription || fields.description).length}/200
                </span>
              </div>
              <Input id="og-description" value={fields.ogDescription} onChange={(e) => update('ogDescription', e.target.value)} placeholder={fields.description || "Open Graph Description..."} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="og-image">OG Image URL</Label>
              <Input id="og-image" value={fields.ogImage} onChange={(e) => update('ogImage', e.target.value)} placeholder="https://example.com/image.jpg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="og-url">OG URL</Label>
              <Input id="og-url" value={fields.ogUrl} onChange={(e) => update('ogUrl', e.target.value)} placeholder="https://example.com/page" />
            </div>
          </>
        )}

        {enableTwitter && (
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="twitter-card">Twitter Card Type</Label>
            <select
              id="twitter-card"
              value={fields.twitterCard}
              onChange={(e) => update('twitterCard', e.target.value)}
              className="flex h-10 w-full rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-sm ring-offset-zoru-surface file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--st-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-border)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="summary">Summary</option>
              <option value="summary_large_image">Summary Large Image</option>
              <option value="app">App</option>
              <option value="player">Player</option>
            </select>
          </div>
        )}
      </div>
      
      <div className="mt-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Generated Meta Tags</h3>
          <Button onClick={copyToClipboard} variant="secondary" size="sm">Copy Tags</Button>
        </div>
        <Textarea readOnly value={output} className="min-h-[240px] font-mono text-xs p-4 bg-[var(--st-bg-muted)]/30" />
      </div>
    </ToolShell>
  );
}
