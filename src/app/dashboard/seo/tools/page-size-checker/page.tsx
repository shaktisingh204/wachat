'use client';

import { Button, Input, Card, ZoruCardContent, cn } from '@/components/sabcrm/20ui/compat';
import { useState, useEffect } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, FetchUrlResult } from '@/lib/seo-tools/api-client';
import { fmtDate } from '@/lib/utils';

interface HistoryEntry {
  url: string;
  bytes: number;
  date: string;
}

export default function PageSizeCheckerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<FetchUrlResult | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('pageSizeHistory');
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load history', e);
    }
  }, []);

  const saveHistory = (newUrl: string, bytes: number) => {
    setHistory(prev => {
      const newEntry: HistoryEntry = { url: newUrl, bytes, date: new Date().toISOString() };
      const filtered = prev.filter(p => p.url !== newUrl);
      const updated = [newEntry, ...filtered].slice(0, 10);
      try {
        localStorage.setItem('pageSizeHistory', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save history', e);
      }
      return updated;
    });
  };

  const run = async (targetUrl: string = url) => {
    if (!targetUrl) return;
    setUrl(targetUrl);
    setLoading(true); 
    setError(''); 
    setRes(null);
    try {
      // Basic prepend of https:// if missing to help out
      let validUrl = targetUrl;
      if (!/^https?:\/\//i.test(validUrl)) {
        validUrl = 'https://' + validUrl;
      }
      const r = await apiFetchUrl(validUrl);
      if (r.error) {
        setError(r.error);
      } else {
        setRes(r);
        saveHistory(validUrl, r.bytes);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally { 
      setLoading(false); 
    }
  };

  const sizeMB = res ? res.bytes / (1024 * 1024) : 0;
  let sizeColor = 'text-[var(--st-text)]';
  let sizeStatus = 'Good';
  if (sizeMB > 2) {
    sizeColor = 'text-[var(--st-text)]';
    sizeStatus = 'Too Large';
  } else if (sizeMB > 1) {
    sizeColor = 'text-[var(--st-text)]';
    sizeStatus = 'Moderate';
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <ToolShell title="Page Size Checker" description="Check the byte size, status, content-type, and redirection hops of a given web page URL.">
      <div className="flex gap-2">
        <Input 
          value={url} 
          onChange={(e) => setUrl(e.target.value)} 
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="https://example.com" 
          disabled={loading}
        />
        <Button onClick={() => run()} disabled={loading || !url}>
          {loading ? 'Checking…' : 'Check'}
        </Button>
      </div>

      {error && (
        <Card className="border-[var(--st-border)]">
          <ZoruCardContent className="p-4 text-[var(--st-text)] text-sm">
            {error}
          </ZoruCardContent>
        </Card>
      )}

      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <ZoruCardContent className="p-4 flex flex-col gap-2">
                <div className="h-8 bg-[var(--st-bg-muted)] rounded w-1/2"></div>
                <div className="h-4 bg-[var(--st-bg-muted)] rounded w-1/3"></div>
              </ZoruCardContent>
            </Card>
          ))}
        </div>
      )}

      {res && !loading && (
        <div className="space-y-6">
          {sizeMB > 2 && (
            <div className="bg-[var(--st-bg-muted)] border border-[var(--st-border)] text-[var(--st-text)] rounded-md p-4 flex gap-2 items-center">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span><strong>Warning:</strong> The page size exceeds the 2MB best-practice threshold. Consider optimizing images, minifying assets, or removing unnecessary scripts.</span>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <ZoruCardContent className="p-4">
                <div className={cn("text-2xl font-bold", res.status >= 400 ? 'text-[var(--st-text)]' : (res.status >= 300 ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]'))}>
                  {res.status}
                </div>
                <div className="text-xs text-[var(--st-text-secondary)]">HTTP Status</div>
              </ZoruCardContent>
            </Card>
            <Card>
              <ZoruCardContent className="p-4">
                <div className={cn("text-2xl font-bold", sizeColor)}>
                  {formatBytes(res.bytes)}
                </div>
                <div className="text-xs text-[var(--st-text-secondary)] flex justify-between">
                  <span>Size</span>
                  <span className={sizeColor}>{sizeStatus}</span>
                </div>
              </ZoruCardContent>
            </Card>
            <Card>
              <ZoruCardContent className="p-4">
                <div className="text-sm font-bold truncate mt-1 mb-2" title={res.contentType || '—'}>
                  {res.contentType || '—'}
                </div>
                <div className="text-xs text-[var(--st-text-secondary)]">Content-Type</div>
              </ZoruCardContent>
            </Card>
            <Card>
              <ZoruCardContent className="p-4">
                <div className="text-2xl font-bold">{res.redirectChain.length}</div>
                <div className="text-xs text-[var(--st-text-secondary)]">Redirection Hops</div>
              </ZoruCardContent>
            </Card>
          </div>

          <Card>
            <ZoruCardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Size Breakdown</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">HTML Document</span>
                    <span className="text-[var(--st-text-secondary)]">{formatBytes(res.bytes)} (100%)</span>
                  </div>
                  <div className="w-full bg-[var(--st-bg-muted)] rounded-full h-2.5">
                    <div className="bg-[var(--st-text)] h-2.5 rounded-full" style={{ width: '100%' }}></div>
                  </div>
                </div>
                <div className="text-sm text-[var(--st-text-secondary)] italic">
                  Note: The current API returns only the raw HTML document size. Embedded resources (images, external CSS/JS) are not included in this breakdown.
                </div>
              </div>
            </ZoruCardContent>
          </Card>
        </div>
      )}

      {history.length > 0 && !loading && !res && (
        <Card className="mt-8">
          <ZoruCardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Checks</h3>
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex justify-between items-center p-3 hover:bg-[var(--st-bg-muted)]/50 rounded-md border text-sm transition-colors">
                  <div className="truncate flex-1 font-medium pr-4 cursor-pointer hover:underline" onClick={() => run(h.url)}>
                    {h.url}
                  </div>
                  <div className="flex gap-4 items-center flex-shrink-0">
                    <span className={cn(
                      "font-semibold", 
                      (h.bytes / (1024 * 1024)) > 2 ? 'text-[var(--st-text)]' : ((h.bytes / (1024 * 1024)) > 1 ? 'text-[var(--st-text)]' : 'text-[var(--st-text)]')
                    )}>
                      {formatBytes(h.bytes)}
                    </span>
                    <span className="text-xs text-[var(--st-text-secondary)] w-24 text-right">
                      {fmtDate(h.date)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
