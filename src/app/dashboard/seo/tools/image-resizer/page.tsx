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
} from '@/components/sabcrm/20ui/compat';
import { cn as _zoruCn, useState, useRef } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function ImageResizerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [imgSrc, setImgSrc] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);

  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [outUrl, setOutUrl] = useState('');
  const [err, setErr] = useState('');
  
  const [aspectRatioLock, setAspectRatioLock] = useState(true);
  const [originalRatio, setOriginalRatio] = useState<number | null>(null);
  const [resizeMode, setResizeMode] = useState<'fit' | 'fill' | 'stretch'>('fit');

  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [enableCrop, setEnableCrop] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) {
      setCrop({
        unit: '%',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
      setCompletedCrop(null);
      
      const reader = new FileReader();
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(f);
    } else {
      setImgSrc('');
      setOriginalRatio(null);
      setAspectRatioLock(false);
    }
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setWidth(naturalWidth);
    setHeight(naturalHeight);
    setOriginalRatio(naturalWidth / naturalHeight);
    setAspectRatioLock(true);
    
    setCrop({
      unit: '%',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  }

  function handleWidthChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value) || 0;
    setWidth(val);
    if (aspectRatioLock && originalRatio) {
      setHeight(Math.round(val / originalRatio));
    } else if (aspectRatioLock && height) {
      setHeight(Math.round(val / (width / height)));
    }
  }

  function handleHeightChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = parseInt(e.target.value) || 0;
    setHeight(val);
    if (aspectRatioLock && originalRatio) {
      setWidth(Math.round(val * originalRatio));
    } else if (aspectRatioLock && width) {
      setWidth(Math.round(val * (width / height)));
    }
  }

  async function resize() {
    setErr('');
    setOutUrl('');
    if (!imgRef.current) return;
    
    try {
      const image = imgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      // Crop step
      let croppedCanvas = document.createElement('canvas');
      let croppedCtx = croppedCanvas.getContext('2d');
      if (!croppedCtx) throw new Error('No 2d context');

      if (enableCrop && completedCrop && completedCrop.width > 0 && completedCrop.height > 0) {
        croppedCanvas.width = completedCrop.width * scaleX;
        croppedCanvas.height = completedCrop.height * scaleY;
        croppedCtx.drawImage(
          image,
          completedCrop.x * scaleX,
          completedCrop.y * scaleY,
          completedCrop.width * scaleX,
          completedCrop.height * scaleY,
          0,
          0,
          croppedCanvas.width,
          croppedCanvas.height,
        );
      } else {
        croppedCanvas.width = image.naturalWidth;
        croppedCanvas.height = image.naturalHeight;
        croppedCtx.drawImage(image, 0, 0);
      }

      if (width <= 0 || height <= 0) {
        throw new Error('Width and height must be greater than 0');
      }

      // Resize step
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');
      
      const imgW = croppedCanvas.width;
      const imgH = croppedCanvas.height;

      if (resizeMode === 'stretch') {
        ctx.drawImage(croppedCanvas, 0, 0, width, height);
      } else if (resizeMode === 'fit') {
        const scale = Math.min(width / imgW, height / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const dx = (width - drawW) / 2;
        const dy = (height - drawH) / 2;
        ctx.drawImage(croppedCanvas, dx, dy, drawW, drawH);
      } else if (resizeMode === 'fill') {
        const scale = Math.max(width / imgW, height / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const dx = (width - drawW) / 2;
        const dy = (height - drawH) / 2;
        ctx.drawImage(croppedCanvas, dx, dy, drawW, drawH);
      }
      
      canvas.toBlob((blob) => {
        if (blob) setOutUrl(URL.createObjectURL(blob));
      }, 'image/png');
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
          
          {imgSrc && enableCrop && (
            <div className="flex justify-center border p-2 bg-zoru-surface-2/20 overflow-auto max-h-[60vh]">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={aspectRatioLock && width && height ? width / height : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={imgSrc}
                  alt="Source"
                  onLoad={onImageLoad}
                  className="max-w-full"
                />
              </ReactCrop>
            </div>
          )}
          
          {imgSrc && !enableCrop && (
            <div className="flex justify-center border p-2 bg-zoru-surface-2/20 overflow-auto max-h-[60vh]">
               {/* eslint-disable-next-line @next/next/no-img-element */}
               <img
                  ref={imgRef}
                  src={imgSrc}
                  alt="Source"
                  onLoad={onImageLoad}
                  className="max-w-full"
                />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
            <div className="flex items-center space-x-2">
              <Switch checked={enableCrop} onCheckedChange={setEnableCrop} id="enable-crop" disabled={!imgSrc} />
              <Label htmlFor="enable-crop">Enable Cropping</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch checked={aspectRatioLock} onCheckedChange={(val) => {
                setAspectRatioLock(val);
                if (val && width && height) {
                   setOriginalRatio(width / height);
                }
              }} id="aspect-lock" disabled={!imgSrc} />
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
          <Button onClick={resize} disabled={!imgSrc}>
            Resize
          </Button>
          {err && <div className="text-sm text-zoru-ink">{err}</div>}
        </ZoruCardContent>
      </Card>
      {outUrl && (
        <Card>
          <ZoruCardContent className="p-4 space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={outUrl} alt="Resized preview" className="max-w-full rounded border bg-zoru-surface-2/20" />
            <a href={outUrl} download="resized.png" className="underline text-sm text-zoru-ink">
              Download resized image
            </a>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
