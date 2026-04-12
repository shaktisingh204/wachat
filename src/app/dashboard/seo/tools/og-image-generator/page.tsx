'use client';

import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function OgImageGeneratorPage() {
  const [title, setTitle] = useState('Your Title Here');
  const [subtitle, setSubtitle] = useState('Optional subtitle');
  const [bg, setBg] = useState('#0f172a');
  const [fg, setFg] = useState('#ffffff');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 1200; canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1200, 630);
    ctx.fillStyle = fg;
    ctx.font = 'bold 72px sans-serif';
    ctx.textBaseline = 'top';
    wrap(ctx, title, 80, 180, 1040, 88);
    ctx.font = '32px sans-serif';
    ctx.fillStyle = fg;
    wrap(ctx, subtitle, 80, 460, 1040, 42);
  };

  const wrap = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number) => {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const w of words) {
      const test = line + w + ' ';
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy); line = w + ' '; yy += lineH;
      } else line = test;
    }
    ctx.fillText(line, x, yy);
  };

  const download = () => {
    render();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'og-image.png';
      a.click();
    });
  };

  return (
    <ToolShell title="OG Image Generator" description="Generate an Open Graph share image (1200×630).">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="space-y-1"><Label>Subtitle</Label><Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} /></div>
        <div className="space-y-1"><Label>Background</Label><input type="color" value={bg} onChange={(e) => setBg(e.target.value)} className="h-9 w-16" /></div>
        <div className="space-y-1"><Label>Text</Label><input type="color" value={fg} onChange={(e) => setFg(e.target.value)} className="h-9 w-16" /></div>
      </div>
      <div className="flex gap-2">
        <Button onClick={render}>Preview</Button>
        <Button variant="outline" onClick={download}>Download PNG</Button>
      </div>
      <canvas ref={canvasRef} className="max-w-full border rounded" style={{ aspectRatio: '1200/630' }} />
    </ToolShell>
  );
}
