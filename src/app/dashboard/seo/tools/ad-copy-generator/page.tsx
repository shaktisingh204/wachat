'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function AdCopyGeneratorPage() {
  const [product, setProduct] = useState('SEO Tools');
  const [audience, setAudience] = useState('small business owners');
  const [keyword, setKeyword] = useState('seo tools');
  const [tone, setTone] = useState('friendly');

  const copy = useMemo(() => {
    const headlines = [
      `Best ${product} for ${audience}`,
      `${keyword[0].toUpperCase() + keyword.slice(1)} — Now 50% Off`,
      `Trusted by ${audience} — Try ${product} Free`,
    ];
    const descriptions = [
      `Looking for ${keyword}? Get ${product} built for ${audience}. Start free today, no credit card required.`,
      `${tone === 'urgent' ? 'Limited time: ' : ''}Grow faster with ${product}. Trusted by ${audience} worldwide.`,
    ];
    return { headlines, descriptions };
  }, [product, audience, keyword, tone]);

  return (
    <ToolShell title="Ad Copy Generator" description="Generate headlines and descriptions for a PPC ad.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Product / service</Label><Input value={product} onChange={(e) => setProduct(e.target.value)} /></div>
        <div className="space-y-1"><Label>Target audience</Label><Input value={audience} onChange={(e) => setAudience(e.target.value)} /></div>
        <div className="space-y-1"><Label>Target keyword</Label><Input value={keyword} onChange={(e) => setKeyword(e.target.value)} /></div>
        <div className="space-y-1"><Label>Tone</Label>
          <select className="border rounded h-9 px-2 bg-background w-full" value={tone} onChange={(e) => setTone(e.target.value)}>
            <option>friendly</option><option>urgent</option><option>formal</option>
          </select>
        </div>
      </div>
      <Card><CardContent className="p-4 space-y-2">
        <div className="text-sm font-semibold">Headlines</div>
        {copy.headlines.map((h, i) => <div key={i} className="text-sm border-t py-1">{h}</div>)}
        <div className="text-sm font-semibold pt-3">Descriptions</div>
        {copy.descriptions.map((d, i) => <div key={i} className="text-sm border-t py-1">{d}</div>)}
      </CardContent></Card>
    </ToolShell>
  );
}
