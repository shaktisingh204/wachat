'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function SitemapGeneratorPage() {
  const [urls, setUrls] = useState('https://example.com/\nhttps://example.com/about');
  const [priority, setPriority] = useState('0.8');
  const [changefreq, setChangefreq] = useState('weekly');
  const xml = useMemo(() => {
    const list = urls.split(/\r?\n/).map((u) => u.trim()).filter(Boolean);
    const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
    for (const u of list) {
      lines.push('  <url>');
      lines.push(`    <loc>${u}</loc>`);
      lines.push(`    <changefreq>${changefreq}</changefreq>`);
      lines.push(`    <priority>${priority}</priority>`);
      lines.push('  </url>');
    }
    lines.push('</urlset>');
    return lines.join('\n');
  }, [urls, priority, changefreq]);

  const download = () => {
    const blob = new Blob([xml], { type: 'application/xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sitemap.xml';
    a.click();
  };

  return (
    <ToolShell title="XML Sitemap Generator" description="Generate a sitemap.xml from a list of URLs.">
      <Textarea value={urls} onChange={(e) => setUrls(e.target.value)} className="min-h-[180px] font-mono text-xs" placeholder="One URL per line…" />
      <div className="flex gap-2">
        <Input value={priority} onChange={(e) => setPriority(e.target.value)} className="w-32" placeholder="priority" />
        <select className="border rounded h-9 px-2 bg-background" value={changefreq} onChange={(e) => setChangefreq(e.target.value)}>
          <option>always</option><option>hourly</option><option>daily</option><option>weekly</option><option>monthly</option><option>yearly</option><option>never</option>
        </select>
        <Button onClick={download}>Download XML</Button>
      </div>
      <Textarea readOnly value={xml} className="min-h-[240px] font-mono text-xs" />
    </ToolShell>
  );
}
