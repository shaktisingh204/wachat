'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function ImageResizerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [outUrl, setOutUrl] = useState('');
  const [err, setErr] = useState('');

  async function resize() {
    setErr('');
    setOutUrl('');
    if (!file) return;
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await new Promise((res, rej) => {
        img.onload = () => res(null);
        img.onerror = () => rej(new Error('Failed to load image'));
      });
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (blob) setOutUrl(URL.createObjectURL(blob));
      }, 'image/png');
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(e?.message || 'Resize failed');
    }
  }

  return (
    <ToolShell title="Image Resizer" description="Resize images client-side to exact dimensions.">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label>Image file</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Width (px)</Label>
              <Input type="number" value={width} onChange={(e) => setWidth(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Height (px)</Label>
              <Input type="number" value={height} onChange={(e) => setHeight(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <Button onClick={resize} disabled={!file}>
            Resize
          </Button>
          {err && <div className="text-sm text-destructive">{err}</div>}
        </CardContent>
      </Card>
      {outUrl && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="Resized preview" className="max-w-full rounded border" />
            <a href={outUrl} download="resized.png" className="underline text-sm">
              Download resized image
            </a>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
