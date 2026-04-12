'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function UtmBuilderPage() {
  const [base, setBase] = useState('');
  const [u, setU] = useState({ source: '', medium: '', campaign: '', term: '', content: '' });
  const set = (k: string, v: string) => setU((s) => ({ ...s, [k]: v }));
  const out = useMemo(() => {
    try {
      if (!base) return '';
      const url = new URL(base);
      if (u.source) url.searchParams.set('utm_source', u.source);
      if (u.medium) url.searchParams.set('utm_medium', u.medium);
      if (u.campaign) url.searchParams.set('utm_campaign', u.campaign);
      if (u.term) url.searchParams.set('utm_term', u.term);
      if (u.content) url.searchParams.set('utm_content', u.content);
      return url.toString();
    } catch { return ''; }
  }, [base, u]);

  return (
    <ToolShell title="UTM Link Builder" description="Generate a UTM-tagged URL for campaign tracking.">
      <div className="space-y-1"><Label>Base URL</Label><Input value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://example.com/landing" /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1"><Label>utm_source</Label><Input value={u.source} onChange={(e) => set('source', e.target.value)} placeholder="google" /></div>
        <div className="space-y-1"><Label>utm_medium</Label><Input value={u.medium} onChange={(e) => set('medium', e.target.value)} placeholder="cpc" /></div>
        <div className="space-y-1 md:col-span-2"><Label>utm_campaign</Label><Input value={u.campaign} onChange={(e) => set('campaign', e.target.value)} placeholder="spring_sale" /></div>
        <div className="space-y-1"><Label>utm_term</Label><Input value={u.term} onChange={(e) => set('term', e.target.value)} /></div>
        <div className="space-y-1"><Label>utm_content</Label><Input value={u.content} onChange={(e) => set('content', e.target.value)} /></div>
      </div>
      {out && <><div className="font-mono text-xs bg-muted p-3 rounded break-all">{out}</div><Button onClick={() => navigator.clipboard.writeText(out)}>Copy</Button></>}
    </ToolShell>
  );
}
