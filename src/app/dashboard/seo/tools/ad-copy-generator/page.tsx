'use client';

import {
  Card,
  CardBody,
  Input,
  Field,
  Button,
  IconButton,
  Alert,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { useState } from 'react';
import { Copy, Check, Wand2, Download } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';
import { generateAdCopyAction } from './actions';

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
    <div className="flex items-center justify-between gap-4 text-sm border-t border-[var(--st-border)] py-2 text-[var(--st-text)] group">
      <span className="pr-4">{text}</span>
      <IconButton
        label={copied ? 'Copied' : 'Copy to clipboard'}
        icon={copied ? Check : Copy}
        size="sm"
        onClick={handleCopy}
        className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
      />
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

  const hasResults = results.headlines.length > 0 || results.descriptions.length > 0;

  return (
    <ToolShell title="Ad Copy Generator" description="Generate AI-powered headlines and descriptions for a PPC ad.">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <Field label="Product / service">
          <Input value={product} onChange={(e) => setProduct(e.target.value)} />
        </Field>
        <Field label="Target audience">
          <Input value={audience} onChange={(e) => setAudience(e.target.value)} />
        </Field>
        <Field label="Target keyword">
          <Input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        </Field>
        <Field label="Tone">
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger aria-label="Tone">
              <SelectValue placeholder="Pick a tone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="friendly">Friendly</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="formal">Formal</SelectItem>
              <SelectItem value="creative">Creative</SelectItem>
              <SelectItem value="humorous">Humorous</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="md:col-span-2">
          <Field label="Reference URL (optional context)">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/product" />
          </Field>
        </div>
      </div>

      {error && (
        <Alert tone="danger" title="Notice" className="mb-4">
          {error}
        </Alert>
      )}

      <Button
        variant="primary"
        onClick={handleGenerate}
        loading={isLoading}
        disabled={isLoading || !product || !audience || !keyword}
        iconLeft={isLoading ? undefined : Wand2}
        className="mb-6 w-full md:w-auto"
      >
        Generate Ad Copy
      </Button>

      {hasResults && (
        <Card className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CardBody className="space-y-4">
            <div className="flex justify-end gap-2 mb-2">
                <Button variant="outline" size="sm" onClick={copyAll} iconLeft={Copy}>Copy All</Button>
                <Button variant="outline" size="sm" onClick={exportCSV} iconLeft={Download}>Export CSV</Button>
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
          </CardBody>
        </Card>
      )}
    </ToolShell>
  );
}
