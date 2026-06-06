'use client';

import {
  Button,
  Textarea,
  Card,
  ZoruCardContent,
  Label,
  cn,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function UrlEncoderPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [type, setType] = useState<'component' | 'complete'>('component');

  const run = () => {
    try {
      if (mode === 'encode') {
        if (type === 'component') {
          setOutput(encodeURIComponent(input));
        } else {
          setOutput(encodeURI(input));
        }
      } else {
        if (type === 'component') {
          // For decoding payload component, handle '+' as space often found in form data
          // But standard decodeURIComponent doesn't do this. We'll do standard.
          setOutput(decodeURIComponent(input.replace(/\+/g, '%20')));
        } else {
          setOutput(decodeURI(input.replace(/\+/g, '%20')));
        }
      }
    } catch (err: any) {
      setOutput(`Error: ${err.message}`);
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
    <ToolShell title="URL Encoder / Decoder" description="Encode or decode text and complete URLs.">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-col gap-1.5">
            <Label>Action</Label>
            <Select value={mode} onValueChange={(val: 'encode' | 'decode') => setMode(val)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="encode">Encode</SelectItem>
                <SelectItem value="decode">Decode</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(val: 'component' | 'complete') => setType(val)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="component">URI Component</SelectItem>
                <SelectItem value="complete">Complete URI</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Label>Input text</Label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Paste text to ${mode}…`}
            className="min-h-[140px]"
          />
          <div>
            <Button onClick={run} disabled={!input}>
              {mode === 'encode' ? 'Encode' : 'Decode'}
            </Button>
          </div>
        </div>
      </div>

      {output && (
        <Card className="mt-6">
          <ZoruCardContent className="p-4 space-y-3">
            <Label>Output</Label>
            <Textarea readOnly value={output} className="min-h-[140px] font-mono text-sm" />
            <Button variant="outline" onClick={copy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
