'use client';

import {
  Button,
  Input,
  Field,
  Card,
  CardBody,
  StatCard,
  Badge,
  Alert,
  EmptyState,
  cn,
} from '@/components/sabcrm/20ui';
import { useState, useEffect } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, FetchUrlResult } from '@/lib/seo-tools/api-client';
import { fmtDate } from '@/lib/utils';
import { Globe } from 'lucide-react';
import type { BadgeTone } from '@/components/sabcrm/20ui';

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
  let sizeStatus = 'Good';
  let sizeTone: BadgeTone = 'success';
  if (sizeMB > 2) {
    sizeStatus = 'Too large';
    sizeTone = 'danger';
  } else if (sizeMB > 1) {
    sizeStatus = 'Moderate';
    sizeTone = 'warning';
  }

  const statusTone = (status: number): BadgeTone => {
    if (status >= 400) return 'danger';
    if (status >= 300) return 'warning';
    return 'success';
  };

  const historyTone = (bytes: number): BadgeTone => {
    const mb = bytes / (1024 * 1024);
    if (mb > 2) return 'danger';
    if (mb > 1) return 'warning';
    return 'success';
  };

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
        <Field className="flex-1">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="https://example.com"
            disabled={loading}
            aria-label="Page URL to check"
          />
        </Field>
        <Button variant="primary" onClick={() => run()} disabled={loading || !url} loading={loading}>
          {loading ? 'Checking' : 'Check'}
        </Button>
      </div>

      {error && (
        <Alert tone="danger" title="Could not check this page">
          {error}
        </Alert>
      )}

      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardBody className="flex flex-col gap-2">
                <div className="h-8 bg-[var(--st-bg-muted)] rounded-[var(--st-radius)] w-1/2" />
                <div className="h-4 bg-[var(--st-bg-muted)] rounded-[var(--st-radius)] w-1/3" />
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {res && !loading && (
        <div className="space-y-6">
          {sizeMB > 2 && (
            <Alert tone="warning" title="Page size exceeds the 2MB best-practice threshold">
              Consider optimizing images, minifying assets, or removing unnecessary scripts.
            </Alert>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="HTTP Status"
              value={
                <span className="inline-flex items-center gap-2">
                  {res.status}
                  <Badge tone={statusTone(res.status)} kind="soft">
                    {res.status >= 400 ? 'Error' : res.status >= 300 ? 'Redirect' : 'OK'}
                  </Badge>
                </span>
              }
            />
            <StatCard
              label="Size"
              value={
                <span className="inline-flex items-center gap-2">
                  {formatBytes(res.bytes)}
                  <Badge tone={sizeTone} kind="soft">{sizeStatus}</Badge>
                </span>
              }
            />
            <Card>
              <CardBody>
                <div
                  className="text-sm font-bold truncate text-[var(--st-text)]"
                  title={res.contentType || 'Unknown'}
                >
                  {res.contentType || 'Unknown'}
                </div>
                <div className="text-xs text-[var(--st-text-secondary)] mt-2">Content-Type</div>
              </CardBody>
            </Card>
            <StatCard label="Redirection Hops" value={res.redirectChain.length} />
          </div>

          <Card>
            <CardBody className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-[var(--st-text)]">Size Breakdown</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-[var(--st-text)]">HTML Document</span>
                    <span className="text-[var(--st-text-secondary)]">{formatBytes(res.bytes)} (100%)</span>
                  </div>
                  <div className="w-full bg-[var(--st-bg-muted)] rounded-full h-2.5">
                    <div className="bg-[var(--st-accent)] h-2.5 rounded-full w-full" />
                  </div>
                </div>
                <div className="text-sm text-[var(--st-text-secondary)] italic">
                  Note: the current API returns only the raw HTML document size. Embedded resources (images, external CSS/JS) are not included in this breakdown.
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {history.length > 0 && !loading && !res && (
        <Card className="mt-8">
          <CardBody className="p-6">
            <h3 className="text-lg font-semibold mb-4 text-[var(--st-text)]">Recent Checks</h3>
            <div className="space-y-2">
              {history.map((h, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center gap-4 p-3 rounded-[var(--st-radius)] border border-[var(--st-border)] text-sm transition-colors hover:bg-[var(--st-bg-muted)]"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => run(h.url)}
                    className="flex-1 justify-start min-w-0 truncate font-medium"
                    title={h.url}
                  >
                    {h.url}
                  </Button>
                  <div className="flex gap-3 items-center flex-shrink-0">
                    <Badge tone={historyTone(h.bytes)} kind="soft">
                      {formatBytes(h.bytes)}
                    </Badge>
                    <span className="text-xs text-[var(--st-text-secondary)] w-24 text-right">
                      {fmtDate(h.date)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {history.length === 0 && !loading && !res && !error && (
        <EmptyState
          icon={Globe}
          title="No pages checked yet"
          description="Enter a URL above to measure its byte size, HTTP status, content-type, and redirection hops."
        />
      )}
    </ToolShell>
  );
}
