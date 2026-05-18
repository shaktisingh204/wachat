'use client';

import { ZoruButton, ZoruInput, ZoruCard, ZoruCardContent, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

export default function AltTextCheckerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<{ src: string; alt: string }[]>([]);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true); setError(''); setImages([]);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) setError(r.error);
      else setImages(parseHtml(r.body).images);
    } finally { setLoading(false); }
  };

  const missing = images.filter((i) => !i.alt).length;

  return (
    <ToolShell title="Alt Text Checker" description="Find images missing alt attributes on any page.">
      <div className="flex gap-2">
        <ZoruInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        <ZoruButton onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Check'}</ZoruButton>
      </div>
      {error && <ZoruCard className="border-red-500"><ZoruCardContent className="p-4 text-red-600 text-sm">{error}</ZoruCardContent></ZoruCard>}
      {images.length > 0 && (
        <>
          <div className="text-sm text-muted-foreground">{images.length} images · <span className="text-red-600 font-semibold">{missing} missing alt</span></div>
          <ZoruCard><ZoruCardContent className="p-0">
            <table className="w-full text-xs">
              <thead><tr className="border-b"><th className="text-left p-2">Image</th><th className="text-left p-2">Alt</th></tr></thead>
              <tbody>
                {images.map((img, i) => (
                  <tr key={i} className={`border-b ${!img.alt ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                    <td className="p-2 font-mono truncate max-w-xs">{img.src}</td>
                    <td className="p-2">{img.alt || <span className="text-red-600">(missing)</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ZoruCardContent></ZoruCard>
        </>
      )}
    </ToolShell>
  );
}
