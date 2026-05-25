'use client';

import { Label } from '@/components/zoruui';
import { useState, useEffect } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function ImageFormatConverterPage() {
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
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
      canvas.toBlob((blob) => {
        if (ignore) return;
        if (blob) setUrl(URL.createObjectURL(blob));
      }, `image/${format}`, quality);
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

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  return (
    <ToolShell title="Image Format Converter" description="Convert between PNG, JPEG and WebP.">
      <div className="flex flex-col gap-5 items-start">
        <div className="flex flex-wrap items-end gap-4 w-full max-w-2xl">
          <div className="space-y-1">
            <Label>Target format</Label>
            <select 
              className="block border rounded h-9 px-2 bg-background w-32" 
              value={format} 
              onChange={(e) => setFormat(e.target.value as any)}
            >
              <option value="png">PNG</option>
              <option value="jpeg">JPEG</option>
              <option value="webp">WebP</option>
            </select>
          </div>
          
          {(format === 'jpeg' || format === 'webp') && (
            <div className="space-y-1 flex-1 min-w-[200px]">
              <div className="flex justify-between items-center text-sm px-1">
                <Label>Quality</Label>
                <span className="text-muted-foreground">{Math.round(quality * 100)}%</span>
              </div>
              <input 
                type="range" 
                min="0.1" 
                max="1.0" 
                step="0.01" 
                value={quality} 
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label>Image File</Label>
            <div className="h-9 flex items-center">
              <input 
                type="file" 
                accept="image/*" 
                onChange={onFile} 
                className="block text-sm text-muted-foreground file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {url && (
          <div className="space-y-3 mt-4 w-full">
            <div className="flex justify-between items-center">
              <a 
                href={url} 
                download={file ? `${file.name.substring(0, file.name.lastIndexOf('.')) || file.name}.${format === 'jpeg' ? 'jpg' : format}` : `converted.${format === 'jpeg' ? 'jpg' : format}`} 
                className="text-sm bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium inline-block"
              >
                Download Converted Image
              </a>
            </div>
            <div className="border rounded-lg p-4 bg-muted/10 inline-block w-full text-center">
              <img src={url} alt="converted" className="max-w-full h-auto max-h-[60vh] object-contain mx-auto rounded shadow-sm" />
            </div>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
