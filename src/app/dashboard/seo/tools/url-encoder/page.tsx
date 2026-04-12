'use client';

import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

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
        <Label>Input text</Label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste text to encode…"
          className="min-h-[140px]"
        />
        <div>
          <Button onClick={run} disabled={!input}>
            Encode
          </Button>
        </div>
      </div>

      {output && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label>Encoded output</Label>
            <Textarea readOnly value={output} className="min-h-[140px] font-mono text-sm" />
            <Button variant="outline" onClick={copy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
