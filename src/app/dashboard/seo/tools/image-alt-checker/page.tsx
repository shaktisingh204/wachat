'use client';

import { ZoruButton, ZoruCard, ZoruCardContent, ZoruInput, ZoruLabel, ZoruBadge, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

export default function ImageAltCheckerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<{ src: string; alt: string }[]>([]);
  const [err, setErr] = useState('');

  async function run() {
    setErr('');
    setImages([]);
    if (!url.trim()) return;
    setLoading(true);
    try {
      const res = await apiFetchUrl(url.trim());
      if (res.error) throw new Error(res.error);
      const parsed = parseHtml(res.body || '');
      setImages(parsed.images || []);
    } catch (e: any) {
      setErr(e?.message || 'Failed to fetch URL');
    } finally {
      setLoading(false);
    }
  }

  const missing = images.filter((i) => !i.alt || !i.alt.trim()).length;

  return (
    <ToolShell title="Image Alt Checker" description="Audit a page for images missing descriptive alt text.">
      <ZoruCard>
        <ZoruCardContent className="p-4 space-y-4">
          <div>
            <ZoruLabel>Page URL</ZoruLabel>
            <ZoruInput value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
          </div>
          <ZoruButton onClick={run} disabled={loading || !url.trim()}>
            {loading ? 'Checking…' : 'Check'}
          </ZoruButton>
          {err && <div className="text-sm text-destructive">{err}</div>}
        </ZoruCardContent>
      </ZoruCard>
      {images.length > 0 && (
        <ZoruCard>
          <ZoruCardContent className="p-4 space-y-3">
            <div className="text-sm">
              <ZoruBadge variant="secondary">{images.length} images</ZoruBadge>{' '}
              <ZoruBadge variant={missing ? 'destructive' : 'default'}>{missing} missing alt</ZoruBadge>
            </div>
            <div className="space-y-2">
              {images.map((img, i) => {
                const bad = !img.alt || !img.alt.trim();
                return (
                  <div
                    key={i}
                    className={`p-2 rounded border text-sm font-mono break-all ${bad ? 'border-destructive bg-destructive/10' : ''}`}
                  >
                    <div className="truncate">{img.src || '(no src)'}</div>
                    <div className="text-xs text-muted-foreground">alt: {img.alt || '(empty)'}</div>
                  </div>
                );
              })}
            </div>
          </ZoruCardContent>
        </ZoruCard>
      )}
    </ToolShell>
  );
}
