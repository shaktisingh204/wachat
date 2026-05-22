'use client';

import { Button, Card, ZoruCardContent, Input, Label, Textarea, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function ImageToBase64Page() {
  const [b64, setB64] = useState('');
  const [err, setErr] = useState('');

  function onFile(f: File | null) {
    setErr('');
    setB64('');
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setB64(String(reader.result || ''));
    reader.onerror = () => setErr('Failed to read file');
    reader.readAsDataURL(f);
  }

  return (
    <ToolShell title="Image to Base64" description="Convert an image to a base64 data URL.">
      <ZoruCard>
        <ZoruCardContent className="p-4 space-y-4">
          <div>
            <ZoruLabel>Image file</ZoruLabel>
            <ZoruInput type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] || null)} />
          </div>
          {err && <div className="text-sm text-destructive">{err}</div>}
          {b64 && (
            <>
              <ZoruTextarea value={b64} readOnly className="min-h-[200px] font-mono text-xs" />
              <ZoruButton onClick={() => navigator.clipboard.writeText(b64)}>Copy to clipboard</ZoruButton>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b64} alt="Preview" className="max-w-full rounded border" />
            </>
          )}
        </ZoruCardContent>
      </ZoruCard>
    </ToolShell>
  );
}
