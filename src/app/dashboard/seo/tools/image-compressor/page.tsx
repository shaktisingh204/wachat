'use client';

import { Button, Card, ZoruCardContent, Input, Label, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function ImageCompressorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [quality, setQuality] = useState(0.7);
  const [format, setFormat] = useState<'image/jpeg' | 'image/webp'>('image/jpeg');
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

      let targetW = img.naturalWidth;
      let targetH = img.naturalHeight;
      const MAX_DIM = 4096;

      if (targetW > MAX_DIM || targetH > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
        targetW = Math.floor(targetW * ratio);
        targetH = Math.floor(targetH * ratio);
      }

      let curW = img.naturalWidth;
      let curH = img.naturalHeight;
      let source: HTMLImageElement | HTMLCanvasElement = img;

      // Downscale in chunks (step-down) to prevent memory crashes/spikes on huge images
      while (curW * 0.5 > targetW && curH * 0.5 > targetH) {
        curW = Math.floor(curW * 0.5);
        curH = Math.floor(curH * 0.5);
        const stepCanvas = document.createElement('canvas');
        stepCanvas.width = curW;
        stepCanvas.height = curH;
        const stepCtx = stepCanvas.getContext('2d');
        if (stepCtx) {
          stepCtx.drawImage(source, 0, 0, curW, curH);
        }
        source = stepCanvas;
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      ctx.drawImage(source, 0, 0, targetW, targetH);
      
      const dataUrl = canvas.toDataURL(format, quality);
      setOutUrl(dataUrl);
      const bin = atob(dataUrl.split(',')[1] || '');
      setOutBytes(bin.length);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(e?.message || 'Compression failed');
    }
  }

  const outExt = format === 'image/webp' ? 'webp' : 'jpg';

  return (
    <ToolShell title="Image Compressor" description="Compress images client-side with adjustable quality and format.">
      <Card>
        <ZoruCardContent className="p-4 space-y-4">
          <div>
            <Label>Image file</Label>
            <Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div>
            <Label>Output Format</Label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as any)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
            >
              <option value="image/jpeg">JPEG</option>
              <option value="image/webp">WebP</option>
            </select>
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
        </ZoruCardContent>
      </Card>
      {outUrl && (
        <Card>
          <ZoruCardContent className="p-4 space-y-3">
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
            <a href={outUrl} download={`compressed.${outExt}`} className="underline text-sm">
              Download compressed image
            </a>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
