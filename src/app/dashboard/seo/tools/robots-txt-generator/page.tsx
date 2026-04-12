'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function RobotsTxtGeneratorPage() {
  const [ua, setUa] = useState('*');
  const [disallow, setDisallow] = useState('/admin\n/private');
  const [allow, setAllow] = useState('');
  const [sitemap, setSitemap] = useState('');
  const [crawlDelay, setCrawlDelay] = useState('');

  const out = useMemo(() => {
    const lines = [`User-agent: ${ua || '*'}`];
    for (const d of disallow.split(/\r?\n/).filter(Boolean)) lines.push(`Disallow: ${d}`);
    for (const a of allow.split(/\r?\n/).filter(Boolean)) lines.push(`Allow: ${a}`);
    if (crawlDelay) lines.push(`Crawl-delay: ${crawlDelay}`);
    if (sitemap) lines.push(`Sitemap: ${sitemap}`);
    return lines.join('\n');
  }, [ua, disallow, allow, sitemap, crawlDelay]);

  const download = () => {
    const blob = new Blob([out], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'robots.txt';
    a.click();
  };

  return (
    <ToolShell title="Robots.txt Generator" description="Generate a robots.txt file.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1"><Label>User-agent</Label><Input value={ua} onChange={(e) => setUa(e.target.value)} /></div>
        <div className="space-y-1"><Label>Crawl-delay</Label><Input value={crawlDelay} onChange={(e) => setCrawlDelay(e.target.value)} /></div>
        <div className="space-y-1 md:col-span-2"><Label>Sitemap URL</Label><Input value={sitemap} onChange={(e) => setSitemap(e.target.value)} /></div>
        <div className="space-y-1"><Label>Disallow (one per line)</Label><Textarea value={disallow} onChange={(e) => setDisallow(e.target.value)} className="min-h-[100px] font-mono text-xs" /></div>
        <div className="space-y-1"><Label>Allow (one per line)</Label><Textarea value={allow} onChange={(e) => setAllow(e.target.value)} className="min-h-[100px] font-mono text-xs" /></div>
      </div>
      <Button onClick={download}>Download robots.txt</Button>
      <Textarea readOnly value={out} className="min-h-[180px] font-mono text-xs" />
    </ToolShell>
  );
}
