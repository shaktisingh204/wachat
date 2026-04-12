'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';

const ALGOS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const;

export default function HashGeneratorPage() {
  const [text, setText] = useState('');
  const [algo, setAlgo] = useState<(typeof ALGOS)[number]>('SHA-256');
  const [hash, setHash] = useState('');

  const run = async () => {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest(algo, data);
    setHash(Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join(''));
  };

  return (
    <ToolShell title="Hash Generator" description="Generate SHA-1/256/384/512 hashes via Web Crypto (MD5 not supported).">
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Text to hash…" className="min-h-[140px]" />
      <div className="flex items-end gap-3">
        <div className="space-y-1"><Label>Algorithm</Label>
          <select className="border rounded h-9 px-2 bg-background" value={algo} onChange={(e) => setAlgo(e.target.value as any)}>
            {ALGOS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <Button onClick={run}>Generate</Button>
        {hash && <Button variant="outline" onClick={() => navigator.clipboard.writeText(hash)}>Copy</Button>}
      </div>
      {hash && <Card><CardContent className="p-4"><div className="font-mono text-xs break-all">{hash}</div></CardContent></Card>}
    </ToolShell>
  );
}
