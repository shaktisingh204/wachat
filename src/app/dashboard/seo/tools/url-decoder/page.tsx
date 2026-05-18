'use client';

import { ZoruButton, ZoruTextarea, ZoruCard, ZoruCardContent, ZoruLabel, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

void _zoruCn;

export default function UrlDecoderPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const run = () => {
    setError('');
    try {
      setOutput(decodeURIComponent(input));
    } catch (e: any) {
      setOutput('');
      setError(e?.message || 'Invalid encoded input.');
    }
  };

  const copy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <ToolShell title="URL Decoder" description="Decode percent-encoded URLs back to plain text.">
      <div className="flex flex-col gap-3">
        <ZoruLabel>Encoded input</ZoruLabel>
        <ZoruTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste an encoded URL…"
          className="min-h-[140px] font-mono text-sm"
        />
        <div>
          <ZoruButton onClick={run} disabled={!input}>
            Decode
          </ZoruButton>
        </div>
      </div>

      {error && (
        <ZoruCard className="border-red-500/50">
          <ZoruCardContent className="p-4 text-sm text-red-500">{error}</ZoruCardContent>
        </ZoruCard>
      )}

      {output && !error && (
        <ZoruCard>
          <ZoruCardContent className="p-4 space-y-3">
            <ZoruLabel>Decoded output</ZoruLabel>
            <ZoruTextarea readOnly value={output} className="min-h-[140px]" />
            <ZoruButton variant="outline" onClick={copy}>
              {copied ? 'Copied!' : 'Copy'}
            </ZoruButton>
          </ZoruCardContent>
        </ZoruCard>
      )}
    </ToolShell>
  );
}
