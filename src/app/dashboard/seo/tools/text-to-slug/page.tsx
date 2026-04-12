'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { toSlug } from '@/lib/seo-tools/text-utils';

export default function TextToSlugPage() {
  const [text, setText] = useState('');
  const slug = useMemo(() => toSlug(text), [text]);

  return (
    <ToolShell title="Text to Slug" description="Convert text to URL-friendly slug (SEO-safe).">
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Best SEO Tools for 2026!" />
      <Card>
        <CardContent className="p-4 font-mono text-sm break-all">
          {slug || <span className="text-muted-foreground">Your slug will appear here…</span>}
        </CardContent>
      </Card>
    </ToolShell>
  );
}
