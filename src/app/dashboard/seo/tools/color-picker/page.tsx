'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';

function hexToRgb(hex: string) {
  const m = hex.replace('#', '').match(/^([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
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

export default function ColorPickerPage() {
  const [hex, setHex] = useState('#0ea5e9');
  const { rgb, hsl } = useMemo(() => {
    const rgb = hexToRgb(hex);
    return { rgb, hsl: rgb ? rgbToHsl(rgb.r, rgb.g, rgb.b) : null };
  }, [hex]);

  const rgbStr = rgb ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` : '';
  const hslStr = hsl ? `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)` : '';

  return (
    <ToolShell title="Color Picker" description="Pick and convert colors between HEX, RGB, HSL.">
      <div className="flex items-center gap-4">
        <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} className="h-20 w-20 border rounded" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2"><span className="font-mono text-sm w-20">{hex}</span><Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(hex)}>Copy</Button></div>
          <div className="flex items-center gap-2"><span className="font-mono text-sm w-48">{rgbStr}</span><Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(rgbStr)}>Copy</Button></div>
          <div className="flex items-center gap-2"><span className="font-mono text-sm w-48">{hslStr}</span><Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(hslStr)}>Copy</Button></div>
        </div>
      </div>
      <Card><CardContent className="p-0"><div className="h-32 rounded" style={{ backgroundColor: hex }} /></CardContent></Card>
    </ToolShell>
  );
}
