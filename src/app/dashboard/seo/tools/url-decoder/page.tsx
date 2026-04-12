'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

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
        <Label>Encoded input</Label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste an encoded URL…"
          className="min-h-[140px] font-mono text-sm"
        />
        <div>
          <Button onClick={run} disabled={!input}>
            Decode
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-500/50">
          <CardContent className="p-4 text-sm text-red-500">{error}</CardContent>
        </Card>
      )}

      {output && !error && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label>Decoded output</Label>
            <Textarea readOnly value={output} className="min-h-[140px]" />
            <Button variant="outline" onClick={copy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
