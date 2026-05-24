'use client';

import {
  Button,
  Card,
  ZoruCardContent,
  Input,
  Label,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  cn
} from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function ImageResizerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [outUrl, setOutUrl] = useState('');
  const [err, setErr] = useState('');
  
  const [aspectRatioLock, setAspectRatioLock] = useState(false);
  const [originalRatio, setOriginalRatio] = useState<number | null>(null);
  const [resizeMode, setResizeMode] = useState<'fit' | 'fill' | 'stretch'>('stretch');

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        setWidth(img.width);
        setHeight(img.height);
        setOriginalRatio(img.width / img.height);
        setAspectRatioLock(true);
        URL.revokeObjectURL(url);
      };
    } else {
      setOriginalRatio(null);
      setAspectRatioLock(false);
    }
  }

  function handleWidthChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value) || 0;
    setWidth(val);
    if (aspectRatioLock && originalRatio) {
      setHeight(Math.round(val / originalRatio));
    }
  }

  function handleHeightChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value) || 0;
    setHeight(val);
    if (aspectRatioLock && originalRatio) {
      setWidth(Math.round(val * originalRatio));
    }
  }

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
      
      const imgW = img.width;
      const imgH = img.height;

      if (resizeMode === 'stretch') {
        ctx.drawImage(img, 0, 0, width, height);
      } else if (resizeMode === 'fit') {
        const scale = Math.min(width / imgW, height / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const dx = (width - drawW) / 2;
        const dy = (height - drawH) / 2;
        ctx.drawImage(img, dx, dy, drawW, drawH);
      } else if (resizeMode === 'fill') {
        const scale = Math.max(width / imgW, height / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const dx = (width - drawW) / 2;
        const dy = (height - drawH) / 2;
        ctx.drawImage(img, dx, dy, drawW, drawH);
      }
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
        <ZoruCardContent className="p-4 space-y-4">
          <div>
            <Label>Image file</Label>
            <Input type="file" accept="image/*" onChange={handleFileChange} />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <div className="flex items-center space-x-2">
              <Switch checked={aspectRatioLock} onCheckedChange={setAspectRatioLock} id="aspect-lock" disabled={!originalRatio} />
              <Label htmlFor="aspect-lock">Maintain aspect ratio</Label>
            </div>
            <div className="flex items-center space-x-2 sm:ml-auto">
              <Label>Resize Mode</Label>
              <Select value={resizeMode} onValueChange={(val: any) => setResizeMode(val)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stretch">Stretch</SelectItem>
                  <SelectItem value="fit">Fit (Contain)</SelectItem>
                  <SelectItem value="fill">Fill (Cover)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Width (px)</Label>
              <Input type="number" value={width} onChange={handleWidthChange} />
            </div>
            <div>
              <Label>Height (px)</Label>
              <Input type="number" value={height} onChange={handleHeightChange} />
            </div>
          </div>
          <Button onClick={resize} disabled={!file}>
            Resize
          </Button>
          {err && <div className="text-sm text-destructive">{err}</div>}
        </ZoruCardContent>
      </Card>
      {outUrl && (
        <Card>
          <ZoruCardContent className="p-4 space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="Resized preview" className="max-w-full rounded border" />
            <a href={outUrl} download="resized.png" className="underline text-sm">
              Download resized image
            </a>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
