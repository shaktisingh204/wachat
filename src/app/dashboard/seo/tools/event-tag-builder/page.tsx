'use client';

import { Button, Input, Label, Textarea, Card, CardBody, cn } from '@/components/sabcrm/20ui';
import { cn as _zoruCn, useMemo, useState, Component, ReactNode } from 'react';
import { Copy, CheckCircle2, Download, Search, AlertCircle, Loader2 } from 'lucide-react';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';
import { ToolShell } from '@/components/seo-tools/tool-shell';

void _zoruCn;

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
        <Card className="border-[var(--st-border)] m-4">
          <CardBody className="p-4 flex flex-col gap-2">
            <span className="text-[var(--st-text)] text-sm">Something went wrong: {this.state.error?.message}</span>
            <Button variant="outline" size="sm" onClick={() => this.setState({ hasError: false, error: null })}>
              Try Again
            </Button>
          </CardBody>
        </Card>
      );
    }
    return this.props.children;
  }
}

interface ExtractedEvent {
  name: string;
  params: string;
}

function EventTagBuilder() {
  const [name, setName] = useState('purchase');
  const [rows, setRows] = useState([{ k: 'currency', v: 'USD' }, { k: 'value', v: '49.99' }]);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Extractor State
  const [urlToExtract, setUrlToExtract] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [extractedEvents, setExtractedEvents] = useState<ExtractedEvent[] | null>(null);

  const snippet = useMemo(() => {
    const obj: Record<string, string> = {};
    for (const r of rows) if (r.k) obj[r.k] = r.v;
    return `gtag('event', '${name}', ${JSON.stringify(obj, null, 2)});`;
  }, [name, rows]);

  const handleCopySnippet = () => {
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  const handleExportCsv = () => {
    const headers = ['Parameter Name', 'Value'];
    const csvRows = rows.map(r => [r.k, r.v].map(v => `"${v.replace(/"/g, '""')}"`).join(','));
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ga4-event-params-${name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExtractedCsv = () => {
    if (!extractedEvents || extractedEvents.length === 0) return;
    const headers = ['Event Name', 'Parameters'];
    const csvRows = extractedEvents.map(evt => [evt.name, evt.params].map(v => `"${v.replace(/"/g, '""')}"`).join(','));
    const csvContent = [headers.join(','), ...csvRows].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted-ga4-events.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyExtractedSnippet = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const extractEvents = async () => {
    if (!urlToExtract) return;
    
    let targetUrl = urlToExtract;
    if (!targetUrl.startsWith('http')) {
      targetUrl = 'https://' + targetUrl;
    }

    setIsExtracting(true);
    setExtractionError(null);
    setExtractedEvents(null);

    try {
      const res = await apiFetchUrl(targetUrl);
      if (res.error) {
        throw new Error(res.error);
      }

      const html = res.body;
      
      // Simple regex to find gtag('event', 'name', {...})
      // We look for "gtag('event'," or 'gtag("event",'
      const regex = /gtag\s*\(\s*['"]event['"]\s*,\s*['"]([^'"]+)['"]\s*(?:,\s*({[\s\S]*?}))?\s*\)/gi;
      
      const events: ExtractedEvent[] = [];
      let match;
      while ((match = regex.exec(html)) !== null) {
        events.push({
          name: match[1],
          params: match[2] ? match[2].trim() : '{}'
        });
      }

      // Also try to find dataLayer.push({ event: '...' })
      const dlRegex = /dataLayer\.push\s*\(\s*({[\s\S]*?})\s*\)/gi;
      let dlMatch;
      while ((dlMatch = dlRegex.exec(html)) !== null) {
        try {
          // It's hard to parse raw JS object strings perfectly, but we can try to extract 'event'
          const dlString = dlMatch[1];
          const eventMatch = dlString.match(/['"]?event['"]?\s*:\s*['"]([^'"]+)['"]/i);
          if (eventMatch) {
            events.push({
              name: eventMatch[1],
              params: dlString
            });
          }
        } catch(e) {
          // Ignore parse errors for dataLayer
        }
      }

      setExtractedEvents(events);
    } catch (err: any) {
      setExtractionError(err.message || 'Failed to fetch and extract events. Check if the URL is accessible.');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <ToolShell title="GA4 Event Tag Builder & Extractor" description="Build a gtag('event', ...) snippet for GA4, or extract existing events from a webpage.">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Builder Section */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-4">Event Builder</h2>
            <div className="space-y-1">
              <Label className="font-semibold">Event Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. purchase, generate_lead" />
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="font-semibold">Event Parameters</Label>
              <Button variant="outline" size="sm" onClick={handleExportCsv} className="h-8">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
            
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Input value={r.k} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, k: e.target.value } : rr))} placeholder="Parameter Name (e.g. currency)" className="flex-1" />
                  <Input value={r.v} onChange={(e) => setRows((rs) => rs.map((rr, j) => j === i ? { ...rr, v: e.target.value } : rr))} placeholder="Value (e.g. USD)" className="flex-1" />
                  <Button variant="ghost" size="icon" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]">
                    &times;
                  </Button>
                </div>
              ))}
              <Button variant="secondary" size="sm" onClick={() => setRows((r) => [...r, { k: '', v: '' }])} className="w-full border border-dashed border-muted-foreground/30 bg-[var(--st-bg-muted)]/20">
                + Add Parameter
              </Button>
            </div>
          </div>
          
          <div className="space-y-2 pt-4 border-t">
            <Label className="font-semibold">Generated Snippet</Label>
            <div className="relative">
              <Textarea readOnly value={snippet} className="min-h-[160px] font-mono text-sm bg-[var(--st-bg-muted)]/10" />
              <Button 
                size="sm" 
                variant="secondary" 
                className="absolute top-2 right-2 opacity-80 hover:opacity-100"
                onClick={handleCopySnippet}
              >
                {copiedSnippet ? <CheckCircle2 className="w-4 h-4 mr-2 text-[var(--st-text)]" /> : <Copy className="w-4 h-4 mr-2" />}
                {copiedSnippet ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
        </div>

        {/* Extractor Section */}
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-4">Event Extractor</h2>
            <div className="space-y-2">
              <Label className="font-semibold">Extract tags from URL</Label>
              <div className="flex gap-2">
                <Input 
                  value={urlToExtract} 
                  onChange={(e) => setUrlToExtract(e.target.value)} 
                  placeholder="https://example.com"
                  onKeyDown={(e) => e.key === 'Enter' && extractEvents()}
                />
                <Button onClick={extractEvents} disabled={isExtracting || !urlToExtract}>
                  {isExtracting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                  Extract
                </Button>
              </div>
            </div>
          </div>

          {extractionError && (
            <div className="p-4 bg-[var(--st-bg-muted)] text-[var(--st-text)] rounded-md flex items-start gap-2 border border-[var(--st-border)]">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">{extractionError}</div>
            </div>
          )}

          {extractedEvents && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center justify-between">
                <span>Found {extractedEvents.length} Event{extractedEvents.length !== 1 ? 's' : ''}</span>
                {extractedEvents.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleExportExtractedCsv} className="h-8">
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                )}
              </h3>
              
              {extractedEvents.length === 0 ? (
                <div className="text-[var(--st-text-secondary)] text-sm p-8 text-center bg-[var(--st-bg-muted)]/20 border rounded-md border-dashed">
                  No GA4 gtag or dataLayer events found on this page.
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {extractedEvents.map((evt, idx) => (
                    <Card key={idx} className="overflow-hidden">
                      <div className="bg-[var(--st-bg-muted)] px-4 py-2 font-mono text-sm border-b font-semibold flex justify-between items-center">
                        <span>Event: <span className="text-[var(--st-text)]">{evt.name}</span></span>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 px-2 text-xs" 
                            onClick={() => handleCopyExtractedSnippet(evt.params, idx)}
                          >
                            {copiedIndex === idx ? <CheckCircle2 className="w-3 h-3 mr-1 text-[var(--st-text)]" /> : <Copy className="w-3 h-3 mr-1" />}
                            {copiedIndex === idx ? 'Copied!' : 'Copy'}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => {
                            setName(evt.name);
                            // Try to parse params if possible to pre-fill the builder
                            try {
                              // Quick hack to convert loose JS object string to JSON for basic ones
                              const strictJson = evt.params.replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2": ').replace(/'/g, '"');
                              const parsed = JSON.parse(strictJson);
                              if (parsed && typeof parsed === 'object') {
                                const newRows = Object.entries(parsed).map(([k, v]) => ({ k, v: String(v) }));
                                if (newRows.length > 0) setRows(newRows);
                              }
                            } catch(e) {
                              // If it fails, just set event name
                            }
                          }}>
                            Load in Builder
                          </Button>
                        </div>
                      </div>
                      <CardBody className="p-0">
                        <Textarea 
                          readOnly 
                          value={evt.params} 
                          className="min-h-[100px] font-mono text-xs border-0 focus-visible:ring-0 rounded-none resize-none bg-[var(--st-bg-muted)]/5" 
                        />
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ToolShell>
  );
}

export default function EventTagBuilderPage() {
  return (
    <ErrorBoundary>
      <EventTagBuilder />
    </ErrorBoundary>
  );
}
