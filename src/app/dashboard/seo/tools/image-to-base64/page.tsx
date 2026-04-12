'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label>Image file</Label>
            <Input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] || null)} />
          </div>
          {err && <div className="text-sm text-destructive">{err}</div>}
          {b64 && (
            <>
              <Textarea value={b64} readOnly className="min-h-[200px] font-mono text-xs" />
              <Button onClick={() => navigator.clipboard.writeText(b64)}>Copy to clipboard</Button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b64} alt="Preview" className="max-w-full rounded border" />
            </>
          )}
        </CardContent>
      </Card>
    </ToolShell>
  );
}
