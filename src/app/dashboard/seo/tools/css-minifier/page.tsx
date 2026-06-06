'use client';

import { Textarea, Input, Button, Alert, Card, CardBody as CardContent, useToast } from '@/components/sabcrm/20ui';
import { useState, useMemo, Component, ReactNode } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';
import { Copy, Download, FileSpreadsheet, RefreshCw, AlertCircle } from 'lucide-react';

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
        <Alert variant="destructive" className="my-4">
          <AlertCircle className="h-4 w-4" />
          <div className="ml-2 font-bold">Something went wrong</div>
          <div className="ml-2 text-sm">{this.state.error?.message}</div>
        </Alert>
      );
    }
    return this.props.children;
  }
}

export default function CssMinifierPage() {
  const [mode, setMode] = useState<'raw' | 'url'>('raw');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const min = useMemo(() => {
    return text
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([{}:;,>+~])\s*/g, '$1')
      .replace(/;}/g, '}')
      .trim();
  }, [text]);

  const stats = useMemo(() => {
    const original = text.length;
    const minified = min.length;
    const saved = original - minified;
    const percent = original ? ((saved / original) * 100).toFixed(1) : '0.0';
    return { original, minified, saved, percent };
  }, [text, min]);

  const { toast } = useToast();

  async function fetchCss() {
    if (!url) return;
    setLoading(true);
    setError('');
    setText('');
    try {
      const res = await apiFetchUrl(url);
      if (res.error) {
        setError(res.error);
      } else if (res.body) {
        setText(res.body);
      } else {
        setError('No content found at URL.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch CSS. Make sure the URL is valid.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(min);
    toast({ title: 'Copied to clipboard' });
  }

  function handleDownloadCss() {
    const blob = new Blob([min], { type: 'text/css' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'minified.css';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function handleExportCsv() {
    const csvContent = `Original Size (bytes),Minified Size (bytes),Saved (bytes),Saved (%)\n${stats.original},${stats.minified},${stats.saved},${stats.percent}%`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'css-minifier-stats.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <ToolShell title="CSS Minifier" description="Strip comments and whitespace from CSS.">
      <ErrorBoundary>
        <div className="flex gap-2 mb-4">
        <Button variant={mode === 'raw' ? 'default' : 'outline'} onClick={() => setMode('raw')}>Raw CSS</Button>
        <Button variant={mode === 'url' ? 'default' : 'outline'} onClick={() => setMode('url')}>Fetch from URL</Button>
      </div>

      <div className="flex flex-col gap-4">
        {mode === 'raw' && (
          <Textarea 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            className="min-h-[200px] font-mono text-xs" 
            placeholder="Paste CSS…" 
          />
        )}

        {mode === 'url' && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input 
                value={url} 
                onChange={(e) => setUrl(e.target.value)} 
                placeholder="https://example.com/style.css" 
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && fetchCss()}
              />
              <Button onClick={fetchCss} disabled={loading || !url}>
                {loading ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                Fetch
              </Button>
            </div>
            {error && (
              <Alert variant="destructive">
                <div className="flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {error}
                </div>
              </Alert>
            )}
            {text && (
              <Textarea 
                value={text} 
                readOnly
                className="min-h-[150px] font-mono text-xs" 
              />
            )}
          </div>
        )}

        {text.length > 0 && (
          <Card>
            <CardContent className="p-4 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-[var(--st-text-secondary)]">
                  <strong>Stats:</strong> {stats.original} → {stats.minified} bytes ({stats.percent}% saved)
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopy}>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDownloadCss}>
                    <Download className="w-4 h-4 mr-2" />
                    Download CSS
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExportCsv}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Export Stats (CSV)
                  </Button>
                </div>
              </div>
              
              <Textarea 
                readOnly 
                value={min} 
                className="min-h-[200px] font-mono text-xs" 
                placeholder="Minified CSS will appear here..."
              />
            </CardContent>
          </Card>
        )}
      </div>
      </ErrorBoundary>
    </ToolShell>
  );
}
