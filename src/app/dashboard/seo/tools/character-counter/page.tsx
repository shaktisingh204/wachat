'use client';

import { Card, ZoruCardContent, Textarea, Input, Button } from '@/components/sabcrm/20ui/compat';
import { useMemo, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { countCharacters, countWords } from '@/lib/seo-tools/text-utils';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';
import { Copy, Download, Globe, AlertCircle, Check } from 'lucide-react';

import { Component, ErrorInfo, ReactNode } from 'react';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-[var(--st-bg-muted)] text-[var(--st-text)] rounded-md border border-[var(--st-border)]">
          <h2 className="text-lg font-bold mb-2">Something went wrong.</h2>
          <p className="text-sm">{this.state.error?.message}</p>
          <Button className="mt-4" onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function CharacterCounterPage() {
  return (
    <ErrorBoundary>
      <CharacterCounterContent />
    </ErrorBoundary>
  );
}

function CharacterCounterContent() {
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    const limits: Record<string, number> = {
      'Meta title': 60,
      'Meta description': 160,
      Tweet: 280,
      'Facebook post': 63206,
    };
    return {
      total: countCharacters(text, true),
      noSpaces: countCharacters(text, false),
      words: countWords(text),
      limits,
    };
  }, [text]);

  const handleFetch = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    try {
      let validUrl = url.trim();
      if (!validUrl.startsWith('http://') && !validUrl.startsWith('https://')) {
        validUrl = 'https://' + validUrl;
      }
      const res = await apiFetchUrl(validUrl);
      if (res.error) {
        setError(res.error);
        return;
      }
      
      const html = res.body || '';
      let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
      cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
      cleaned = cleaned.replace(/<(br|p|div|h[1-6]|li)\b[^>]*>/gi, '\n');
      cleaned = cleaned.replace(/<[^>]+>/g, ' ');
      cleaned = cleaned.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      cleaned = cleaned.replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim();
      
      if (!cleaned) {
        setError('No text content found at this URL.');
        return;
      }
      
      setText(cleaned);
    } catch (err) {
      setError('Failed to fetch URL. ' + (err instanceof Error ? err.message : ''));
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const rows = [
      ['Metric', 'Value'],
      ['Total Characters (with spaces)', stats.total.toString()],
      ['Total Characters (no spaces)', stats.noSpaces.toString()],
      ['Total Words', stats.words.toString()],
    ];
    Object.entries(stats.limits).forEach(([label, limit]) => {
      rows.push([`${label} Limit`, limit.toString()]);
      rows.push([`${label} Used`, stats.total.toString()]);
    });
    
    // Properly escape for CSV
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(item => `"${item}"`).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "character-counter-stats.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ToolShell title="Character Counter" description="Character count with and without spaces, plus common SEO limits.">
      
      {/* URL Fetcher */}
      <div className="flex gap-2 mb-4">
        <Input 
          placeholder="https://example.com" 
          value={url} 
          onChange={(e) => setUrl(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
          className="flex-1"
        />
        <Button onClick={handleFetch} disabled={loading || !url.trim()}>
          <Globe className="w-4 h-4 mr-2" />
          {loading ? 'Fetching...' : 'Extract Text'}
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-[var(--zoru-radius-lg)] bg-[var(--st-bg-muted)] text-[var(--st-text)] flex items-center text-sm border border-[var(--st-border)]">
          <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Textarea */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex justify-between items-end">
          <label className="text-sm font-medium">Text Content</label>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={copyToClipboard} disabled={!text}>
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
              {copied ? 'Copied' : 'Copy Text'}
            </Button>
            <Button size="sm" variant="secondary" onClick={exportCSV} disabled={!text}>
              <Download className="w-4 h-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </div>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste, type, or extract your content here…"
          className="min-h-[240px]"
        />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-[var(--st-text-secondary)]">With spaces</div></ZoruCardContent></Card>
        <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{stats.noSpaces}</div><div className="text-xs text-[var(--st-text-secondary)]">Without spaces</div></ZoruCardContent></Card>
        <Card><ZoruCardContent className="p-4"><div className="text-2xl font-bold">{stats.words}</div><div className="text-xs text-[var(--st-text-secondary)]">Words</div></ZoruCardContent></Card>
      </div>

      <Card>
        <ZoruCardContent className="p-4 space-y-3">
          <div className="text-sm font-semibold">Common limits</div>
          {Object.entries(stats.limits).map(([label, limit]) => {
            const pct = Math.min(100, (stats.total / limit) * 100);
            const over = stats.total > limit;
            return (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{label}</span>
                  <span className={over ? 'text-[var(--st-text)]' : 'text-[var(--st-text-secondary)]'}>
                    {stats.total} / {limit}
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--st-bg-muted)] rounded">
                  <div className={`h-full rounded ${over ? 'bg-[var(--st-text)]' : 'bg-[var(--st-text)]'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </ZoruCardContent>
      </Card>
    </ToolShell>
  );
}
