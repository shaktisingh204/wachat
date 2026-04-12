'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ToolShell } from '@/components/seo-tools/tool-shell';

const SIZES = [16, 32, 48, 180];

export default function FaviconGeneratorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [outputs, setOutputs] = useState<{ size: number; url: string }[]>([]);
  const [err, setErr] = useState('');

  async function generate() {
    setErr('');
    setOutputs([]);
    if (!file) return;
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await new Promise((res, rej) => {
        img.onload = () => res(null);
        img.onerror = () => rej(new Error('Failed to load image'));
      });
      const out: { size: number; url: string }[] = [];
      for (const size of SIZES) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context unavailable');
        ctx.drawImage(img, 0, 0, size, size);
        out.push({ size, url: canvas.toDataURL('image/png') });
      }
      setOutputs(out);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(e?.message || 'Failed to generate favicons');
    }
  }

  return (
    <ToolShell title="Favicon Generator" description="Generate favicon PNGs at 16, 32, 48 and 180 px.">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label>Source image (square works best)</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <Button onClick={generate} disabled={!file}>
            Generate
          </Button>
          {err && <div className="text-sm text-destructive">{err}</div>}
        </CardContent>
      </Card>
      {outputs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {outputs.map((o) => (
            <Card key={o.size}>
              <CardContent className="p-4 text-center space-y-2">
                <div className="text-sm text-muted-foreground">
                  {o.size}x{o.size}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.url} alt={`Favicon ${o.size}`} className="mx-auto border rounded" />
                <a href={o.url} download={`favicon-${o.size}.png`} className="underline text-xs block">
                  Download
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </ToolShell>
  );
}
