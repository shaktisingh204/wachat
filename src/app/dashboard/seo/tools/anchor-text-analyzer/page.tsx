'use client';

import { Button, Input, Card, CardBody, Badge } from '@/components/sabcrm/20ui/compat';
import { useState, Component, ErrorInfo, ReactNode } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Download, Copy, AlertCircle } from 'lucide-react';


import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-[var(--st-border)]/50 mt-4">
          <CardBody className="p-4 text-sm text-[var(--st-text)] flex flex-col gap-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4" />
              Something went wrong rendering the results
            </div>
            <p>{this.state.error?.message}</p>
          </CardBody>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default function AnchorTextAnalyzerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<{ anchor: string; count: number }[] | null>(null);

  const run = async () => {
    if (!url) return;
    setLoading(true);
    setError('');
    setRows(null);
    try {
      const r = await apiFetchUrl(url);
      if (r.error) {
        setError(r.error);
        return;
      }
      const parsed = parseHtml(r.body || '');
      const map = new Map<string, number>();
      for (const l of parsed.links || []) {
        const t = (l.text || '').trim();
        if (!t) continue;
        map.set(t, (map.get(t) || 0) + 1);
      }
      const arr = Array.from(map.entries())
        .map(([anchor, count]) => ({ anchor, count }))
        .sort((a, b) => b.count - a.count);
      setRows(arr);
    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching the URL. Check CORS or network.');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!rows || rows.length === 0) return;
    const header = ['Anchor Text,Count'];
    const csvRows = rows.map((r) => `"${r.anchor.replace(/"/g, '""')}",${r.count}`);
    const csvContent = [...header, ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const u = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = u;
    a.download = 'anchor-texts.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(u);
  };

  const copyToClipboard = async () => {
    if (!rows || rows.length === 0) return;
    const text = rows.map((r) => `${r.anchor}\t${r.count}`).join('\n');
    try {
      await navigator.clipboard.writeText(`Anchor Text\tCount\n${text}`);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <ToolShell title="Anchor Text Analyzer" description="Group links by anchor text and show the most common ones.">
      <div className="flex gap-2">
        <Input
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button onClick={run} disabled={loading || !url}>
          {loading ? 'Analyzing…' : 'Analyze'}
        </Button>
      </div>

      {error && (
        <Card className="border-[var(--st-border)]/50">
          <CardBody className="p-4 text-sm text-[var(--st-text)] flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </CardBody>
        </Card>
      )}

      {rows && (
        <ErrorBoundary>
          <Card>
            <CardBody className="p-4 space-y-3">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Top {rows.length} anchors</span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={copyToClipboard}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportCsv}>
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b pb-2">
                    <div className="truncate pr-3">{r.anchor}</div>
                    <Badge variant="secondary">{r.count}</Badge>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </ErrorBoundary>
      )}
    </ToolShell>
  );
}
