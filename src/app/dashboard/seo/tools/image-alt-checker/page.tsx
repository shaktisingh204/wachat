'use client';

import { Button, Card, ZoruCardContent, Input, Label, Badge, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

type ImageData = { src: string; alt: string; hasAlt?: boolean; type?: 'img' | 'bg' };

export default function ImageAltCheckerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ImageData[]>([]);
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
      
      const imgs: ImageData[] = (parsed.images || []).map(img => ({ ...img, type: 'img' }));
      
      // Check background images in CSS (advanced)
      const bgRegex = /url\(\s*['"]?(.*?)['"]?\s*\)/gi;
      let match;
      const bgImagesSet = new Set<string>();
      while ((match = bgRegex.exec(res.body || '')) !== null) {
        let bgUrl = match[1];
        if (bgUrl && !bgUrl.startsWith('data:')) {
          bgUrl = bgUrl.replace(/\\['"]/g, '').replace(/&quot;/g, '').trim();
          if (bgUrl) bgImagesSet.add(bgUrl);
        }
      }
      
      bgImagesSet.forEach(bgUrl => {
        imgs.push({ src: bgUrl, alt: '', hasAlt: false, type: 'bg' });
      });

      setImages(imgs);
    } catch (e: any) {
      setErr(e?.message || 'Failed to fetch URL');
    } finally {
      setLoading(false);
    }
  }

  const imgTags = images.filter((i) => i.type === 'img');
  const bgTags = images.filter((i) => i.type === 'bg');
  
  const missingAlt = imgTags.filter((i) => !i.hasAlt).length;
  const decorativeAlt = imgTags.filter((i) => i.hasAlt && !i.alt.trim()).length;
  const goodAlt = imgTags.filter((i) => i.hasAlt && i.alt.trim()).length;

  return (
    <ToolShell title="Image Alt Checker" description="Audit a page for images missing descriptive alt text, decorative images, and background images.">
      <Card>
        <ZoruCardContent className="p-4 space-y-4">
          <div>
            <Label>Page URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
          </div>
          <Button onClick={run} disabled={loading || !url.trim()}>
            {loading ? 'Checking…' : 'Check'}
          </Button>
          {err && <div className="text-sm text-destructive">{err}</div>}
        </ZoruCardContent>
      </Card>
      
      {images.length > 0 && (
        <Card>
          <ZoruCardContent className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{imgTags.length} &lt;img&gt; tags</Badge>
              {bgTags.length > 0 && <Badge variant="outline">{bgTags.length} background images</Badge>}
              <Badge variant={missingAlt ? 'destructive' : 'default'}>{missingAlt} missing alt attr</Badge>
              <Badge variant="secondary">{decorativeAlt} decorative (empty alt)</Badge>
              <Badge variant="default">{goodAlt} with alt text</Badge>
            </div>
            
            <div className="space-y-3">
              {images.map((img, i) => {
                const isBg = img.type === 'bg';
                const isMissingAlt = !isBg && !img.hasAlt;
                const isDecorative = !isBg && img.hasAlt && !img.alt.trim();
                const isGood = !isBg && img.hasAlt && img.alt.trim();
                
                let borderColor = 'border-border';
                let bgColor = '';
                let statusText = '';
                let badgeVariant: 'default' | 'destructive' | 'secondary' | 'outline' = 'default';
                
                if (isBg) {
                  borderColor = 'border-muted';
                  statusText = 'CSS Background Image';
                  badgeVariant = 'outline';
                } else if (isMissingAlt) {
                  borderColor = 'border-destructive';
                  bgColor = 'bg-destructive/10';
                  statusText = 'Missing alt attribute';
                  badgeVariant = 'destructive';
                } else if (isDecorative) {
                  borderColor = 'border-yellow-500/50';
                  bgColor = 'bg-yellow-500/10';
                  statusText = 'Decorative (empty alt)';
                  badgeVariant = 'secondary';
                } else if (isGood) {
                  borderColor = 'border-green-500/50';
                  bgColor = 'bg-green-500/10';
                  statusText = 'Good alt text';
                  badgeVariant = 'default';
                }

                return (
                  <div
                    key={i}
                    className={`p-3 rounded border text-sm break-all space-y-1.5 ${borderColor} ${bgColor}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-mono font-medium truncate flex-1" title={img.src || '(no src)'}>{img.src || '(no src)'}</div>
                      <Badge variant={badgeVariant} className="whitespace-nowrap">
                        {statusText}
                      </Badge>
                    </div>
                    
                    {!isBg && (
                      <div className="text-xs text-muted-foreground font-mono">
                        alt="{img.hasAlt ? img.alt : ''}"
                        {!img.hasAlt && <span className="text-destructive font-semibold ml-2">(attribute missing)</span>}
                        {isDecorative && <span className="text-yellow-600 dark:text-yellow-400 font-semibold ml-2">(decorative)</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
