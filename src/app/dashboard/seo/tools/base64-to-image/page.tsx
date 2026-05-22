'use client';

import { Button, Card, ZoruCardContent, Label, Textarea, cn, Input } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function Base64ToImagePage() {
  const [input, setInput] = useState('');
  const [src, setSrc] = useState('');
  const [err, setErr] = useState('');

  function render() {
    setErr('');
    try {
      const value = input.trim();
      if (!value.startsWith('data:image/')) {
        throw new Error('Input must be a data:image/... URL');
      }
      setSrc(value);
    } catch (e: any) {
      setSrc('');
      setErr(e?.message || 'Invalid data URL');
    }
  }

  return (
    <ToolShell title="Base64 to Image" description="Render a base64 data URL as an image.">
      <Card>
        <ZoruCardContent className="p-4 space-y-4">
          <div>
            <Label>Base64 data URL</Label>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="data:image/png;base64,..."
              className="min-h-[160px] font-mono text-xs"
            />
          </div>
          <Button onClick={render}>Render</Button>
          {err && <div className="text-sm text-destructive">{err}</div>}
        </ZoruCardContent>
      </Card>
      {src && (
        <Card>
          <ZoruCardContent className="p-4 space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="Decoded" className="max-w-full rounded border" />
            <a href={src} download="image" className="underline text-sm">
              Download image
            </a>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
