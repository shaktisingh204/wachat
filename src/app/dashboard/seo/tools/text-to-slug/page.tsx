'use client';

import { Card, ZoruCardContent, Input, cn } from '@/components/zoruui';
import { cn as _zoruCn, useMemo, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { toSlug } from '@/lib/seo-tools/text-utils';

export default function TextToSlugPage() {
  const [text, setText] = useState('');
  const slug = useMemo(() => toSlug(text), [text]);

  return (
    <ToolShell title="Text to Slug" description="Convert text to URL-friendly slug (SEO-safe).">
      <ZoruInput value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Best SEO Tools for 2026!" />
      <ZoruCard>
        <ZoruCardContent className="p-4 font-mono text-sm break-all">
          {slug || <span className="text-muted-foreground">Your slug will appear here…</span>}
        </ZoruCardContent>
      </ZoruCard>
    </ToolShell>
  );
}
