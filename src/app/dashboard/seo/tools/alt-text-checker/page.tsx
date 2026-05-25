'use client';

import { Button, Input, Card, ZoruCardContent, cn } from '@/components/zoruui';
import { useState } from 'react';
import React, { Component, ReactNode } from 'react';
import { Download, Copy, CheckCircle2 } from 'lucide-react';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-red-500 m-4">
          <ZoruCardContent className="p-4 text-red-600 text-sm">
            Something went wrong: {this.state.error?.message}
          </ZoruCardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

function AltTextCheckerContent() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<{ src: string; alt: string; hasAlt?: boolean }[]>([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const run = async () => {
    if (!url) return;
    setLoading(true); setError(''); setImages([]); setCopied(false);
    try {
      const targetUrl = url.startsWith('http') ? url : `https://${url}`;
      // Routing fetch through apiFetchUrl to bypass CORS as per enhancement plan
      const r = await apiFetchUrl(targetUrl);
      if (r.error) setError(r.error);
      else setImages(parseHtml(r.body).images);
    } catch (err: any) {
      setError(err.message || 'An error occurred fetching the URL');
    } finally { setLoading(false); }
  };

  const missing = images.filter((i) => !i.hasAlt || !i.alt).length;

  const exportMissingToCsv = () => {
    const missingImages = images.filter((i) => !i.hasAlt || !i.alt);
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

  const copyMissingToClipboard = async () => {
    const missingImages = images.filter((i) => !i.hasAlt || !i.alt);
    if (missingImages.length === 0) return;
    const text = missingImages.map(img => img.src).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <ToolShell title="Alt Text Checker" description="Find images missing alt attributes on any page.">
      <div className="flex gap-2">
        <Input 
          value={url} 
          onChange={(e) => setUrl(e.target.value)} 
          placeholder="https://example.com" 
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Check'}</Button>
      </div>
      {error && <Card className="border-red-500"><ZoruCardContent className="p-4 text-red-600 text-sm">{error}</ZoruCardContent></Card>}
      {images.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">{images.length} images · <span className="text-red-600 font-semibold">{missing} missing alt</span></div>
            {missing > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyMissingToClipboard}>
                  {copied ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                  {copied ? 'Copied' : 'Copy Missing'}
                </Button>
                <Button variant="outline" size="sm" onClick={exportMissingToCsv}>
                  <Download className="w-4 h-4 mr-2" />
                  Export Missing (CSV)
                </Button>
              </div>
            )}
          </div>
          <Card><ZoruCardContent className="p-0">
            <div className="max-h-[600px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background"><tr className="border-b"><th className="text-left p-2">Image</th><th className="text-left p-2">Alt</th></tr></thead>
                <tbody>
                  {images.map((img, i) => {
                    const isMissing = !img.hasAlt || !img.alt;
                    return (
                      <tr key={i} className={`border-b ${isMissing ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                        <td className="p-2 font-mono truncate max-w-xs">{img.src}</td>
                        <td className="p-2">{!isMissing ? img.alt : <span className="text-red-600">(missing)</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ZoruCardContent></Card>
        </>
      )}
    </ToolShell>
  );
}

export default function AltTextCheckerPage() {
  return (
    <ErrorBoundary>
      <AltTextCheckerContent />
    </ErrorBoundary>
  );
}
