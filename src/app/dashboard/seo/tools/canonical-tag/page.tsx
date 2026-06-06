'use client';

import { Button, Textarea, Card, ZoruCardContent, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, Alert, ZoruAlertTitle, ZoruAlertDescription, Badge } from '@/components/sabcrm/20ui/compat';
import { Download, Copy, AlertCircle } from 'lucide-react';
import { useState, Component, ReactNode, ErrorInfo } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

interface ResultRow {
  url: string;
  finalUrl: string;
  httpStatus: number | null;
  canonical: string | null;
  evaluation: { label: string, variant: "success" | "warning" | "destructive" | "info" | "default" };
  statusMessage: string;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Canonical Tag Checker Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive" className="m-4">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Something went wrong</ZoruAlertTitle>
          <ZoruAlertDescription>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </ZoruAlertDescription>
        </Alert>
      );
    }
    return this.props.children;
  }
}

function evaluateCanonical(requestedUrl: string, finalUrl: string, httpStatus: number | null, canonical: string | null, error?: string): { label: string, variant: "success" | "warning" | "destructive" | "info" | "default" } {
  if (error) return { label: 'Fetch Error', variant: 'destructive' };
  if (httpStatus && httpStatus >= 400) return { label: `HTTP ${httpStatus}`, variant: 'destructive' };
  if (!canonical || canonical === '(missing)') return { label: 'Missing', variant: 'warning' };
  
  if (!/^https?:\/\//i.test(canonical)) {
    return { label: 'Relative URL', variant: 'warning' };
  }

  // normalize trailing slashes for comparison
  const normFinal = finalUrl.replace(/\/$/, '');
  const normCanon = canonical.replace(/\/$/, '');
  const normRequested = requestedUrl.replace(/\/$/, '');
  
  if (normFinal.toLowerCase() === normCanon.toLowerCase()) {
    if (normFinal.toLowerCase() !== normRequested.toLowerCase()) {
      return { label: 'Self-ref (Redirected)', variant: 'info' };
    }
    return { label: 'Self-referencing', variant: 'success' };
  } else {
    return { label: 'Canonicalized', variant: 'info' };
  }
}

function CanonicalTagChecker() {
  const [urls, setUrls] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    setResults([]);
    
    const urlList = urls.split('\n').map(u => u.trim()).filter(Boolean);
    if (urlList.length === 0) {
      setError('Please enter at least one URL.');
      setLoading(false);
      return;
    }
    
    const newResults: ResultRow[] = [];
    
    for (const url of urlList) {
      try {
        let fetchUrl = url;
        if (!/^https?:\/\//i.test(fetchUrl)) {
          fetchUrl = 'https://' + fetchUrl;
        }
        
        // CORS is handled server-side by the proxy apiFetchUrl
        const r = await apiFetchUrl(fetchUrl);
        if (r.error) {
          newResults.push({ 
            url: fetchUrl, 
            finalUrl: r.finalUrl || fetchUrl,
            httpStatus: r.status || null,
            canonical: null,
            evaluation: evaluateCanonical(fetchUrl, r.finalUrl || fetchUrl, r.status || null, null, r.error),
            statusMessage: r.error 
          });
        } else {
          const canonical = parseHtml(r.body).canonical || '(missing)';
          newResults.push({ 
            url: fetchUrl, 
            finalUrl: r.finalUrl || fetchUrl,
            httpStatus: r.status,
            canonical: canonical === '(missing)' ? null : canonical,
            evaluation: evaluateCanonical(fetchUrl, r.finalUrl || fetchUrl, r.status, canonical),
            statusMessage: 'Success' 
          });
        }
      } catch (err: any) {
        newResults.push({ 
          url, 
          finalUrl: url,
          httpStatus: null,
          canonical: null, 
          evaluation: evaluateCanonical(url, url, null, null, err.message || 'Error'),
          statusMessage: err.message || 'Error fetching URL' 
        });
      }
    }
    
    setResults(newResults);
    setLoading(false);
  };

  const copyToClipboard = () => {
    const text = results.map(r => `${r.url}\t${r.finalUrl}\t${r.httpStatus || '-'}\t${r.canonical || '(missing)'}\t${r.evaluation.label}\t${r.statusMessage}`).join('\n');
    navigator.clipboard.writeText(`Requested URL\tFinal URL\tHTTP Status\tCanonical URL\tEvaluation\tStatus\n${text}`);
  };

  const exportCSV = () => {
    const csv = ['Requested URL,Final URL,HTTP Status,Canonical URL,Evaluation,Status', ...results.map(r => `"${r.url.replace(/"/g, '""')}","${r.finalUrl.replace(/"/g, '""')}","${r.httpStatus || ''}","${(r.canonical || '').replace(/"/g, '""')}","${r.evaluation.label.replace(/"/g, '""')}","${r.statusMessage.replace(/"/g, '""')}"`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'canonical-tags.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ToolShell title="Canonical Tag Checker" description="Check the canonical URLs for one or more web pages.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Textarea 
            value={urls} 
            onChange={(e) => setUrls(e.target.value)} 
            placeholder="https://example.com&#10;https://example.org" 
            rows={5}
            className="font-mono text-sm"
          />
          <Button onClick={run} disabled={loading} className="w-fit">{loading ? 'Checking...' : 'Check URLs'}</Button>
        </div>
        
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <ZoruAlertTitle>Error</ZoruAlertTitle>
            <ZoruAlertDescription>{error}</ZoruAlertDescription>
          </Alert>
        )}
        
        {results.length > 0 && (
          <Card>
            <ZoruCardContent className="p-0">
              <div className="flex justify-end gap-2 p-4 border-b border-[var(--st-border)]">
                <Button variant="outline" size="sm" onClick={copyToClipboard}><Copy className="w-4 h-4 mr-2"/> Copy</Button>
                <Button variant="outline" size="sm" onClick={exportCSV}><Download className="w-4 h-4 mr-2"/> Export CSV</Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Final URL</TableHead>
                    <TableHead>Canonical URL</TableHead>
                    <TableHead>Evaluation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-[200px] truncate" title={r.url}>{r.url}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={r.finalUrl}>
                        <div className="flex flex-col">
                          <span>{r.finalUrl}</span>
                          <span className="text-xs text-[var(--st-text-secondary)]">HTTP {r.httpStatus || '-'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={r.canonical || ''}>{r.canonical || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={r.evaluation.variant}>{r.evaluation.label}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ZoruCardContent>
          </Card>
        )}
      </div>
    </ToolShell>
  );
}

export default function CanonicalTagPage() {
  return (
    <ErrorBoundary>
      <CanonicalTagChecker />
    </ErrorBoundary>
  );
}
