'use client';

import { Button, Card, ZoruCardContent, Input, Label, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import JSZip from 'jszip';
import { Download } from 'lucide-react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

const SIZES = [16, 32, 48, 180];

export default function FaviconGeneratorPage() {
  const [imgSrc, setImgSrc] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);
  
  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [outputs, setOutputs] = useState<{ size: number; url: string }[]>([]);
  const [err, setErr] = useState('');

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setCrop({
        unit: '%',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      }); // reset crop
      setOutputs([]);
      const reader = new FileReader();
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(e.target.files[0]);
    }
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    const size = Math.min(width, height);
    const x = (width - size) / 2;
    const y = (height - size) / 2;
    
    // Initial crop to center square
    setCrop({
      unit: 'px',
      x,
      y,
      width: size,
      height: size,
    });
  }

  async function generate() {
    setErr('');
    setOutputs([]);
    if (!imgRef.current || !completedCrop) {
       setErr('Please select an image and crop area.');
       return;
    }
    try {
      const image = imgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const offscreen = document.createElement('canvas');
      offscreen.width = completedCrop.width * scaleX;
      offscreen.height = completedCrop.height * scaleY;
      const ctx = offscreen.getContext('2d');
      if (!ctx) throw new Error('No 2d context');

      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        completedCrop.width * scaleX,
        completedCrop.height * scaleY,
        0,
        0,
        offscreen.width,
        offscreen.height,
      );
      
      const croppedDataUrl = offscreen.toDataURL('image/png');
      
      const img = new Image();
      img.src = croppedDataUrl;
      await new Promise((res, rej) => {
        img.onload = () => res(null);
        img.onerror = () => rej(new Error('Failed to load image'));
      });

      const out: { size: number; url: string }[] = [];
      for (const size of SIZES) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx2 = canvas.getContext('2d');
        if (!ctx2) throw new Error('Canvas context unavailable');
        ctx2.imageSmoothingEnabled = true;
        ctx2.imageSmoothingQuality = 'high';
        ctx2.drawImage(img, 0, 0, size, size);
        out.push({ size, url: canvas.toDataURL('image/png') });
      }
      setOutputs(out);
    } catch (e: any) {
      setErr(e?.message || 'Failed to generate favicons');
    }
  }

  async function downloadZip() {
    if (outputs.length === 0) return;
    try {
        const zip = new JSZip();
        outputs.forEach((o) => {
            const base64Data = o.url.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
            zip.file(`favicon-${o.size}.png`, base64Data, {base64: true});
        });
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'favicons.zip';
        link.click();
        URL.revokeObjectURL(link.href);
    } catch (e) {
        setErr('Failed to create ZIP file.');
    }
  }

  return (
    <ToolShell title="Favicon Generator" description="Generate favicon PNGs at 16, 32, 48 and 180 px.">
      <Card>
        <ZoruCardContent className="p-4 space-y-4">
          <div>
            <Label>Source image</Label>
            <Input type="file" accept="image/*" onChange={onSelectFile} />
          </div>
          
          {imgSrc && (
            <div className="flex justify-center border p-2 bg-muted/20 overflow-auto max-h-[60vh]">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop={false}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={imgSrc}
                  alt="Crop me"
                  onLoad={onImageLoad}
                  className="max-w-full"
                />
              </ReactCrop>
            </div>
          )}

          <Button onClick={generate} disabled={!imgSrc || !completedCrop}>
            Generate Favicons
          </Button>
          {err && <div className="text-sm text-destructive">{err}</div>}
        </ZoruCardContent>
      </Card>
      
      {outputs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Generated Favicons</h3>
            <Button onClick={downloadZip} variant="secondary" className="flex items-center gap-2">
              <Download className="w-4 h-4" /> Download All (ZIP)
            </Button>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {outputs.map((o) => (
              <Card key={o.size}>
                <ZoruCardContent className="p-4 text-center space-y-2">
                  <div className="text-sm text-muted-foreground">
                    {o.size}x{o.size}
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.url} alt={`Favicon ${o.size}`} className="mx-auto border rounded bg-background" />
                  <a href={o.url} download={`favicon-${o.size}.png`} className="underline text-xs block text-primary hover:text-primary/80">
                    Download PNG
                  </a>
                </ZoruCardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </ToolShell>
  );
}
