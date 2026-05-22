'use client';

import { Button, Input, Card, ZoruCardContent, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function IndexedPagesPage() {
  const [domain, setDomain] = useState('');
  const [submitted, setSubmitted] = useState('');

  return (
    <ToolShell title="Indexed Pages Checker" description="Open Google's site: query to see indexed pages for a domain.">
      <div className="flex gap-2">
        <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="example.com" />
        <Button onClick={() => setSubmitted(domain)}>Check</Button>
      </div>
      {submitted && (
        <Card><ZoruCardContent className="p-4 space-y-2">
          <a className="block text-sm text-blue-600 hover:underline" target="_blank" rel="noopener" href={`https://www.google.com/search?q=site:${encodeURIComponent(submitted)}`}>🔗 Google: site:{submitted}</a>
          <a className="block text-sm text-blue-600 hover:underline" target="_blank" rel="noopener" href={`https://www.bing.com/search?q=site:${encodeURIComponent(submitted)}`}>🔗 Bing: site:{submitted}</a>
        </ZoruCardContent></Card>
      )}
    </ToolShell>
  );
}
