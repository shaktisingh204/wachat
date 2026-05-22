'use client';

import { Button, Textarea, Card, ZoruCardContent, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function JsonFormatterPage() {
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const format = () => {
    setError('');
    try { setText(JSON.stringify(JSON.parse(text), null, 2)); } catch (e: any) { setError(e?.message || 'invalid JSON'); }
  };
  const minify = () => {
    setError('');
    try { setText(JSON.stringify(JSON.parse(text))); } catch (e: any) { setError(e?.message || 'invalid JSON'); }
  };

  return (
    <ToolShell title="JSON Formatter" description="Format or minify JSON with validation.">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[260px] font-mono text-xs" placeholder='{"hello": "world"}' />
      <div className="flex gap-2">
        <Button onClick={format}>Format</Button>
        <Button variant="outline" onClick={minify}>Minify</Button>
      </div>
      {error && <Card className="border-red-500"><ZoruCardContent className="p-4 text-red-600 text-sm">{error}</ZoruCardContent></Card>}
    </ToolShell>
  );
}
