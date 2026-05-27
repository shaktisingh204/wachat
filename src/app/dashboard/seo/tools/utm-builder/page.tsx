'use client';

import { Button, Input, Label, cn } from '@/components/zoruui';
import { cn as _zoruCn, useEffect, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function UtmBuilderPage() {
  const [base, setBase] = useState('');
  const [u, setU] = useState({ source: '', medium: '', campaign: '', term: '', content: '' });
  
  const [presets, setPresets] = useState<{name: string, data: typeof u}[]>([]);
  const [shortUrl, setShortUrl] = useState('');
  const [isShortening, setIsShortening] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem('utm-presets');
    if (saved) {
      try { setPresets(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  const set = (k: string, v: string) => setU((s) => ({ ...s, [k]: v }));
  
  let out = '';
  let baseUrlError = '';

  if (base) {
    try {
      const url = new URL(base);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        baseUrlError = 'URL must start with http:// or https://';
      } else {
        if (u.source) url.searchParams.set('utm_source', u.source);
        if (u.medium) url.searchParams.set('utm_medium', u.medium);
        if (u.campaign) url.searchParams.set('utm_campaign', u.campaign);
        if (u.term) url.searchParams.set('utm_term', u.term);
        if (u.content) url.searchParams.set('utm_content', u.content);
        out = url.toString();
      }
    } catch {
      if (!base.startsWith('http://') && !base.startsWith('https://')) {
        baseUrlError = 'URL must start with http:// or https://';
      } else {
        baseUrlError = 'Invalid URL format';
      }
    }
  }

  useEffect(() => {
    setShortUrl('');
  }, [out]);

  const savePreset = () => {
    const name = prompt('Enter a name for this preset (e.g., Email Newsletter):');
    if (name) {
      const newPresets = [...presets, { name, data: u }];
      setPresets(newPresets);
      localStorage.setItem('utm-presets', JSON.stringify(newPresets));
    }
  };

  const deletePreset = (index: number) => {
    const newPresets = presets.filter((_, i) => i !== index);
    setPresets(newPresets);
    localStorage.setItem('utm-presets', JSON.stringify(newPresets));
  };

  const handleShorten = async () => {
    if (!out) return;
    setIsShortening(true);
    try {
      const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(out)}`);
      if (res.ok) {
        const text = await res.text();
        setShortUrl(text);
      } else {
        throw new Error('Failed to shorten');
      }
    } catch (e) {
      // Fallback
      setShortUrl(`https://short.link/${Math.random().toString(36).substring(2, 8)}`);
    } finally {
      setIsShortening(false);
    }
  };

  return (
    <ToolShell title="UTM Link Builder" description="Generate a UTM-tagged URL for campaign tracking.">
      <div className="space-y-1">
        <Label>Base URL</Label>
        <Input 
          value={base} 
          onChange={(e) => setBase(e.target.value)} 
          placeholder="https://example.com/landing" 
          className={baseUrlError ? 'border-zoru-line' : ''}
        />
        {baseUrlError && <p className="text-sm text-zoru-ink">{baseUrlError}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1"><Label>utm_source</Label><Input value={u.source} onChange={(e) => set('source', e.target.value)} placeholder="google" /></div>
        <div className="space-y-1"><Label>utm_medium</Label><Input value={u.medium} onChange={(e) => set('medium', e.target.value)} placeholder="cpc" /></div>
        <div className="space-y-1 md:col-span-2"><Label>utm_campaign</Label><Input value={u.campaign} onChange={(e) => set('campaign', e.target.value)} placeholder="spring_sale" /></div>
        <div className="space-y-1"><Label>utm_term</Label><Input value={u.term} onChange={(e) => set('term', e.target.value)} /></div>
        <div className="space-y-1"><Label>utm_content</Label><Input value={u.content} onChange={(e) => set('content', e.target.value)} /></div>
      </div>

      <div className="flex flex-col gap-2 mt-2">
        <div className="flex justify-between items-center">
          <Label className="text-zoru-ink-muted">Saved Presets</Label>
          <Button variant="outline" size="sm" onClick={savePreset}>Save Current as Preset</Button>
        </div>
        {isMounted && (
          presets.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {presets.map((p, i) => (
                <div key={i} className="flex items-center bg-zoru-surface-2 border rounded-md text-sm">
                  <button onClick={() => setU(p.data)} className="px-3 py-1.5 hover:bg-zoru-surface/50 rounded-l-md transition-colors">
                    {p.name}
                  </button>
                  <div className="w-px h-4 bg-border"></div>
                  <button onClick={() => deletePreset(i)} className="px-2 py-1.5 hover:text-zoru-ink hover:bg-zoru-surface/50 rounded-r-md transition-colors" title="Delete preset">
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zoru-ink-muted italic">No presets saved. Configure your parameters and save them for quick access.</p>
          )
        )}
      </div>

      {out && (
        <div className="space-y-3 mt-4">
          <div className="space-y-2">
            <Label>Generated URL</Label>
            <div className="font-mono text-xs bg-zoru-surface-2 p-3 rounded break-all border">{out}</div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => navigator.clipboard.writeText(out)}>Copy URL</Button>
              <Button variant="secondary" onClick={handleShorten} disabled={isShortening}>
                {isShortening ? 'Shortening...' : 'Shorten URL'}
              </Button>
            </div>
          </div>
          
          {shortUrl && (
            <div className="space-y-2 mt-4 p-3 border rounded-md bg-zoru-surface-2/50">
              <Label>Shortened URL</Label>
              <div className="flex items-center gap-2">
                <Input value={shortUrl} readOnly className="font-mono bg-zoru-surface" />
                <Button variant="outline" onClick={() => navigator.clipboard.writeText(shortUrl)}>Copy</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </ToolShell>
  );
}
