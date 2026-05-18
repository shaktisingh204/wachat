'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useState } from 'react';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
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
      <ZoruCard>
        <ZoruCardContent className="p-4 space-y-4">
          <div>
            <ZoruLabel>Image file</ZoruLabel>
            <ZoruInput type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <ZoruLabel>Width (px)</ZoruLabel>
              <ZoruInput type="number" value={width} onChange={(e) => setWidth(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <ZoruLabel>Height (px)</ZoruLabel>
              <ZoruInput type="number" value={height} onChange={(e) => setHeight(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <ZoruButton onClick={resize} disabled={!file}>
            Resize
          </ZoruButton>
          {err && <div className="text-sm text-destructive">{err}</div>}
        </ZoruCardContent>
      </ZoruCard>
      {outUrl && (
        <ZoruCard>
          <ZoruCardContent className="p-4 space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="Resized preview" className="max-w-full rounded border" />
            <a href={outUrl} download="resized.png" className="underline text-sm">
              Download resized image
            </a>
          </ZoruCardContent>
        </ZoruCard>
      )}
    </ToolShell>
  );
}
