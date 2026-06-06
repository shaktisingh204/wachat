'use client';

import { Button, Card, ZoruCardContent, Input, Label, cn } from '@/components/sabcrm/20ui/compat';
import { cn as _zoruCn, useState } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

interface CompressResult {
  file: File;
  outUrl: string;
  origBytes: number;
  outBytes: number;
  error?: string;
}

export default function ImageCompressorPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [quality, setQuality] = useState(0.7);
  const [format, setFormat] = useState<'image/jpeg' | 'image/webp'>('image/jpeg');
  const [isCompressing, setIsCompressing] = useState(false);
  const [results, setResults] = useState<CompressResult[]>([]);

  async function compressSingleFile(file: File, fmt: string, qual: number): Promise<CompressResult> {
    return new Promise(async (resolve, reject) => {
      let objectUrl = '';
      let sourceToClose: ImageBitmap | null = null;
      try {
        const MAX_DIM = 4096;
        let imgWidth = 0;
        let imgHeight = 0;
        let source: CanvasImageSource | null = null;

        if (typeof window !== 'undefined' && 'createImageBitmap' in window) {
          try {
            const bmp = await createImageBitmap(file);
            imgWidth = bmp.width;
            imgHeight = bmp.height;
            let targetW = imgWidth;
            let targetH = imgHeight;
            if (targetW > MAX_DIM || targetH > MAX_DIM) {
              const ratio = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
              targetW = Math.floor(targetW * ratio);
              targetH = Math.floor(targetH * ratio);
            }
            bmp.close();

            source = await createImageBitmap(file, {
              resizeWidth: targetW,
              resizeHeight: targetH,
              resizeQuality: 'high',
            });
            sourceToClose = source as ImageBitmap;
          } catch (e) {
            console.warn('createImageBitmap failed, falling back to Image element', e);
            source = null;
          }
        }

        if (!source) {
          objectUrl = URL.createObjectURL(file);
          const img = new Image();
          await new Promise((res, rej) => {
            img.onload = res;
            img.onerror = () => rej(new Error('Failed to load image'));
            img.src = objectUrl;
          });
          imgWidth = img.naturalWidth;
          imgHeight = img.naturalHeight;
          source = img;
        }

        let targetW = imgWidth;
        let targetH = imgHeight;
        if (targetW > MAX_DIM || targetH > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / targetW, MAX_DIM / targetH);
          targetW = Math.floor(targetW * ratio);
          targetH = Math.floor(targetH * ratio);
        }

        if (source instanceof HTMLImageElement) {
          let curW = imgWidth;
          let curH = imgHeight;
          while (curW * 0.5 > targetW && curH * 0.5 > targetH) {
            let nextW = Math.floor(curW * 0.5);
            let nextH = Math.floor(curH * 0.5);

            if (nextW > MAX_DIM || nextH > MAX_DIM) {
              nextW = targetW;
              nextH = targetH;
            }

            const stepCanvas = document.createElement('canvas');
            stepCanvas.width = nextW;
            stepCanvas.height = nextH;
            const stepCtx = stepCanvas.getContext('2d');
            if (stepCtx) {
              stepCtx.drawImage(source, 0, 0, nextW, nextH);
            }
            source = stepCanvas;
            curW = nextW;
            curH = nextH;
            if (curW === targetW && curH === targetH) break;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          if (sourceToClose) sourceToClose.close();
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(source, 0, 0, targetW, targetH);

        canvas.toBlob(
          (blob) => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            if (sourceToClose) sourceToClose.close();
            if (!blob) {
              reject(new Error('Failed to create blob from canvas'));
              return;
            }
            resolve({
              file,
              outUrl: URL.createObjectURL(blob),
              origBytes: file.size,
              outBytes: blob.size,
            });
          },
          fmt,
          qual
        );
      } catch (err: any) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (sourceToClose) sourceToClose.close();
        reject(err);
      }
    });
  }

  async function compressAll() {
    setIsCompressing(true);
    setResults([]);
    const newResults: CompressResult[] = [];
    for (const file of files) {
      try {
        const result = await compressSingleFile(file, format, quality);
        newResults.push(result);
      } catch (e: any) {
        newResults.push({
          file,
          outUrl: '',
          origBytes: file.size,
          outBytes: 0,
          error: e?.message || 'Compression failed',
        });
      }
    }
    setResults(newResults);
    setIsCompressing(false);
  }

  async function downloadAll() {
    const zip = new JSZip();
    for (const res of results) {
      if (res.error || !res.outUrl) continue;
      try {
        const response = await fetch(res.outUrl);
        const blob = await response.blob();
        const ext = format === 'image/webp' ? 'webp' : 'jpg';
        const filename = `compressed-${res.file.name.split('.')[0]}.${ext}`;
        zip.file(filename, blob);
      } catch (err) {
        console.error('Failed to add file to zip', err);
      }
    }
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, 'compressed-images.zip');
  }

  const outExt = format === 'image/webp' ? 'webp' : 'jpg';

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <ToolShell title="Image Compressor" description="Compress images client-side with adjustable quality and format. Supports WebP and batch compression.">
      <Card>
        <ZoruCardContent className="p-4 space-y-4">
          <div>
            <Label>Image files</Label>
            <Input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />
            {files.length > 0 && (
              <div className="text-sm text-[var(--st-text-secondary)] mt-2">
                {files.length} file{files.length > 1 ? 's' : ''} selected.
              </div>
            )}
          </div>
          <div>
            <Label>Output Format</Label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as any)}
              className="flex h-10 w-full rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-sm ring-offset-zoru-surface file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--st-text-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--st-border)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
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
          <Button onClick={compressAll} disabled={files.length === 0 || isCompressing}>
            {isCompressing ? 'Compressing...' : 'Compress'}
          </Button>
        </ZoruCardContent>
      </Card>
      {results.length > 0 && (
        <Card className="mt-6">
          <ZoruCardContent className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Results</h3>
              {results.filter(r => !r.error).length > 1 && (
                <Button variant="outline" size="sm" onClick={downloadAll}>
                  Download All as ZIP
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((res, idx) => (
                <div key={idx} className="border rounded-md p-3 space-y-2 flex flex-col">
                  <div className="font-medium text-sm truncate" title={res.file.name}>{res.file.name}</div>
                  {res.error ? (
                    <div className="text-sm text-[var(--st-text)]">{res.error}</div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-[var(--st-text-secondary)]">Original</div>
                          <div className="font-mono">{formatBytes(res.origBytes)}</div>
                        </div>
                        <div>
                          <div className="text-[var(--st-text-secondary)]">Compressed</div>
                          <div className="font-mono">{formatBytes(res.outBytes)}</div>
                        </div>
                      </div>
                      <div className="flex-1 flex items-center justify-center bg-[var(--st-bg-muted)]/30 rounded overflow-hidden p-2 min-h-[120px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={res.outUrl} alt={`Compressed ${res.file.name}`} className="max-h-32 object-contain" />
                      </div>
                      <a
                        href={res.outUrl}
                        download={`compressed-${res.file.name.split('.')[0]}.${outExt}`}
                        className="text-sm underline text-[var(--st-text)] mt-2 block text-center"
                      >
                        Download
                      </a>
                    </>
                  )}
                </div>
              ))}
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
