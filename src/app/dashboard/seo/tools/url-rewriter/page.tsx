'use client';

import { cn as _zoruCn } from '@/components/zoruui';
void _zoruCn;

import { useMemo, useState } from 'react';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruSwitch } from '@/components/zoruui';
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
      <ZoruInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://old.example.com/path" />
      <div className="grid grid-cols-2 gap-2">
        <ZoruInput value={find} onChange={(e) => setFind(e.target.value)} placeholder="find" />
        <ZoruInput value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="replace with" />
      </div>
      <div className="flex items-center gap-2"><ZoruSwitch checked={regex} onCheckedChange={setRegex} /><ZoruLabel>Regex</ZoruLabel></div>
      <div className="font-mono text-xs bg-muted p-3 rounded break-all">{out || '—'}</div>
    </ToolShell>
  );
}
