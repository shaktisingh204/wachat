'use client';

import { ZoruButton, ZoruTextarea, ZoruCard, ZoruCardContent, ZoruLabel, cn, ZoruInput } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

void _zoruCn;

export default function UrlEncoderPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const run = () => {
    try {
      setOutput(encodeURIComponent(input));
    } catch {
      setOutput('');
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
    <ToolShell title="URL Encoder" description="Encode text or URLs using encodeURIComponent.">
      <div className="flex flex-col gap-3">
        <ZoruLabel>ZoruInput text</ZoruLabel>
        <ZoruTextarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste text to encode…"
          className="min-h-[140px]"
        />
        <div>
          <ZoruButton onClick={run} disabled={!input}>
            Encode
          </ZoruButton>
        </div>
      </div>

      {output && (
        <ZoruCard>
          <ZoruCardContent className="p-4 space-y-3">
            <ZoruLabel>Encoded output</ZoruLabel>
            <ZoruTextarea readOnly value={output} className="min-h-[140px] font-mono text-sm" />
            <ZoruButton variant="outline" onClick={copy}>
              {copied ? 'Copied!' : 'Copy'}
            </ZoruButton>
          </ZoruCardContent>
        </ZoruCard>
      )}
    </ToolShell>
  );
}
