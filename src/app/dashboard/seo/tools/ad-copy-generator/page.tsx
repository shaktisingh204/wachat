'use client';

import { Card, ZoruCardContent, Input, Label } from '@/components/zoruui';
import { useMemo, useState } from 'react';

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
        <div className="space-y-1"><ZoruLabel>Product / service</ZoruLabel><ZoruInput value={product} onChange={(e) => setProduct(e.target.value)} /></div>
        <div className="space-y-1"><ZoruLabel>Target audience</ZoruLabel><ZoruInput value={audience} onChange={(e) => setAudience(e.target.value)} /></div>
        <div className="space-y-1"><ZoruLabel>Target keyword</ZoruLabel><ZoruInput value={keyword} onChange={(e) => setKeyword(e.target.value)} /></div>
        <div className="space-y-1"><ZoruLabel>Tone</ZoruLabel>
          <select className="border border-zoru-line rounded-[var(--zoru-radius)] h-9 px-2 bg-zoru-bg text-zoru-ink w-full text-sm" value={tone} onChange={(e) => setTone(e.target.value)}>
            <option>friendly</option><option>urgent</option><option>formal</option>
          </select>
        </div>
      </div>
      <ZoruCard><ZoruCardContent className="p-4 space-y-2">
        <div className="text-sm text-zoru-ink">Headlines</div>
        {copy.headlines.map((h, i) => <div key={i} className="text-sm border-t border-zoru-line py-1 text-zoru-ink">{h}</div>)}
        <div className="text-sm text-zoru-ink pt-3">Descriptions</div>
        {copy.descriptions.map((d, i) => <div key={i} className="text-sm border-t border-zoru-line py-1 text-zoru-ink">{d}</div>)}
      </ZoruCardContent></ZoruCard>
    </ToolShell>
  );
}
