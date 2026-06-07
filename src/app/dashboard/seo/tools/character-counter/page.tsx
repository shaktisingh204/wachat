'use client';

import { Button, Field, Input, Textarea, StatCard, Alert, Progress } from '@/components/sabcrm/20ui';
import { useMemo, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { countCharacters, countWords } from '@/lib/seo-tools/text-utils';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';
import { Copy, Download, Globe, Check } from 'lucide-react';

import { Component, ErrorInfo, ReactNode } from 'react';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert
          tone="danger"
          title="Something went wrong."
          className="m-4"
        >
          <p className="mb-3">{this.state.error?.message}</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </Button>
        </Alert>
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
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows.map((e) => e.map((item) => `"${item}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'character-counter-stats.csv');
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
      <div className="flex items-end gap-2">
        <Field label="Fetch text from a URL" className="flex-1">
          <Input
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFetch()}
          />
        </Field>
        <Button
          variant="primary"
          iconLeft={Globe}
          onClick={handleFetch}
          loading={loading}
          disabled={!url.trim()}
        >
          {loading ? 'Fetching' : 'Extract Text'}
        </Button>
      </div>

      {error && (
        <Alert tone="danger" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Main Textarea */}
      <div className="flex flex-col gap-2">
        <div className="flex items-end justify-between">
          <span className="text-sm font-medium text-[var(--st-text)]">Text Content</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              iconLeft={copied ? Check : Copy}
              onClick={copyToClipboard}
              disabled={!text}
            >
              {copied ? 'Copied' : 'Copy Text'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              iconLeft={Download}
              onClick={exportCSV}
              disabled={!text}
            >
              Export CSV
            </Button>
          </div>
        </div>
        <Field>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste, type, or extract your content here."
            rows={10}
            className="min-h-[240px]"
          />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="With spaces" value={stats.total} />
        <StatCard label="Without spaces" value={stats.noSpaces} />
        <StatCard label="Words" value={stats.words} />
      </div>

      <div className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-4">
        <div className="text-sm font-semibold text-[var(--st-text)]">Common limits</div>
        {Object.entries(stats.limits).map(([label, limit]) => {
          const over = stats.total > limit;
          return (
            <div key={label} className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-[var(--st-text)]">{label}</span>
                <span className={over ? 'text-[var(--st-danger)]' : 'text-[var(--st-text-secondary)]'}>
                  {stats.total} / {limit}
                </span>
              </div>
              <Progress
                value={stats.total}
                max={limit}
                size="sm"
                tone={over ? 'danger' : 'accent'}
                aria-label={`${label} usage: ${stats.total} of ${limit} characters`}
              />
            </div>
          );
        })}
      </div>
    </ToolShell>
  );
}
