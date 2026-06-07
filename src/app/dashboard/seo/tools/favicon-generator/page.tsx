'use client';

import React, { useState, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { Button, Card, CardBody, Field, Label, Switch, Alert } from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import JSZip from 'jszip';
import { Download, AlertCircle, ImageUp } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

type FaviconOutput = {
  id: string;
  name: string;
  desc: string;
  url: string;
  size: number;
  type: 'png' | 'ico' | 'apple';
};

const PNG_SIZES = [16, 32, 48, 192, 512];
const APPLE_SIZES = [57, 72, 76, 114, 120, 144, 152, 180];
const ICO_SIZES = [16, 32, 48];

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function generateIcoFromPngs(pngs: Uint8Array[]): string {
  const headerSize = 6;
  const directorySize = 16 * pngs.length;
  let totalImageSize = 0;
  for (const png of pngs) totalImageSize += png.length;

  const buffer = new ArrayBuffer(headerSize + directorySize + totalImageSize);
  const view = new DataView(buffer);

  // Header
  view.setUint16(0, 0, true); // reserved
  view.setUint16(2, 1, true); // icon type
  view.setUint16(4, pngs.length, true); // number of images

  let offset = headerSize + directorySize;
  let dirOffset = headerSize;

  for (const png of pngs) {
    const viewPng = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const width = viewPng.getUint32(16, false);
    const height = viewPng.getUint32(20, false);

    view.setUint8(dirOffset + 0, width >= 256 ? 0 : width);
    view.setUint8(dirOffset + 1, height >= 256 ? 0 : height);
    view.setUint8(dirOffset + 2, 0); // colorCount
    view.setUint8(dirOffset + 3, 0); // reserved
    view.setUint16(dirOffset + 4, 1, true); // planes
    view.setUint16(dirOffset + 6, 32, true); // bitCount
    view.setUint32(dirOffset + 8, png.length, true); // bytesInRes
    view.setUint32(dirOffset + 12, offset, true); // imageOffset

    new Uint8Array(buffer).set(png, offset);

    dirOffset += 16;
    offset += png.length;
  }

  const uint8Array = new Uint8Array(buffer);
  let binaryString = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binaryString += String.fromCharCode(uint8Array[i]);
  }
  return 'data:image/x-icon;base64,' + btoa(binaryString);
}

function downloadDataUrl(url: string, name: string) {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
}

class LocalErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Favicon generator error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert
          tone="danger"
          icon={AlertCircle}
          title="Something went wrong rendering the tool."
          className="m-4"
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm">{this.state.error?.message}</p>
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
              variant="secondary"
              size="sm"
              className="w-fit"
            >
              Try Again
            </Button>
          </div>
        </Alert>
      );
    }
    return this.props.children;
  }
}

function FaviconGeneratorContent() {
  const [imgSrc, setImgSrc] = useState<string>('');
  const imgRef = useRef<HTMLImageElement>(null);
  const [isCircular, setIsCircular] = useState(false);

  const [crop, setCrop] = useState<Crop>({
    unit: '%',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });

  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);
  const [outputs, setOutputs] = useState<FaviconOutput[]>([]);
  const [err, setErr] = useState('');

  function onPickFile(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      setErr('Image file is too large. Please select an image under 20MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setErr('Please select a valid image file.');
      return;
    }

    setErr('');
    setCrop({
      unit: '%',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    setOutputs([]);

    const reader = new FileReader();
    reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
    reader.addEventListener('error', () => {
      setErr('Failed to read image file. The file may be corrupted.');
    });

    try {
      reader.readAsDataURL(file);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error starting file read');
    }
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height, naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 8192 || naturalHeight > 8192) {
      setErr('Image dimensions are too large (max 8192x8192). Please select a smaller image.');
      setImgSrc('');
      return;
    }
    const size = Math.min(width, height);
    const x = (width - size) / 2;
    const y = (height - size) / 2;

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
    if (!imgRef.current || !completedCrop || completedCrop.width === 0 || completedCrop.height === 0) {
      setErr('Please select an image and crop area.');
      return;
    }
    try {
      const image = imgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;

      const cropWidth = completedCrop.width * scaleX;
      const cropHeight = completedCrop.height * scaleY;
      const maxDim = Math.max(cropWidth, cropHeight);
      let targetW = cropWidth;
      let targetH = cropHeight;

      // Cap at 512x512 to prevent huge canvas memory allocations and crashes on massive images
      if (maxDim > 512) {
        const scale = 512 / maxDim;
        targetW = cropWidth * scale;
        targetH = cropHeight * scale;
      }

      const offscreen = document.createElement('canvas');
      offscreen.width = targetW;
      offscreen.height = targetH;
      const ctx = offscreen.getContext('2d');
      if (!ctx) throw new Error('No 2d context');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(
        image,
        completedCrop.x * scaleX,
        completedCrop.y * scaleY,
        cropWidth,
        cropHeight,
        0,
        0,
        targetW,
        targetH,
      );

      const croppedDataUrl = offscreen.toDataURL('image/png');

      const img = new Image();
      img.src = croppedDataUrl;
      await new Promise((res, rej) => {
        img.onload = () => res(null);
        img.onerror = () => rej(new Error('Failed to load cropped image'));
      });

      const out: FaviconOutput[] = [];

      // Helper to generate a single resized PNG data URL
      const generatePng = (size: number): string => {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx2 = canvas.getContext('2d');
        if (!ctx2) throw new Error('Canvas context unavailable');
        ctx2.imageSmoothingEnabled = true;
        ctx2.imageSmoothingQuality = 'high';
        ctx2.drawImage(img, 0, 0, size, size);
        return canvas.toDataURL('image/png');
      };

      // Generate PNGs
      for (const size of PNG_SIZES) {
        out.push({
          id: `png-${size}`,
          name: `favicon-${size}x${size}.png`,
          desc: `${size}x${size} PNG`,
          url: generatePng(size),
          size,
          type: 'png',
        });
      }

      // Generate Apple Touch Icons
      for (const size of APPLE_SIZES) {
        out.push({
          id: `apple-${size}`,
          name: size === 180 ? 'apple-touch-icon.png' : `apple-touch-icon-${size}x${size}.png`,
          desc: `Apple Touch Icon (${size}x${size})`,
          url: generatePng(size),
          size,
          type: 'apple',
        });
      }

      // Generate ICO
      const icoPngs: Uint8Array[] = [];
      for (const size of ICO_SIZES) {
        const dataUrl = generatePng(size);
        const base64 = dataUrl.split(',')[1];
        icoPngs.push(base64ToUint8Array(base64));
      }

      const icoUrl = generateIcoFromPngs(icoPngs);
      out.push({
        id: 'ico',
        name: 'favicon.ico',
        desc: 'ICO format (16, 32, 48)',
        url: icoUrl,
        size: 48, // max size in ico
        type: 'ico',
      });

      setOutputs(out.sort((a, b) => a.size - b.size));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to generate favicons');
    }
  }

  async function downloadZip() {
    if (outputs.length === 0) return;
    try {
      const zip = new JSZip();
      outputs.forEach((o) => {
        const base64Data = o.url.replace(/^data:image\/(png|jpeg|jpg|x-icon);base64,/, '');
        zip.file(o.name, base64Data, { base64: true });
      });
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = 'favicons.zip';
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create ZIP file.');
    }
  }

  return (
    <ToolShell title="Favicon Generator" description="Generate all standard favicon formats, including ICO and Apple Touch Icon.">
      <Card>
        <CardBody className="space-y-4">
          <Field
            label="Source image"
            help="Max file size: 20MB. We recommend starting with a high-resolution image."
          >
            <div className="flex items-center gap-3">
              <SabFileToFileButton
                accept="image"
                variant="outline"
                onPickFile={(file) => onPickFile(file)}
                onError={(e) => setErr(e.message)}
              >
                <span className="inline-flex items-center gap-2">
                  <ImageUp className="h-4 w-4" aria-hidden="true" /> Choose image
                </span>
              </SabFileToFileButton>
              {imgSrc ? (
                <span className="text-sm text-[var(--st-text-secondary)]">Image loaded.</span>
              ) : null}
            </div>
          </Field>

          {err && (
            <Alert tone="danger" icon={AlertCircle}>
              {err}
            </Alert>
          )}

          {imgSrc && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 justify-end">
                <Switch
                  checked={isCircular}
                  onCheckedChange={setIsCircular}
                  id="circular-crop"
                />
                <Label htmlFor="circular-crop" className="cursor-pointer">Circular Preview</Label>
              </div>

              <div className="flex justify-center border border-[var(--st-border)] p-2 bg-[var(--st-bg-muted)] overflow-auto max-h-[60vh] rounded-[var(--st-radius)] relative">
                <ReactCrop
                  crop={crop}
                  onChange={(_, percentCrop) => setCrop(percentCrop)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={1}
                  circularCrop={isCircular}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imgRef}
                    src={imgSrc}
                    alt="Crop preview of the selected source image"
                    onLoad={onImageLoad}
                    className="max-w-full"
                  />
                </ReactCrop>
              </div>
            </div>
          )}

          <Button
            variant="primary"
            onClick={generate}
            disabled={!imgSrc || !completedCrop || completedCrop.width === 0}
          >
            Generate Favicons
          </Button>
        </CardBody>
      </Card>

      {outputs.length > 0 && (
        <div className="space-y-4 mt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-[var(--st-text)]">Generated Favicons</h3>
            <Button onClick={downloadZip} variant="secondary" iconLeft={Download}>
              Download All (ZIP)
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {outputs.map((o) => (
              <Card key={o.id}>
                <CardBody className="text-center space-y-3 flex flex-col items-center justify-between h-full">
                  <div className="text-sm font-medium text-[var(--st-text-secondary)]">
                    {o.desc}
                  </div>
                  <div className="flex-1 flex items-center justify-center p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={o.url}
                      alt={o.name}
                      className={`mx-auto border border-[var(--st-border)] bg-[var(--st-bg-secondary)] shadow-sm ${isCircular && o.type !== 'apple' ? 'rounded-full' : 'rounded-[var(--st-radius)]'}`}
                      style={{
                        width: Math.min(o.size, 64),
                        height: Math.min(o.size, 64),
                      }}
                    />
                  </div>
                  <div className="text-xs truncate w-full text-center text-[var(--st-text)]" title={o.name}>
                    {o.name}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    block
                    onClick={() => downloadDataUrl(o.url, o.name)}
                  >
                    Download
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}
    </ToolShell>
  );
}

export default function FaviconGeneratorPage() {
  return (
    <LocalErrorBoundary>
      <FaviconGeneratorContent />
    </LocalErrorBoundary>
  );
}
