'use client';

import { Card, ZoruCardContent, Input, Label, Button } from '@/components/sabcrm/20ui/compat';
import { useState } from 'react';
import { Copy, Check, Wand2, Loader2, Download, AlertCircle } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';
import { generateAdCopyAction } from './actions';
import { Alert, ZoruAlertTitle, ZoruAlertDescription } from '@/components/sabcrm/20ui/compat';

function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <div className="flex items-center justify-between text-sm border-t border-[var(--st-border)] py-2 text-[var(--st-text)] group">
      <span className="pr-4">{text}</span>
      <button 
        onClick={handleCopy}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-[var(--st-border)]/50 rounded-md shrink-0 focus:opacity-100"
        title="Copy to clipboard"
        aria-label="Copy to clipboard"
      >
        {copied ? <Check className="w-4 h-4 text-[var(--st-text)]" /> : <Copy className="w-4 h-4 text-[var(--st-text)]/60" />}
      </button>
    </div>
  );
}

export default function AdCopyGeneratorPage() {
  const [product, setProduct] = useState('SEO Tools');
  const [audience, setAudience] = useState('small business owners');
  const [keyword, setKeyword] = useState('seo tools');
  const [tone, setTone] = useState('friendly');
  const [url, setUrl] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{ headlines: string[], descriptions: string[] }>({
    headlines: [],
    descriptions: []
  });

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let urlContext = '';

      if (url) {
        try {
            const fetchRes = await apiFetchUrl(url);
            if (fetchRes.error) {
                console.warn("Failed to fetch URL context:", fetchRes.error);
                setError(`Could not fetch URL context: ${fetchRes.error}`);
            } else if (fetchRes.body) {
                const parsed = parseHtml(fetchRes.body);
                urlContext = `Title: ${parsed.title}\nDescription: ${parsed.metaDescription}\nHeadings: ${parsed.h1.join(', ')} ${parsed.h2.join(', ')}`;
            }
        } catch (urlErr: any) {
            console.warn("Error fetching URL context:", urlErr);
            setError(`Failed to extract context from URL: ${urlErr.message}`);
        }
      }

      const generated = await generateAdCopyAction({
        product,
        audience,
        keyword,
        tone,
        urlContext
      });

      setResults(generated);
    } catch (err: any) {
      console.error('Error generating copy', err);
      setError(err.message || 'An unexpected error occurred while generating ad copy.');
    } finally {
      setIsLoading(false);
    }
  };

  const exportCSV = () => {
    let csv = 'Type,Text\n';
    results.headlines.forEach(h => {
        csv += `Headline,"${h.replace(/"/g, '""')}"\n`;
    });
    results.descriptions.forEach(d => {
        csv += `Description,"${d.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'ad-copy.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  const copyAll = async () => {
    const text = `Headlines:\n${results.headlines.join('\n')}\n\nDescriptions:\n${results.descriptions.join('\n')}`;
    try {
        await navigator.clipboard.writeText(text);
    } catch (err) {
        console.error('Failed to copy all', err);
    }
  };

  return (
    <ToolShell title="Ad Copy Generator" description="Generate AI-powered headlines and descriptions for a PPC ad.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div className="space-y-1"><Label>Product / service</Label><Input value={product} onChange={(e) => setProduct(e.target.value)} /></div>
        <div className="space-y-1"><Label>Target audience</Label><Input value={audience} onChange={(e) => setAudience(e.target.value)} /></div>
        <div className="space-y-1"><Label>Target keyword</Label><Input value={keyword} onChange={(e) => setKeyword(e.target.value)} /></div>
        <div className="space-y-1"><Label>Tone</Label>
          <select className="border border-[var(--st-border)] rounded-[var(--zoru-radius)] h-9 px-2 bg-[var(--st-bg)] text-[var(--st-text)] w-full text-sm" value={tone} onChange={(e) => setTone(e.target.value)}>
            <option value="friendly">Friendly</option>
            <option value="urgent">Urgent</option>
            <option value="formal">Formal</option>
            <option value="creative">Creative</option>
            <option value="humorous">Humorous</option>
          </select>
        </div>
        <div className="space-y-1 md:col-span-2"><Label>Reference URL (optional context)</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/product" /></div>
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <ZoruAlertTitle>Notice</ZoruAlertTitle>
            <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      )}

      <Button 
        onClick={handleGenerate} 
        disabled={isLoading || !product || !audience || !keyword}
        className="mb-6 w-full md:w-auto"
      >
        {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
        Generate Ad Copy
      </Button>

      {(results.headlines.length > 0 || results.descriptions.length > 0) && (
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <ZoruCardContent className="p-4 space-y-4">
            <div className="flex justify-end gap-2 mb-2">
                <Button variant="outline" size="sm" onClick={copyAll}><Copy className="w-4 h-4 mr-2" /> Copy All</Button>
                <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-2" /> Export CSV</Button>
            </div>
            
            {results.headlines.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-[var(--st-text)] mb-2">Headlines</div>
                <div className="space-y-1">
                  {results.headlines.map((h, i) => (
                    <CopyText key={i} text={h} />
                  ))}
                </div>
              </div>
            )}
            
            {results.descriptions.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-[var(--st-text)] mb-2 mt-4">Descriptions</div>
                <div className="space-y-1">
                  {results.descriptions.map((d, i) => (
                    <CopyText key={i} text={d} />
                  ))}
                </div>
              </div>
            )}
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
