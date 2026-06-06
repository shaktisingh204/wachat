'use client';

import { Textarea, Card, ZoruCardContent, cn } from '@/components/sabcrm/20ui/compat';
import { cn as _zoruCn, useMemo, useState } from 'react';
import { validateSchema } from './validator';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function SchemaValidatorPage() {
  const [raw, setRaw] = useState('');
  const result = useMemo(() => {
    if (!raw.trim()) return null;
    try {
      const clean = raw.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
      const parsed = JSON.parse(clean);
      
      const rawType = parsed['@type'];
      const type = Array.isArray(rawType) ? rawType[0] : rawType;
      
      let validation: any = null;
      if (type) {
        validation = validateSchema(type, parsed);
      }
      
      return { ok: true, parsed, validation };
    } catch (e: any) {
      return { ok: false, error: e?.message || 'invalid JSON' };
    }
  }, [raw]);

  return (
    <ToolShell title="Schema Validator" description="Validate and inspect JSON-LD structured data.">
      <Textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Paste JSON-LD or <script> tag…" className="min-h-[240px] font-mono text-xs" />
      {result?.ok === false && <Card className="border-[var(--st-border)]"><ZoruCardContent className="p-4 text-[var(--st-text)] text-sm">{result.error}</ZoruCardContent></Card>}
      {result?.ok && (
        <Card><ZoruCardContent className="p-4 space-y-4">
          <div className="space-y-2">
            <div className="text-sm"><span className="font-semibold">@context:</span> {result.parsed['@context'] || <span className="text-[var(--st-text-secondary)]">—</span>}</div>
            <div className="text-sm"><span className="font-semibold">@type:</span> {result.parsed['@type'] || <span className="text-[var(--st-text-secondary)]">—</span>}</div>
          </div>
          
          {result.validation && result.validation.valid === true && (
            <div className="p-3 bg-[var(--st-bg-muted)] text-[var(--st-text)] rounded-md border border-[var(--st-border)] flex items-start gap-2 text-sm">
              <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Valid {result.parsed['@type']} Schema</p>
                <p>All required Google Rich Results fields are present.</p>
              </div>
            </div>
          )}

          {result.validation && result.validation.valid === false && (
            <div className="p-3 bg-[var(--st-bg-muted)] text-[var(--st-text)] rounded-md border border-[var(--st-border)] flex items-start gap-2 text-sm">
              <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Invalid {result.parsed['@type']} Schema</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {result.validation.errors?.map((err: any, i: number) => (
                    <li key={i}>{err.instancePath || 'Root'} {err.message}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {result.parsed['@type'] && result.validation?.valid === null && (
            <div className="text-xs text-[var(--st-text-secondary)] italic">
              Note: No strict validation rules defined yet for "@type": {result.parsed['@type']}.
            </div>
          )}

          <pre className="text-xs bg-[var(--st-bg-muted)] p-3 rounded overflow-auto">{JSON.stringify(result.parsed, null, 2)}</pre>
        </ZoruCardContent></Card>
      )}
    </ToolShell>
  );
}
