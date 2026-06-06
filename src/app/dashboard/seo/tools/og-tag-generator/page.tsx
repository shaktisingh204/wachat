'use client';

import { Button, Input, Label, Textarea, cn } from '@/components/sabcrm/20ui/compat';
import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui/compat';



import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function OgTagGeneratorPage() {
  const [f, setF] = useState({ 
    title: '', 
    type: 'website', 
    url: '', 
    image: '', 
    description: '', 
    siteName: '',
    twitterCard: 'summary_large_image',
    twitterSite: '',
    twitterCreator: ''
  });
  
  const [previewMode, setPreviewMode] = useState<'facebook' | 'twitter' | 'linkedin'>('facebook');

  const update = (k: string, v: string) => setF((s) => ({ ...s, [k]: v }));
  
  const out = useMemo(() => [
    f.title && `<meta property="og:title" content="${f.title}" />`,
    f.type && `<meta property="og:type" content="${f.type}" />`,
    f.url && `<meta property="og:url" content="${f.url}" />`,
    f.image && `<meta property="og:image" content="${f.image}" />`,
    f.description && `<meta property="og:description" content="${f.description}" />`,
    f.siteName && `<meta property="og:site_name" content="${f.siteName}" />`,
    f.twitterCard && `<meta name="twitter:card" content="${f.twitterCard}" />`,
    f.title && `<meta name="twitter:title" content="${f.title}" />`,
    f.description && `<meta name="twitter:description" content="${f.description}" />`,
    f.image && `<meta name="twitter:image" content="${f.image}" />`,
    f.twitterSite && `<meta name="twitter:site" content="${f.twitterSite}" />`,
    f.twitterCreator && `<meta name="twitter:creator" content="${f.twitterCreator}" />`,
  ].filter(Boolean).join('\n'), [f]);

  const domain = useMemo(() => {
    try {
      if (!f.url) return 'example.com';
      return new URL(f.url.includes('http') ? f.url : `https://${f.url}`).hostname.toUpperCase();
    } catch {
      return 'EXAMPLE.COM';
    }
  }, [f.url]);
  
  const lowerDomain = domain.toLowerCase();

  return (
    <ToolShell title="Open Graph Generator" description="Generate Open Graph and Twitter Card meta tags for social sharing.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Title</Label><Input value={f.title} onChange={(e) => update('title', e.target.value)} placeholder="My Page Title" /></div>
            <div className="space-y-1.5"><Label>Type</Label><Input value={f.type} onChange={(e) => update('type', e.target.value)} placeholder="website" /></div>
            <div className="space-y-1.5"><Label>URL</Label><Input value={f.url} onChange={(e) => update('url', e.target.value)} placeholder="https://example.com" /></div>
            <div className="space-y-1.5"><Label>Image URL</Label><Input value={f.image} onChange={(e) => update('image', e.target.value)} placeholder="https://example.com/image.jpg" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Site name</Label><Input value={f.siteName} onChange={(e) => update('siteName', e.target.value)} placeholder="My Website" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label>Description</Label><Textarea value={f.description} onChange={(e) => update('description', e.target.value)} placeholder="A brief description of the page content." /></div>
            
            <div className="space-y-1.5 sm:col-span-2 mt-4">
                <Label className="text-base font-semibold">Twitter Card Details (Optional)</Label>
            </div>
            
            <div className="space-y-1.5">
                <Label>Twitter Card Type</Label>
                <Select value={f.twitterCard} onValueChange={(v) => update('twitterCard', v)}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select card type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="summary">Summary</SelectItem>
                        <SelectItem value="summary_large_image">Summary Large Image</SelectItem>
                        <SelectItem value="app">App</SelectItem>
                        <SelectItem value="player">Player</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label>Twitter Site Handle</Label>
                <Input value={f.twitterSite} onChange={(e) => update('twitterSite', e.target.value)} placeholder="@website_handle" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
                <Label>Twitter Creator Handle</Label>
                <Input value={f.twitterCreator} onChange={(e) => update('twitterCreator', e.target.value)} placeholder="@your_handle" />
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Generated HTML</Label>
              <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(out)}>Copy Code</Button>
            </div>
            <Textarea readOnly value={out} className="min-h-[160px] font-mono text-xs bg-zoru-surface-2" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Live Visual Preview</Label>
          </div>
          
          <div className="flex space-x-2 border-b pb-2">
             <Button variant={previewMode === 'facebook' ? 'default' : 'outline'} size="sm" onClick={() => setPreviewMode('facebook')} className="rounded-full">Facebook</Button>
             <Button variant={previewMode === 'twitter' ? 'default' : 'outline'} size="sm" onClick={() => setPreviewMode('twitter')} className="rounded-full">Twitter / X</Button>
             <Button variant={previewMode === 'linkedin' ? 'default' : 'outline'} size="sm" onClick={() => setPreviewMode('linkedin')} className="rounded-full">LinkedIn</Button>
          </div>

          <div className="mt-4 flex justify-center bg-zoru-surface-2 p-6 rounded-lg border border-zoru-line">
            {previewMode === 'facebook' && (
                <div className="border border-zoru-line rounded-lg overflow-hidden bg-white shadow-sm w-full max-w-[500px]">
                    {f.image ? (
                    <div className="w-full aspect-[1.91/1] bg-zoru-surface-2 relative overflow-hidden border-b border-zoru-line">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                        src={f.image} 
                        alt="Preview" 
                        className="object-cover w-full h-full" 
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlMGUwZTAiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbnZhbGlkIEltYWdlIFVSTDwvdGV4dD48L3N2Zz4='
                        }} 
                        />
                    </div>
                    ) : (
                    <div className="w-full aspect-[1.91/1] bg-zoru-surface-2 flex items-center justify-center text-zoru-ink border-b border-zoru-line">
                        <span className="font-medium">Image Preview</span>
                    </div>
                    )}
                    <div className="p-3 bg-zoru-surface text-left">
                        <div className="text-[12px] text-zoru-ink uppercase tracking-wider mb-1 truncate font-sans">
                            {domain}
                        </div>
                        <div className="font-semibold text-[16px] leading-tight text-zoru-ink line-clamp-1 mb-1 font-sans">
                            {f.title || 'Page Title'}
                        </div>
                        <div className="text-[14px] text-zoru-ink line-clamp-2 leading-snug font-sans">
                            {f.description || 'Page description goes here. It provides a brief summary of the content to entice users to click the link.'}
                        </div>
                    </div>
                </div>
            )}

            {previewMode === 'twitter' && (
                f.twitterCard === 'summary_large_image' ? (
                <div className="border border-zoru-line rounded-2xl overflow-hidden bg-white w-full max-w-[500px] cursor-pointer hover:bg-zoru-surface-2 transition-colors">
                    {f.image ? (
                    <div className="w-full aspect-[1.91/1] bg-zoru-surface-2 relative overflow-hidden border-b border-zoru-line">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                        src={f.image} 
                        alt="Preview" 
                        className="object-cover w-full h-full" 
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlMGUwZTAiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbnZhbGlkIEltYWdlIFVSTDwvdGV4dD48L3N2Zz4='
                        }} 
                        />
                    </div>
                    ) : (
                    <div className="w-full aspect-[1.91/1] bg-zoru-surface-2 flex items-center justify-center text-zoru-ink border-b border-zoru-line">
                        <span className="font-medium">Image Preview</span>
                    </div>
                    )}
                    <div className="p-3 text-left bg-white">
                        <div className="text-[15px] text-zoru-ink mb-0.5 font-sans flex items-center gap-1 line-clamp-1">
                            {lowerDomain}
                        </div>
                        <div className="text-[15px] font-medium text-zoru-ink line-clamp-1 font-sans">
                            {f.title || 'Page Title'}
                        </div>
                        <div className="text-[15px] text-zoru-ink line-clamp-2 mt-0.5 font-sans">
                            {f.description || 'Page description goes here. It provides a brief summary of the content to entice users to click the link.'}
                        </div>
                    </div>
                </div>
                ) : (
                <div className="border border-zoru-line rounded-2xl overflow-hidden bg-white w-full max-w-[500px] cursor-pointer hover:bg-zoru-surface-2 transition-colors flex h-[130px]">
                    {f.image ? (
                    <div className="w-[130px] h-full bg-zoru-surface-2 relative overflow-hidden border-r border-zoru-line shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                        src={f.image} 
                        alt="Preview" 
                        className="object-cover w-full h-full" 
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlMGUwZTAiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbnZhbGlkIEltYWdlIFVSTDwvdGV4dD48L3N2Zz4='
                        }} 
                        />
                    </div>
                    ) : (
                    <div className="w-[130px] h-full bg-zoru-surface-2 flex items-center justify-center text-zoru-ink border-r border-zoru-line shrink-0">
                        <span className="font-medium text-xs">Image</span>
                    </div>
                    )}
                    <div className="p-3 text-left bg-white flex flex-col justify-center overflow-hidden">
                        <div className="text-[15px] font-medium text-zoru-ink line-clamp-1 font-sans">
                            {f.title || 'Page Title'}
                        </div>
                        <div className="text-[15px] text-zoru-ink line-clamp-2 mt-0.5 font-sans">
                            {f.description || 'Page description goes here. It provides a brief summary of the content to entice users to click the link.'}
                        </div>
                        <div className="text-[15px] text-zoru-ink mt-1 font-sans flex items-center gap-1 line-clamp-1">
                            <svg viewBox="0 0 24 24" aria-hidden="true" className="w-4 h-4 fill-current"><g><path d="M11.96 14.945c-.067 0-.136-.01-.203-.027-1.13-.318-2.097-.986-2.795-1.932-.832-1.125-1.176-2.508-.968-3.893s.942-2.605 2.068-3.438l3.53-2.608c2.322-1.716 5.61-1.224 7.33 1.1.83 1.127 1.175 2.51.967 3.895s-.943 2.605-2.07 3.438l-1.48 1.094c-.333.246-.804.175-1.05-.158-.246-.334-.176-.804.158-1.05l1.48-1.095c.803-.592 1.327-1.463 1.476-2.45.148-.988-.098-1.975-.696-2.78-1.22-1.656-3.556-2.01-5.212-.79l-3.53 2.608c-.802.593-1.326 1.464-1.475 2.45-.15.99.097 1.975.696 2.78.498.676 1.187 1.15 1.992 1.377.4.114.633.528.52.928-.092.33-.394.547-.722.547z"></path><path d="M7.27 22.054c-1.61 0-3.197-.735-4.225-2.125-.832-1.127-1.176-2.51-.968-3.894s.943-2.605 2.07-3.438l1.478-1.094c.334-.245.805-.175 1.05.158s.177.804-.157 1.05l-1.48 1.095c-.803.593-1.326 1.464-1.475 2.45-.148.99.097 1.975.696 2.78 1.22 1.657 3.555 2.01 5.213.79l3.528-2.608c.802-.593 1.326-1.464 1.475-2.45.148-.99-.097-1.975-.696-2.78-.498-.676-1.187-1.15-1.992-1.376-.4-.113-.633-.527-.52-.927.112-.4.528-.63.926-.522 1.13.318 2.096.986 2.794 1.932.833 1.126 1.176 2.51.968 3.895s-.942 2.605-2.068 3.438l-3.53 2.608c-.933.693-2.023 1.026-3.105 1.026z"></path></g></svg>
                            {lowerDomain}
                        </div>
                    </div>
                </div>
                )
            )}

            {previewMode === 'linkedin' && (
                <div className="bg-white overflow-hidden w-full max-w-[500px] border border-zoru-line shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
                    {f.image ? (
                    <div className="w-full aspect-[1.91/1] bg-zoru-surface-2 relative overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                        src={f.image} 
                        alt="Preview" 
                        className="object-cover w-full h-full" 
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlMGUwZTAiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbnZhbGlkIEltYWdlIFVSTDwvdGV4dD48L3N2Zz4='
                        }} 
                        />
                    </div>
                    ) : (
                    <div className="w-full aspect-[1.91/1] bg-zoru-surface-2 flex items-center justify-center text-zoru-ink">
                        <span className="font-medium">Image Preview</span>
                    </div>
                    )}
                    <div className="pt-2 pb-4 px-4 text-left bg-zoru-surface">
                        <div className="font-semibold text-[14px] leading-tight text-zoru-ink line-clamp-2 mb-1 font-sans">
                            {f.title || 'Page Title'}
                        </div>
                        <div className="text-[12px] text-zoru-ink uppercase tracking-wider mb-1 truncate font-sans">
                            {lowerDomain}
                        </div>
                    </div>
                </div>
            )}
          </div>
          
          <p className="text-xs text-zoru-ink max-w-[500px]">
            This is an approximate preview of how your link will appear when shared on {previewMode === 'facebook' ? 'Facebook' : previewMode === 'twitter' ? 'Twitter' : 'LinkedIn'}.
          </p>
        </div>
      </div>
    </ToolShell>
  );
}
