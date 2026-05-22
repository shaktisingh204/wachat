'use client';

import { Textarea, Card, ZoruCardContent, cn } from '@/components/zoruui';
import { cn as _zoruCn, useMemo, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function SchemaValidatorPage() {
  const [raw, setRaw] = useState('');
  const result = useMemo(() => {
    if (!raw.trim()) return null;
    try {
      const clean = raw.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      const parsed = JSON.parse(clean);
      return { ok: true, parsed };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'invalid JSON' };
    }
  }, [raw]);

  return (
    <ToolShell title="Schema Validator" description="Validate and inspect JSON-LD structured data.">
      <Textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Paste JSON-LD or <script> tag…" className="min-h-[240px] font-mono text-xs" />
      {result?.ok === false && <Card className="border-red-500"><ZoruCardContent className="p-4 text-red-600 text-sm">{result.error}</ZoruCardContent></Card>}
      {result?.ok && (
        <Card><ZoruCardContent className="p-4 space-y-2">
          <div className="text-sm"><span className="font-semibold">@context:</span> {result.parsed['@context'] || <span className="text-muted-foreground">—</span>}</div>
          <div className="text-sm"><span className="font-semibold">@type:</span> {result.parsed['@type'] || <span className="text-muted-foreground">—</span>}</div>
          <pre className="text-xs bg-muted p-3 rounded overflow-auto">{JSON.stringify(result.parsed, null, 2)}</pre>
        </ZoruCardContent></Card>
      )}
    </ToolShell>
  );
}
