'use client';

import { Button, Textarea, Card, CardBody, Label, cn, Table, THead, TBody, Tr, Th, Td } from '@/components/sabcrm/20ui';
import { cn as _zoruCn, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

void _zoruCn;

export default function UrlDecoderPage() {
  const [mode, setMode] = useState<'decode' | 'encode'>('decode');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleModeSwitch = (newMode: 'decode' | 'encode') => {
    setMode(newMode);
    setInput(output);
    setOutput('');
    setError('');
  };

  const run = () => {
    setError('');
    try {
      if (mode === 'decode') {
        setOutput(decodeURIComponent(input));
      } else {
        setOutput(encodeURIComponent(input));
      }
    } catch (e: unknown) {
      setOutput('');
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Invalid input.');
      }
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

  const getParsedParams = (urlStr: string) => {
    if (!urlStr) return null;
    try {
      let searchParams: URLSearchParams;
      
      if (urlStr.includes('://')) {
        const url = new URL(urlStr);
        searchParams = url.searchParams;
      } else if (urlStr.includes('?')) {
        const search = urlStr.substring(urlStr.indexOf('?'));
        searchParams = new URLSearchParams(search);
      } else if (urlStr.includes('=')) {
        searchParams = new URLSearchParams(urlStr);
      } else {
        return null;
      }

      const params: Record<string, string> = {};
      let hasParams = false;
      searchParams.forEach((value, key) => {
        params[key] = value;
        hasParams = true;
      });
      
      return hasParams ? params : null;
    } catch {
      return null;
    }
  };

  const params = mode === 'decode' ? getParsedParams(output) : getParsedParams(input);

  return (
    <ToolShell 
      title={mode === 'decode' ? 'URL Decoder' : 'URL Encoder'} 
      description={mode === 'decode' ? 'Decode percent-encoded URLs back to plain text.' : 'Percent-encode URLs for safe transmission.'}
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Button 
            variant={mode === 'decode' ? 'default' : 'outline'} 
            onClick={() => handleModeSwitch('decode')}
          >
            Decode Mode
          </Button>
          <Button 
            variant={mode === 'encode' ? 'default' : 'outline'} 
            onClick={() => handleModeSwitch('encode')}
          >
            Encode Mode
          </Button>
        </div>

        <div className="flex flex-col gap-3">
          <Label>{mode === 'decode' ? 'Encoded input' : 'Plain input'}</Label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'decode' ? 'Paste an encoded URL…' : 'Paste a plain URL…'}
            className="min-h-[140px] font-mono text-sm"
          />
          <div>
            <Button onClick={run} disabled={!input}>
              {mode === 'decode' ? 'Decode' : 'Encode'}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <Card className="border-[var(--st-border)]/50 mt-4">
          <CardBody className="p-4 text-sm text-[var(--st-text)]">{error}</CardBody>
        </Card>
      )}

      {output && !error && (
        <Card className="mt-4">
          <CardBody className="p-4 space-y-3">
            <Label>{mode === 'decode' ? 'Decoded output' : 'Encoded output'}</Label>
            <Textarea readOnly value={output} className="min-h-[140px]" />
            <Button variant="outline" onClick={copy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </CardBody>
        </Card>
      )}

      {params && Object.keys(params).length > 0 && (
        <Card className="mt-4">
          <CardBody className="p-4 space-y-3">
            <Label>Query Parameters</Label>
            <div className="rounded-md border">
              <Table>
                <THead>
                  <Tr>
                    <Th className="w-[30%]">Key</Th>
                    <Th>Value</Th>
                  </Tr>
                </THead>
                <TBody>
                  {Object.entries(params).map(([key, value], idx) => (
                    <Tr key={idx}>
                      <Td className="font-mono">{key}</Td>
                      <Td className="font-mono">{value}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </div>
          </CardBody>
        </Card>
      )}
    </ToolShell>
  );
}
