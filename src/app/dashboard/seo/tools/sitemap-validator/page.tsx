'use client';

import { Button, Input, Card, CardBody, cn } from '@/components/sabcrm/20ui';
import { cn as _ui20Cn, useState } from 'react';
import { XMLParser } from 'fast-xml-parser';

void _ui20Cn;

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';

export default function SitemapValidatorPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    isXml: boolean;
    hasUrlset: boolean;
    isIndex: boolean;
    count: number;
    allUrls: string[];
  } | null>(null);
  const [error, setError] = useState('');

  const [urlStatuses, setUrlStatuses] = useState<Record<string, { status: number, redirect?: string, loading?: boolean }>>({});
  const [checkingStatuses, setCheckingStatuses] = useState(false);

  const run = async () => {
    setLoading(true); setError(''); setResult(null); setUrlStatuses({});
    try {
      const r = await apiFetchUrl(url);
      if (r.error) { setError(r.error); return; }
      const body = r.body.trim();
      
      let parsed: any;
      try {
        const parser = new XMLParser({ ignoreAttributes: false });
        parsed = parser.parse(body);
      } catch (err) {
        setError('Failed to parse XML: ' + (err as Error).message);
        return;
      }

      const isXml = body.startsWith('<?xml') || !!parsed['?xml'];
      const hasUrlset = !!parsed['urlset'];
      const isIndex = !!parsed['sitemapindex'];
      
      const locs: string[] = [];
      const extractLocs = (obj: any) => {
        if (typeof obj === 'string') return;
        if (Array.isArray(obj)) {
          obj.forEach(extractLocs);
          return;
        }
        if (typeof obj === 'object' && obj !== null) {
          for (const key of Object.keys(obj)) {
            if (key === 'loc') {
              const val = obj[key];
              if (typeof val === 'string' || typeof val === 'number') {
                locs.push(String(val));
              } else if (Array.isArray(val)) {
                val.forEach((v: any) => {
                  if (typeof v === 'string' || typeof v === 'number') locs.push(String(v));
                  else if (typeof v === 'object' && v !== null && v['#text']) locs.push(String(v['#text']));
                });
              } else if (typeof val === 'object' && val !== null && val['#text']) {
                locs.push(String(val['#text']));
              }
            } else {
              extractLocs(obj[key]);
            }
          }
        }
      };
      
      extractLocs(parsed);
      
      setResult({ 
        isXml, 
        hasUrlset, 
        isIndex, 
        count: locs.length, 
        allUrls: locs
      });
    } catch (e: any) {
      setError(e.message || 'An error occurred while validating the sitemap.');
    } finally { 
      setLoading(false); 
    }
  };

  const checkStatuses = async () => {
    if (!result) return;
    setCheckingStatuses(true);
    
    const urlsToCheck = result.allUrls.slice(0, 100);
    
    setUrlStatuses(prev => {
      const next = { ...prev };
      urlsToCheck.forEach(u => {
        next[u] = { ...next[u], loading: true };
      });
      return next;
    });

    const BATCH_SIZE = 5;
    for (let i = 0; i < urlsToCheck.length; i += BATCH_SIZE) {
      const batch = urlsToCheck.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (u) => {
        try {
          const res = await apiFetchUrl(u, { method: 'HEAD' });
          setUrlStatuses(prev => ({
            ...prev,
            [u]: {
              loading: false,
              status: res.status || 0,
              redirect: res.redirectChain?.length ? res.redirectChain[res.redirectChain.length - 1].url : undefined
            }
          }));
        } catch (err) {
           setUrlStatuses(prev => ({
            ...prev,
            [u]: { loading: false, status: 0 }
          }));
        }
      }));
    }
    
    setCheckingStatuses(false);
  };

  return (
    <ToolShell title="Sitemap Validator" description="Validate a sitemap.xml and list its URLs.">
      <div className="flex gap-2">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/sitemap.xml" />
        <Button onClick={run} disabled={loading}>{loading ? 'Validating…' : 'Validate'}</Button>
      </div>
      {error && <Card className="border-[var(--st-border)]"><CardBody className="p-4 text-[var(--st-text)] text-sm">{error}</CardBody></Card>}
      {result && (
        <Card>
          <CardBody className="p-4 space-y-4 text-sm">
            <div className="space-y-1">
              <div>XML header: {result.isXml ? '✅' : '❌'}</div>
              <div>Urlset: {result.hasUrlset ? '✅' : '❌'}</div>
              <div>Sitemap index: {result.isIndex ? '✅' : '—'}</div>
              <div>URLs: {result.count}</div>
            </div>
            
            {result.count > 0 && (
              <div>
                <div className="flex items-center justify-between mt-3 mb-2">
                  <div className="text-xs font-semibold">
                    First {Math.min(result.count, 100)} URLs (capped at 100 for status check):
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={checkStatuses}
                    disabled={checkingStatuses}
                  >
                    {checkingStatuses ? 'Checking...' : 'Check Statuses'}
                  </Button>
                </div>
                <div className="max-h-[400px] overflow-y-auto border rounded divide-y">
                  {result.allUrls.slice(0, 100).map((u: string, i: number) => {
                    const statusInfo = urlStatuses[u];
                    return (
                      <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-2 gap-2 text-xs font-mono">
                        <div className="truncate flex-1" title={u}>{u}</div>
                        <div className="w-24 text-right flex-shrink-0">
                          {statusInfo?.loading ? (
                            <span className="text-[var(--st-text)]">Checking...</span>
                          ) : statusInfo?.status ? (
                            <span className={statusInfo.status === 200 ? "text-[var(--st-text)] font-bold" : statusInfo.status >= 400 ? "text-[var(--st-text)] font-bold" : "text-[var(--st-text)] font-bold"}>
                              {statusInfo.status} {statusInfo.status === 200 ? 'OK' : ''}
                            </span>
                          ) : (
                            <span className="text-[var(--st-text-secondary)]">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </ToolShell>
  );
}
