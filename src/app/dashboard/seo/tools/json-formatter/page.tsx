'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useState } from 'react';
import { ZoruButton } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
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
      <ZoruTextarea value={text} onChange={(e) => setText(e.target.value)} className="min-h-[260px] font-mono text-xs" placeholder='{"hello": "world"}' />
      <div className="flex gap-2">
        <ZoruButton onClick={format}>Format</ZoruButton>
        <ZoruButton variant="outline" onClick={minify}>Minify</ZoruButton>
      </div>
      {error && <ZoruCard className="border-red-500"><ZoruCardContent className="p-4 text-red-600 text-sm">{error}</ZoruCardContent></ZoruCard>}
    </ToolShell>
  );
}
