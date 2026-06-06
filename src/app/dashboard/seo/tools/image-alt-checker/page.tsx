'use client';

import { Button, Card, CardBody, Input, Textarea, Label, Badge, cn } from '@/components/sabcrm/20ui/compat';
import { cn as _zoruCn, useState } from 'react';

void _zoruCn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

type ImageData = { src: string; alt: string; hasAlt?: boolean; type?: 'img' | 'bg' };

export default function ImageAltCheckerPage() {
  const [inputType, setInputType] = useState<'url' | 'html'>('url');
  const [url, setUrl] = useState('');
  const [htmlContent, setHtmlContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<ImageData[]>([]);
  const [err, setErr] = useState('');

  async function run() {
    setErr('');
    setImages([]);
    
    if (inputType === 'url' && !url.trim()) return;
    if (inputType === 'html' && !htmlContent.trim()) return;
    
    setLoading(true);
    try {
      let rawHtml = '';
      if (inputType === 'url') {
        const res = await apiFetchUrl(url.trim());
        if (res.error) throw new Error(res.error);
        rawHtml = res.body || '';
      } else {
        rawHtml = htmlContent;
      }
      
      const parsed = parseHtml(rawHtml);
      
      const imgs: ImageData[] = (parsed.images || []).map(img => ({ ...img, type: 'img' }));
      
      // Extract <style> contents and inline style attributes for background image check
      const styleTags = rawHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
      const inlineStyles = rawHtml.match(/style\s*=\s*["']([^"']*)["']/gi) || [];
      const cssContent = styleTags.join(' ') + ' ' + inlineStyles.join(' ');
      
      const bgRegex = /url\(\s*['"]?(.*?)['"]?\s*\)/gi;
      let match;
      const bgImagesSet = new Set<string>();
      while ((match = bgRegex.exec(cssContent)) !== null) {
        let bgUrl = match[1];
        if (bgUrl && !bgUrl.startsWith('data:')) {
          bgUrl = bgUrl.replace(/\\['"]/g, '').replace(/&quot;/g, '').trim();
          // Filter out things that are definitely not images (e.g. #id, about:blank)
          if (bgUrl && !bgUrl.startsWith('#') && !bgUrl.startsWith('about:')) {
            bgImagesSet.add(bgUrl);
          }
        }
      }
      
      bgImagesSet.forEach(bgUrl => {
        imgs.push({ src: bgUrl, alt: '', hasAlt: false, type: 'bg' });
      });

      setImages(imgs);
    } catch (e: any) {
      setErr(`Failed to fetch URL: ${e?.message || 'Unknown error'}. Some websites block automated requests. Try pasting the HTML Source instead.`);
    } finally {
      setLoading(false);
    }
  }

  const imgTags = images.filter((i) => i.type === 'img');
  const bgTags = images.filter((i) => i.type === 'bg');
  
  const missingAlt = imgTags.filter((i) => !i.hasAlt).length;
  const decorativeAlt = imgTags.filter((i) => i.hasAlt && !i.alt.trim()).length;
  const longAlt = imgTags.filter((i) => i.hasAlt && i.alt.trim().length > 125).length;
  const goodAlt = imgTags.filter((i) => i.hasAlt && i.alt.trim().length > 0 && i.alt.trim().length <= 125).length;

  return (
    <ToolShell title="Image Alt Checker" description="Audit a page for images missing descriptive alt text, decorative images, and background images.">
      <Card>
        <CardBody className="p-4 space-y-4">
          <div className="flex gap-2">
            <Button variant={inputType === 'url' ? 'default' : 'outline'} onClick={() => setInputType('url')} size="sm">URL</Button>
            <Button variant={inputType === 'html' ? 'default' : 'outline'} onClick={() => setInputType('html')} size="sm">HTML Source</Button>
          </div>
          <div>
            {inputType === 'url' ? (
              <>
                <Label>Page URL</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
              </>
            ) : (
              <>
                <Label>HTML Source</Label>
                <Textarea value={htmlContent} onChange={(e) => setHtmlContent(e.target.value)} placeholder="Paste HTML code here..." className="font-mono min-h-[150px]" />
              </>
            )}
          </div>
          <Button onClick={run} disabled={loading || (inputType === 'url' ? !url.trim() : !htmlContent.trim())}>
            {loading ? 'Checking…' : 'Check'}
          </Button>
          {err && <div className="text-sm text-[var(--st-text)]">{err}</div>}
        </CardBody>
      </Card>
      
      {images.length > 0 && (
        <Card>
          <CardBody className="p-4 space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{imgTags.length} &lt;img&gt; tags</Badge>
              {bgTags.length > 0 && <Badge variant="outline">{bgTags.length} background images</Badge>}
              <Badge variant={missingAlt ? 'destructive' : 'default'}>{missingAlt} missing alt attr</Badge>
              <Badge variant="secondary">{decorativeAlt} decorative (empty alt)</Badge>
              {longAlt > 0 && <Badge variant="warning">{longAlt} excessively long</Badge>}
              <Badge variant="default">{goodAlt} with alt text</Badge>
            </div>
            
            <div className="space-y-3">
              {images.map((img, i) => {
                const isBg = img.type === 'bg';
                const isMissingAlt = !isBg && !img.hasAlt;
                const isDecorative = !isBg && img.hasAlt && !img.alt.trim();
                const isLongAlt = !isBg && img.hasAlt && img.alt.trim().length > 125;
                const isGood = !isBg && img.hasAlt && img.alt.trim().length > 0 && !isLongAlt;
                
                let borderColor = 'border-[var(--st-border)]';
                let bgColor = '';
                let statusText = '';
                let badgeVariant: any = 'default';
                
                if (isBg) {
                  borderColor = 'border-muted';
                  statusText = 'CSS Background Image';
                  badgeVariant = 'outline';
                } else if (isMissingAlt) {
                  borderColor = 'border-destructive';
                  bgColor = 'bg-[var(--st-text)]/10';
                  statusText = 'Missing alt attribute';
                  badgeVariant = 'destructive';
                } else if (isDecorative) {
                  borderColor = 'border-[var(--st-border)]/50';
                  bgColor = 'bg-[var(--st-text)]/10';
                  statusText = 'Decorative (empty alt)';
                  badgeVariant = 'secondary';
                } else if (isLongAlt) {
                  borderColor = 'border-[var(--st-border)]/50';
                  bgColor = 'bg-[var(--st-text)]/10';
                  statusText = 'Excessively long alt';
                  badgeVariant = 'warning';
                } else if (isGood) {
                  borderColor = 'border-[var(--st-border)]/50';
                  bgColor = 'bg-[var(--st-text)]/10';
                  statusText = 'Good alt text';
                  badgeVariant = 'success';
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
                      <div className="text-xs text-[var(--st-text-secondary)] font-mono mt-2">
                        alt="
                        {isLongAlt ? (
                          <>
                            <span>{img.alt.substring(0, 125)}</span>
                            <span className="bg-[var(--st-text)]/20 text-[var(--st-text)] font-bold" title="Excessively long text (over 125 chars)">{img.alt.substring(125)}</span>
                          </>
                        ) : (
                          <>{img.hasAlt ? img.alt : ''}</>
                        )}
                        "
                        {!img.hasAlt && <span className="text-[var(--st-text)] font-semibold ml-2">(attribute missing)</span>}
                        {isDecorative && <span className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)] font-semibold ml-2">(decorative: alt=&quot;&quot;)</span>}
                        {isLongAlt && <span className="text-[var(--st-text)] dark:text-[var(--st-text-secondary)] font-semibold ml-2">({img.alt.trim().length} chars, over 125 limit)</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}
    </ToolShell>
  );
}
