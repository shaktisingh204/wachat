'use client';

import { useState, useEffect, useCallback } from 'react';
import { Download, ImageIcon } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  Field,
  Slider,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { SabFileToFileButton } from '@/components/sabfiles';
import { ToolShell } from '@/components/seo-tools/tool-shell';

type TargetFormat = 'png' | 'jpeg' | 'webp';

export default function ImageFormatConverterPage() {
  const [format, setFormat] = useState<TargetFormat>('png');
  const [quality, setQuality] = useState(0.92);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!file) {
      setUrl('');
      return;
    }

    let ignore = false;
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (ignore) return;
          if (blob) setUrl(URL.createObjectURL(blob));
        },
        `image/${format}`,
        quality,
      );
      URL.revokeObjectURL(objectUrl);
    };

    img.src = objectUrl;

    return () => {
      ignore = true;
    };
  }, [file, format, quality]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const showQuality = format === 'jpeg' || format === 'webp';
  const ext = format === 'jpeg' ? 'jpg' : format;

  const onDownload = useCallback(() => {
    if (!url) return;
    const base = file
      ? file.name.substring(0, file.name.lastIndexOf('.')) || file.name
      : 'converted';
    const a = document.createElement('a');
    a.href = url;
    a.download = `${base}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [url, file, ext]);

  return (
    <ToolShell title="Image Format Converter" description="Convert between PNG, JPEG and WebP.">
      <div className="flex flex-col gap-5 items-start">
        <Card className="w-full max-w-2xl">
          <CardBody>
            <div className="flex flex-wrap items-end gap-4">
              <Field label="Target format" className="w-40">
                <Select value={format} onValueChange={(v) => setFormat(v as TargetFormat)}>
                  <SelectTrigger aria-label="Target format">
                    <SelectValue placeholder="Pick a format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG</SelectItem>
                    <SelectItem value="jpeg">JPEG</SelectItem>
                    <SelectItem value="webp">WebP</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              {showQuality && (
                <Field label="Quality" className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-3">
                    <Slider
                      value={quality}
                      min={0.1}
                      max={1}
                      step={0.01}
                      ariaLabel="Quality"
                      onValueChange={(v) => setQuality(Array.isArray(v) ? v[0] : v)}
                      className="flex-1"
                    />
                    <span className="w-12 text-right text-sm tabular-nums text-[var(--st-text-secondary)]">
                      {Math.round(quality * 100)}%
                    </span>
                  </div>
                </Field>
              )}

              <Field label="Image file">
                <SabFileToFileButton
                  accept="image"
                  onPickFile={(picked) => setFile(picked)}
                >
                  <ImageIcon aria-hidden="true" /> {file ? 'Change image' : 'Choose image'}
                </SabFileToFileButton>
              </Field>
            </div>
          </CardBody>
        </Card>

        {url && (
          <Card className="w-full">
            <CardBody>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <Button variant="primary" iconLeft={Download} onClick={onDownload}>
                    Download converted image
                  </Button>
                </div>
                <div className="w-full text-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Converted image preview"
                    className="max-w-full h-auto max-h-[60vh] object-contain mx-auto rounded-[var(--st-radius)] shadow-sm"
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </ToolShell>
  );
}
