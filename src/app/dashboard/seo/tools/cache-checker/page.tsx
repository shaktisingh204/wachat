'use client';

import { cn as _zoruCn, ZoruButton } from '@/components/zoruui';
void _zoruCn;

import { useState } from 'react';
import { ZoruInput } from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruCard, ZoruCardContent } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function CacheCheckerPage() {
  const [url, setUrl] = useState('');
  const [submitted, setSubmitted] = useState('');

  return (
    <ToolShell title="Google Cache Checker" description="Open a URL in Google Cache or Wayback Machine.">
      <div className="flex gap-2">
        <ZoruInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        <ZoruButton onClick={() => setSubmitted(url)}>Check</ZoruButton>
      </div>
      {submitted && (
        <ZoruCard><ZoruCardContent className="p-4 space-y-2">
          <a className="block text-sm text-blue-600 hover:underline break-all" target="_blank" rel="noopener" href={`https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(submitted)}`}>🔗 View Google Cache</a>
          <a className="block text-sm text-blue-600 hover:underline break-all" target="_blank" rel="noopener" href={`https://web.archive.org/web/*/${encodeURIComponent(submitted)}`}>🔗 View Wayback Machine</a>
        </ZoruCardContent></ZoruCard>
      )}
    </ToolShell>
  );
}
