'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function CacheCheckerPage() {
  const [url, setUrl] = useState('');
  const [submitted, setSubmitted] = useState('');

  return (
    <ToolShell title="Google Cache Checker" description="Open a URL in Google Cache or Wayback Machine.">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        <Button onClick={() => setSubmitted(url)}>Check</Button>
      </div>
      {submitted && (
        <Card><CardContent className="p-4 space-y-2">
          <a className="block text-sm text-blue-600 hover:underline break-all" target="_blank" rel="noopener" href={`https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(submitted)}`}>🔗 View Google Cache</a>
          <a className="block text-sm text-blue-600 hover:underline break-all" target="_blank" rel="noopener" href={`https://web.archive.org/web/*/${encodeURIComponent(submitted)}`}>🔗 View Wayback Machine</a>
        </CardContent></Card>
      )}
    </ToolShell>
  );
}
