'use client';

import { useMemo, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toSlug } from '@/lib/seo-tools/text-utils';

export default function SlugGeneratorPage() {
  const [input, setInput] = useState('');
  const slug = useMemo(() => toSlug(input), [input]);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!slug) return;
    try {
      await navigator.clipboard.writeText(slug);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <ToolShell title="Slug Generator" description="Convert any title or phrase into a URL-safe slug.">
      <div className="flex flex-col gap-3">
        <Label>Text</Label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter a title or sentence…"
          className="min-h-[120px]"
        />
      </div>

      {slug && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label>Generated slug</Label>
            <div className="font-mono text-lg break-all">{slug}</div>
            <Button variant="outline" onClick={copy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
