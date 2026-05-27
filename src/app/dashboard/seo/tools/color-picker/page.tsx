'use client';

import React, { useMemo, useState } from 'react';
import { Button, Card, ZoruCardContent, Input, Label, cn } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { useToast } from '@/hooks/use-toast';

function hexToRgb(hex: string) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (h.length === 4) h = h.slice(0, 3).split('').map(c => c + c).join(''); // Drop alpha for basic rgb
  if (h.length === 8) h = h.slice(0, 6); // Drop alpha
  const m = h.match(/^([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h: number, s: number, l: number) {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return {
    r: Math.round(255 * f(0)),
    g: Math.round(255 * f(8)),
    b: Math.round(255 * f(4))
  };
}

function anyColorToHex(color: string): string {
  const c = color.trim().toLowerCase();
  if (c.startsWith('#')) {
    let h = c.substring(1);
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    if (h.length === 4) h = h.slice(0, 3).split('').map(x => x + x).join('');
    if (h.length === 8) h = h.slice(0, 6);
    return `#${h}`;
  }
  if (c.startsWith('rgb')) {
    const m = c.match(/\d+(\.\d+)?/g);
    if (m && m.length >= 3) {
      const r = parseInt(m[0], 10);
      const g = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
    }
  }
  if (c.startsWith('hsl')) {
    const m = c.match(/\d+(\.\d+)?/g);
    if (m && m.length >= 3) {
      const h = parseFloat(m[0]);
      const s = parseFloat(m[1]);
      const l = parseFloat(m[2]);
      const rgb = hslToRgb(h, s, l);
      return `#${(1 << 24 | rgb.r << 16 | rgb.g << 8 | rgb.b).toString(16).slice(1)}`;
    }
  }
  return '#000000';
}

const HEX_REGEX = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
const RGB_REGEX = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[\d.]+)?\s*\)/gi;
const HSL_REGEX = /hsla?\(\s*\d+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?(?:\s*,\s*[\d.]+)?\s*\)/gi;

function extractColors(text: string) {
  const hexes = (text.match(HEX_REGEX) || []).map(s => s.toLowerCase());
  const rgbs = (text.match(RGB_REGEX) || []).map(s => s.toLowerCase());
  const hsls = (text.match(HSL_REGEX) || []).map(s => s.toLowerCase());
  
  const all = [...hexes, ...rgbs, ...hsls];
  return Array.from(new Set(all));
}

// Removed exportCsv and copyAll to move them inside ColorPickerContent for toast access

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <ToolShell title="Color Picker" description="An error occurred while loading this tool.">
          <div className="p-4 border border-zoru-line bg-zoru-surface-2 text-zoru-ink rounded">
            <h2 className="font-semibold">Something went wrong</h2>
            <p className="mt-2 text-sm">{this.state.error?.message}</p>
          </div>
        </ToolShell>
      );
    }
    return this.props.children;
  }
}

function ColorPickerContent() {
  const { toast } = useToast();
  const [hex, setHex] = useState('#0ea5e9');
  const { rgb, hsl } = useMemo(() => {
    const rgb = hexToRgb(hex);
    return { rgb, hsl: rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null };
  }, [hex]);

  const rgbStr = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : '';
  const hslStr = hsl ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : '';

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [error, setError] = useState('');

  const handleExtract = async () => {
    let finalUrl = url.trim();
    if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
      finalUrl = 'https://' + finalUrl;
    }
    if (!finalUrl) return;
    setLoading(true);
    setError('');
    setExtractedColors([]);
    try {
      const { apiFetchUrl } = await import('@/lib/seo-tools/api-client');
      const res = await apiFetchUrl(finalUrl);
      if (res.error) {
        setError(res.error);
        return;
      }
      const textToSearch = res.body || '';
      const colors = extractColors(textToSearch);
      setExtractedColors(colors);
      if (colors.length === 0) {
        setError('No colors found on this page.');
      }
    } catch (e: any) {
      setError(e.message || 'Failed to fetch url');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = (colors: string[]) => {
    const csv = 'Color\n' + colors.map(c => `"${c}"`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'colors.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Colors exported to CSV.' });
  };

  const copyAll = (colors: string[]) => {
    navigator.clipboard.writeText(colors.join('\n'));
    toast({ title: 'Copied', description: `${colors.length} colors copied to clipboard.` });
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: `${label} copied to clipboard.` });
  };

  return (
    <ToolShell title="Color Picker" description="Pick and convert colors. Extract colors from a URL.">
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <ZoruCardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Manual Picker</h3>
            <div className="flex items-center gap-4">
              <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="h-24 w-24 border rounded cursor-pointer p-1" />
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{hex}</span>
                  <Button size="sm" variant="outline" onClick={() => copyText(hex, 'HEX value')}>Copy</Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{rgbStr}</span>
                  <Button size="sm" variant="outline" onClick={() => copyText(rgbStr, 'RGB value')}>Copy</Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm">{hslStr}</span>
                  <Button size="sm" variant="outline" onClick={() => copyText(hslStr, 'HSL value')}>Copy</Button>
                </div>
              </div>
            </div>
          </ZoruCardContent>
        </Card>

        <Card>
          <ZoruCardContent className="pt-6">
            <h3 className="text-lg font-medium mb-4">Extract from URL</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Website URL</Label>
                <div className="flex gap-2">
                  <Input 
                    type="url" 
                    placeholder="https://example.com" 
                    value={url} 
                    onChange={e => setUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleExtract()}
                  />
                  <Button onClick={handleExtract} disabled={loading}>
                    {loading ? 'Extracting...' : 'Extract'}
                  </Button>
                </div>
              </div>

              {error && <div className="text-sm text-zoru-ink">{error}</div>}

              {extractedColors.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Found {extractedColors.length} colors</span>
                    <div className="space-x-2">
                      <Button size="sm" variant="outline" onClick={() => copyAll(extractedColors)}>Copy All</Button>
                      <Button size="sm" variant="outline" onClick={() => exportCsv(extractedColors)}>Export CSV</Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-1">
                    {extractedColors.map(c => (
                      <div 
                        key={c} 
                        className="w-8 h-8 rounded border shadow-sm cursor-pointer hover:scale-110 transition-transform" 
                        style={{ backgroundColor: c }}
                        title={c}
                        onClick={() => { setHex(anyColorToHex(c)); copyText(c, 'Color'); }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ZoruCardContent>
        </Card>
      </div>
    </ToolShell>
  );
}

export default function ColorPickerPage() {
  return (
    <ErrorBoundary>
      <ColorPickerContent />
    </ErrorBoundary>
  );
}
