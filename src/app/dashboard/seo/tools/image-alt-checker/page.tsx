'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <Label>Page URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
          </div>
          <Button onClick={run} disabled={loading || !url.trim()}>
            {loading ? 'Checking…' : 'Check'}
          </Button>
          {err && <div className="text-sm text-destructive">{err}</div>}
        </CardContent>
      </Card>
      {images.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="text-sm">
              <Badge variant="secondary">{images.length} images</Badge>{' '}
              <Badge variant={missing ? 'destructive' : 'default'}>{missing} missing alt</Badge>
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
          </CardContent>
        </Card>
      )}
    </ToolShell>
  );
}
