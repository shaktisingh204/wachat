'use client';

import { Button, Input, Card, ZoruCardContent, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';
import { Download } from 'lucide-react';

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
      // Routing fetch through apiFetchUrl to bypass CORS as per enhancement plan
      const r = await apiFetchUrl(url);
      if (r.error) setError(r.error);
      else setImages(parseHtml(r.body).images);
    } catch (err: any) {
      setError(err.message || 'An error occurred fetching the URL');
    } finally { setLoading(false); }
  };

  const missing = images.filter((i) => !i.alt).length;

  const exportMissingToCsv = () => {
    const missingImages = images.filter((i) => !i.alt);
    if (missingImages.length === 0) return;
    const csvLines = ['Image URL'];
    missingImages.forEach((img) => {
      csvLines.push(`"${img.src.replace(/"/g, '""')}"`);
    });
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'missing-alt-images.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <ToolShell title="Alt Text Checker" description="Find images missing alt attributes on any page.">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
        <Button onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Check'}</Button>
      </div>
      {error && <Card className="border-red-500"><ZoruCardContent className="p-4 text-red-600 text-sm">{error}</ZoruCardContent></Card>}
      {images.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">{images.length} images · <span className="text-red-600 font-semibold">{missing} missing alt</span></div>
            {missing > 0 && (
              <Button variant="outline" size="sm" onClick={exportMissingToCsv}>
                <Download className="w-4 h-4 mr-2" />
                Export Missing (CSV)
              </Button>
            )}
          </div>
          <Card><ZoruCardContent className="p-0">
            <div className="max-h-[600px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background"><tr className="border-b"><th className="text-left p-2">Image</th><th className="text-left p-2">Alt</th></tr></thead>
                <tbody>
                  {images.map((img, i) => (
                    <tr key={i} className={`border-b ${!img.alt ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                      <td className="p-2 font-mono truncate max-w-xs">{img.src}</td>
                      <td className="p-2">{img.alt || <span className="text-red-600">(missing)</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ZoruCardContent></Card>
        </>
      )}
    </ToolShell>
  );
}
