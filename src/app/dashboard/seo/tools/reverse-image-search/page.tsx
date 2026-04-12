'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function ReverseImageSearchPage() {
  const [url, setUrl] = useState('');
  const [submitted, setSubmitted] = useState('');

  const links = submitted
    ? [
        { name: 'Google Lens', href: `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(submitted)}` },
        { name: 'TinEye', href: `https://tineye.com/search?url=${encodeURIComponent(submitted)}` },
        { name: 'Yandex', href: `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(submitted)}` },
        { name: 'Bing Visual', href: `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${encodeURIComponent(submitted)}` },
      ]
    : [];

  return (
    <ToolShell title="Reverse Image Search" description="Search for an image across multiple reverse-image engines.">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
        <Button onClick={() => setSubmitted(url)}>Search</Button>
      </div>
      {links.length > 0 && (
        <Card><CardContent className="p-4 space-y-2">
          {links.map((l) => (
            <a key={l.name} className="block text-sm text-blue-600 hover:underline" target="_blank" rel="noopener" href={l.href}>🔗 Search on {l.name}</a>
          ))}
        </CardContent></Card>
      )}
    </ToolShell>
  );
}
