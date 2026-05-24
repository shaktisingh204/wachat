'use client';

import { Button, Card, ZoruCardContent, Input, Label, Textarea, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function ImageToBase64Page() {
  const [b64, setB64] = useState('');
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  function onFile(f: File | null) {
    setErr('');
    setB64('');
    setCopied(false);
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setB64(String(reader.result || ''));
    reader.onerror = () => setErr('Failed to read file');
    reader.readAsDataURL(f);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(b64).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      setErr('Failed to copy to clipboard');
    });
  };

  const displayB64 = b64.length > 2000 
    ? b64.slice(0, 2000) + '\n\n... [truncated for display, use Copy button to get full string]' 
    : b64;

  return (
    <ToolShell title="Image to Base64" description="Convert an image to a base64 data URL.">
      <Card>
        <ZoruCardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <Label>Image file</Label>
            <Input type="file" accept="image/*" onChange={(e) => onFile(e.target.files?.[0] || null)} />
          </div>
          {err && <div className="text-sm text-destructive">{err}</div>}
          {b64 && (
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label>Base64 Output</Label>
                <div className="text-xs text-muted-foreground font-mono">
                  {b64.length.toLocaleString()} characters
                </div>
              </div>
              <Textarea 
                value={displayB64} 
                readOnly 
                className="min-h-[200px] font-mono text-xs resize-y" 
              />
              <Button onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy full string to clipboard'}
              </Button>
              <div className="space-y-2 pt-4">
                <Label>Preview</Label>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b64} alt="Preview" className="max-w-full rounded border max-h-[400px] object-contain" />
              </div>
            </div>
          )}
        </ZoruCardContent>
      </Card>
    </ToolShell>
  );
}
