'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function ImageCompressorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(0.7);
  const [outUrl, setOutUrl] = useState('');
  const [origBytes, setOrigBytes] = useState(0);
  const [outBytes, setOutBytes] = useState(0);
  const [err, setErr] = useState('');

  async function compress() {
    setErr('');
    setOutUrl('');
    if (!file) return;
    try {
      setOrigBytes(file.size);
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await new Promise((res, rej) => {
        img.onload = () => res(null);
        img.onerror = () => rej(new Error('Failed to load image'));
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      setOutUrl(dataUrl);
      const bin = atob(dataUrl.split(',')[1] || '');
      setOutBytes(bin.length);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(e?.message || 'Compression failed');
    }
  }

  return (
    <ToolShell title="Image Compressor" description="Compress images client-side with adjustable JPEG quality.">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label>Image file</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <Label>Quality: {quality.toFixed(2)}</Label>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={quality}
              onChange={(e) => setQuality(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <Button onClick={compress} disabled={!file}>
            Compress
          </Button>
          {err && <div className="text-sm text-destructive">{err}</div>}
        </CardContent>
      </Card>
      {outUrl && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Original</div>
                <div className="font-mono">{origBytes} bytes</div>
              </div>
              <div>
                <div className="text-muted-foreground">Compressed</div>
                <div className="font-mono">{outBytes} bytes</div>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="Compressed preview" className="max-w-full rounded border" />
            <a href={outUrl} download="compressed.jpg" className="underline text-sm">
              Download compressed image
            </a>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
