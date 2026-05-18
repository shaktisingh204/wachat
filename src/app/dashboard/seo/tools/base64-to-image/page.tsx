'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useState } from 'react';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
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
        throw new Error('ZoruInput must be a data:image/... URL');
      }
      setSrc(value);
    } catch (e: any) {
      setSrc('');
      setErr(e?.message || 'Invalid data URL');
    }
  }

  return (
    <ToolShell title="Base64 to Image" description="Render a base64 data URL as an image.">
      <ZoruCard>
        <ZoruCardContent className="p-4 space-y-4">
          <div>
            <ZoruLabel>Base64 data URL</ZoruLabel>
            <ZoruTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="data:image/png;base64,..."
              className="min-h-[160px] font-mono text-xs"
            />
          </div>
          <ZoruButton onClick={render}>Render</ZoruButton>
          {err && <div className="text-sm text-destructive">{err}</div>}
        </ZoruCardContent>
      </ZoruCard>
      {src && (
        <ZoruCard>
          <ZoruCardContent className="p-4 space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="Decoded" className="max-w-full rounded border" />
            <a href={src} download="image" className="underline text-sm">
              Download image
            </a>
          </ZoruCardContent>
        </ZoruCard>
      )}
    </ToolShell>
  );
}
