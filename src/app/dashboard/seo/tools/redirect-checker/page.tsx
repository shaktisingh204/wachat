'use client';

import { Button, Input, Card, ZoruCardContent, Badge, cn, Alert, ZoruAlertTitle, ZoruAlertDescription } from '@/components/sabcrm/20ui/compat';
import { cn as _zoruCn, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { AlertCircle, MoveDown, Info } from 'lucide-react';

void _zoruCn;

import { apiFetchUrl, type FetchUrlResult } from '@/lib/seo-tools/api-client';

function getMetaRefreshUrl(html: string | undefined): string | null {
  if (!html) return null;
  // Look for meta tags with http-equiv="refresh"
  const metaTags = html.match(/<meta[^>]+>/gi) || [];
  for (const tag of metaTags) {
    if (/http-equiv=["']refresh["']/i.test(tag)) {
      const contentMatch = tag.match(/content=["']\s*\d+\s*;\s*url\s*=\s*["']?([^"'>\s]+)["']?/i);
      if (contentMatch) {
        return contentMatch[1];
      }
    }
  }
  return null;
}

export default function RedirectCheckerPage() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState<FetchUrlResult | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    let target = url;
    if (!target.trim()) return;
    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      target = 'https://' + target;
    }
    setUrl(target); // reflect protocol in input if added
    
    setLoading(true);
    setResult(null);
    try {
      const r = await apiFetchUrl(target);
      setResult(r);
    } finally {
      setLoading(false);
    }
  };

  const getDisplayChain = () => {
    if (!result || !result.redirectChain) return [];
    
    const chain: { url: string; status: number | string; location?: string; isMeta?: boolean }[] = [...result.redirectChain];
    
    // Check for meta refresh in the final HTML
    const metaRefreshUrl = getMetaRefreshUrl(result.body);
    if (metaRefreshUrl) {
      // Resolve relative URL if needed
      let absoluteMetaUrl = metaRefreshUrl;
      try {
        absoluteMetaUrl = new URL(metaRefreshUrl, result.finalUrl || result.url).toString();
      } catch (e) {
        // ignore
      }
      
      // Update the last HTTP hop to point to the meta refresh location
      if (chain.length > 0) {
        chain[chain.length - 1].location = absoluteMetaUrl;
      }
      
      // Add the meta refresh hop
      chain.push({
        url: absoluteMetaUrl,
        status: 'META REFRESH',
        isMeta: true
      });
    }
    
    return chain;
  };

  const displayChain = getDisplayChain();
  
  // Calculate total redirects (hops), subtracting the final page
  // If chain length is 1 (just the final 200 OK), it's 0 redirects.
  const redirectCount = Math.max(0, displayChain.length - 1);
  
  const hasTooManyRedirectsError = result?.error?.toLowerCase().includes('too many redirects');
  const isChainTooLong = redirectCount >= 3;
  
  return (
    <ToolShell title="Redirect Checker" description="Trace the redirect chain from an initial URL to its final destination.">
      <div className="flex gap-2">
        <Input
          placeholder="https://example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run();
          }}
        />
        <Button onClick={run} disabled={loading || !url}>
          {loading ? 'Checking…' : 'Check'}
        </Button>
      </div>

      {(result?.error || hasTooManyRedirectsError) && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <ZoruAlertTitle>Error fetching URL</ZoruAlertTitle>
          <ZoruAlertDescription>
            {hasTooManyRedirectsError 
              ? "Redirect loop or overly long chain detected. The server responded with 'Too many redirects'." 
              : result?.error}
          </ZoruAlertDescription>
        </Alert>
      )}

      {result && !result.error && (
        <Card className="mt-4">
          <ZoruCardContent className="p-6 space-y-6">
            
            {isChainTooLong && (
              <Alert variant="destructive" className="bg-zoru-ink/10 text-zoru-ink border-destructive/20">
                <AlertCircle className="h-4 w-4" />
                <ZoruAlertTitle>Too Many Redirects</ZoruAlertTitle>
                <ZoruAlertDescription>
                  This URL has {redirectCount} redirects. Redirect chains longer than 2 hops can negatively impact SEO and slow down page load times. Consider pointing directly to the final destination.
                </ZoruAlertDescription>
              </Alert>
            )}
            
            {displayChain.some(h => h.isMeta) && (
              <Alert className="bg-zoru-surface-2 text-zoru-ink border-zoru-line dark:bg-zoru-ink/50 dark:text-white dark:border-zoru-line">
                <Info className="h-4 w-4" />
                <ZoruAlertTitle>Meta Refresh Detected</ZoruAlertTitle>
                <ZoruAlertDescription>
                  The final page contains a meta refresh tag that redirects the user to another URL. Search engines generally prefer HTTP 301 redirects over meta refreshes.
                </ZoruAlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="Redirects" value={String(redirectCount)} />
              <Stat label="Final Status" value={String(result.status)} />
              <Stat label="Final URL" value={result.finalUrl} mono className="col-span-2 md:col-span-2" />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="text-base font-semibold">Redirect Timeline</div>
              
              {displayChain.length === 0 ? (
                <div className="text-sm text-zoru-ink-muted">No data available.</div>
              ) : (
                <div className="space-y-0 relative ml-2">
                  {displayChain.map((hop, i) => {
                    const isLast = i === displayChain.length - 1;
                    const isError = typeof hop.status === 'number' && hop.status >= 400;
                    const isWarning = typeof hop.status === 'number' && hop.status >= 300 && hop.status < 400;
                    
                    return (
                      <div key={i} className="flex gap-4 relative">
                        {/* Timeline line */}
                        {!isLast && (
                          <div className="absolute left-[11px] top-7 bottom-[-7px] w-[2px] bg-border" />
                        )}
                        
                        {/* Timeline node */}
                        <div className="flex flex-col items-center mt-1">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10 ring-4 ring-background",
                            isLast ? (isError ? "bg-zoru-ink text-white" : "bg-zoru-ink text-white") : "bg-zoru-surface-2 text-zoru-ink-muted"
                          )}>
                            {i + 1}
                          </div>
                        </div>
                        
                        {/* Timeline content */}
                        <div className="flex-1 pb-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge 
                              variant={hop.isMeta ? "secondary" : isError ? "destructive" : isWarning ? "default" : "secondary"}
                              className={cn(hop.isMeta && "bg-zoru-surface-2 text-zoru-ink hover:bg-zoru-surface-2 dark:bg-zoru-ink dark:text-white")}
                            >
                              {hop.isMeta ? "META REFRESH" : `HTTP ${hop.status}`}
                            </Badge>
                            {isLast && (
                              <Badge variant="outline" className="text-zoru-ink-muted border-muted-foreground/30">
                                Final Destination
                              </Badge>
                            )}
                          </div>
                          <div className="font-mono text-sm break-all text-zoru-ink bg-zoru-surface-2/40 p-3 rounded-md border border-zoru-line/50">
                            {hop.url}
                          </div>
                          {hop.location && (
                            <div className="mt-3 text-sm flex items-center gap-2 text-zoru-ink-muted ml-1">
                              <MoveDown className="w-3.5 h-3.5" />
                              <span className="font-medium">Redirects to</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}

function Stat({ label, value, mono, className }: { label: string; value: string; mono?: boolean, className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-zoru-surface p-4 shadow-sm", className)}>
      <div className="text-xs text-zoru-ink-muted font-medium mb-1">{label}</div>
      <div className={cn("truncate", mono ? 'font-mono text-sm' : 'text-xl font-bold')} title={mono ? value : undefined}>{value}</div>
    </div>
  );
}
