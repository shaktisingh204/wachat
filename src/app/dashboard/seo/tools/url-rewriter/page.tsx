'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function UrlRewriterPage() {
  const [url, setUrl] = useState('');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [regex, setRegex] = useState(false);

  const out = useMemo(() => {
    if (!url || !find) return url;
    try {
      const re = regex ? new RegExp(find, 'g') : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      return url.replace(re, replace);
    } catch { return url; }
  }, [url, find, replace, regex]);

  return (
    <ToolShell title="URL Rewriter" description="Find and replace text in a URL with optional regex.">
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://old.example.com/path" />
      <div className="grid grid-cols-2 gap-2">
        <Input value={find} onChange={(e) => setFind(e.target.value)} placeholder="find" />
        <Input value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="replace with" />
      </div>
      <div className="flex items-center gap-2"><Switch checked={regex} onCheckedChange={setRegex} /><Label>Regex</Label></div>
      <div className="font-mono text-xs bg-muted p-3 rounded break-all">{out || '—'}</div>
    </ToolShell>
  );
}
