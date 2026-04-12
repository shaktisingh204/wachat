'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function ImageFormatConverterPage() {
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [url, setUrl] = useState('');

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) setUrl(URL.createObjectURL(blob));
      }, `image/${format}`, 0.92);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <ToolShell title="Image Format Converter" description="Convert between PNG, JPEG and WebP.">
      <div className="flex items-end gap-3">
        <div className="space-y-1"><Label>Target format</Label>
          <select className="border rounded h-9 px-2 bg-background" value={format} onChange={(e) => setFormat(e.target.value as any)}>
            <option value="png">PNG</option>
            <option value="jpeg">JPEG</option>
            <option value="webp">WebP</option>
          </select>
        </div>
        <input type="file" accept="image/*" onChange={onFile} />
      </div>
      {url && <a href={url} download={`converted.${format}`} className="text-sm text-blue-600 hover:underline">Download converted image</a>}
      {url && <img src={url} alt="converted" className="max-w-md border rounded" />}
    </ToolShell>
  );
}
