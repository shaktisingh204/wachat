'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ToolShell } from '@/components/seo-tools/tool-shell';

export default function MetaTagGeneratorPage() {
  const [fields, setFields] = useState({
    title: '', description: '', keywords: '', author: '', robots: 'index, follow',
    ogTitle: '', ogDescription: '', ogImage: '', ogUrl: '', twitterCard: 'summary_large_image',
  });
  const update = (k: string, v: string) => setFields((f) => ({ ...f, [k]: v }));
  const output = useMemo(() => {
    const lines: string[] = [];
    if (fields.title) lines.push(`<title>${fields.title}</title>`);
    if (fields.description) lines.push(`<meta name="description" content="${fields.description}" />`);
    if (fields.keywords) lines.push(`<meta name="keywords" content="${fields.keywords}" />`);
    if (fields.author) lines.push(`<meta name="author" content="${fields.author}" />`);
    if (fields.robots) lines.push(`<meta name="robots" content="${fields.robots}" />`);
    if (fields.ogTitle) lines.push(`<meta property="og:title" content="${fields.ogTitle}" />`);
    if (fields.ogDescription) lines.push(`<meta property="og:description" content="${fields.ogDescription}" />`);
    if (fields.ogImage) lines.push(`<meta property="og:image" content="${fields.ogImage}" />`);
    if (fields.ogUrl) lines.push(`<meta property="og:url" content="${fields.ogUrl}" />`);
    if (fields.twitterCard) lines.push(`<meta name="twitter:card" content="${fields.twitterCard}" />`);
    return lines.join('\n');
  }, [fields]);

  return (
    <ToolShell title="Meta Tag Generator" description="Generate meta title, description and Open Graph tags.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1"><Label>Title</Label><Input value={fields.title} onChange={(e) => update('title', e.target.value)} /></div>
        <div className="space-y-1"><Label>Author</Label><Input value={fields.author} onChange={(e) => update('author', e.target.value)} /></div>
        <div className="space-y-1 md:col-span-2"><Label>Description</Label><Textarea value={fields.description} onChange={(e) => update('description', e.target.value)} /></div>
        <div className="space-y-1"><Label>Keywords</Label><Input value={fields.keywords} onChange={(e) => update('keywords', e.target.value)} /></div>
        <div className="space-y-1"><Label>Robots</Label><Input value={fields.robots} onChange={(e) => update('robots', e.target.value)} /></div>
        <div className="space-y-1"><Label>OG Title</Label><Input value={fields.ogTitle} onChange={(e) => update('ogTitle', e.target.value)} /></div>
        <div className="space-y-1"><Label>OG Description</Label><Input value={fields.ogDescription} onChange={(e) => update('ogDescription', e.target.value)} /></div>
        <div className="space-y-1"><Label>OG Image URL</Label><Input value={fields.ogImage} onChange={(e) => update('ogImage', e.target.value)} /></div>
        <div className="space-y-1"><Label>OG URL</Label><Input value={fields.ogUrl} onChange={(e) => update('ogUrl', e.target.value)} /></div>
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => navigator.clipboard.writeText(output)}>Copy</Button>
      </div>
      <Textarea readOnly value={output} className="min-h-[240px] font-mono text-xs" />
    </ToolShell>
  );
}
