'use client';

import { Button, Card, ZoruCardContent, Label, Textarea } from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function Base64ToImagePage() {
  const [input, setInput] = useState('');
  const [src, setSrc] = useState('');
  const [err, setErr] = useState('');

  async function render() {
    setErr('');
    try {
      let value = input.trim();
      if (!value) {
        throw new Error('Please enter a base64 string or a URL containing it.');
      }
      
      if (value.startsWith('http://') || value.startsWith('https://')) {
        // Fetch base64 from the URL using apiFetchUrl proxy to bypass CORS
        const { apiFetchUrl } = await import('@/lib/seo-tools/api-client');
        const res = await apiFetchUrl(value);
        if (res.error) throw new Error(res.error);
        if (res.body) {
           value = res.body.trim();
        } else {
           throw new Error('Failed to fetch content from URL');
        }
      }

      if (!value.startsWith('data:image/')) {
        // Check if it's raw base64
        const isBase64 = /^[a-zA-Z0-9+/=\s]+$/.test(value);
        if (isBase64) {
          value = `data:image/png;base64,${value.replace(/\s/g, '')}`;
        } else {
          throw new Error('Input must be a data:image/... URL or valid base64 string');
        }
      }
      setSrc(value);
    } catch (e: any) {
      setSrc('');
      setErr(e?.message || 'Invalid data URL or fetch failed');
    }
  }

  const copyImageToClipboard = async () => {
    if (!src) return;
    try {
      const response = await fetch(src);
      const blob = await response.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob })
      ]);
      alert('Image copied to clipboard!');
    } catch (error) {
      console.error('Clipboard API failed, falling back to string copy', error);
      try {
        await navigator.clipboard.writeText(src);
        alert('Base64 string copied to clipboard!');
      } catch (err) {
        alert('Failed to copy to clipboard.');
      }
    }
  };

  const exportCSV = () => {
    if (!src) return;
    const csvContent = `Base64 Data\n"${src}"`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'base64_image.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <ToolShell title="Base64 to Image" description="Render a base64 data URL as an image.">
      <Card>
        <ZoruCardContent className="p-4 space-y-4">
          <div>
            <Label>Base64 data URL or text URL</Label>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="data:image/png;base64,... or raw base64 string, or a URL pointing to a text file containing base64"
              className="min-h-[160px] font-mono text-xs mt-2"
            />
          </div>
          <Button onClick={render}>Render</Button>
          {err && <div className="text-sm text-zoru-ink">{err}</div>}
        </ZoruCardContent>
      </Card>
      
      {src && (
        <Card>
          <ZoruCardContent className="p-4 space-y-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={src} 
              alt="Decoded" 
              className="max-w-full rounded border" 
              onError={() => {
                setErr('Failed to decode image. Invalid base64 or unsupported image format.');
                setSrc('');
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <a href={src} download="image" className="text-sm">
                <Button variant="outline" size="sm">Download Image</Button>
              </a>
              <Button variant="outline" size="sm" onClick={copyImageToClipboard}>
                Copy to Clipboard
              </Button>
              <Button variant="outline" size="sm" onClick={exportCSV}>
                Export CSV
              </Button>
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
