'use client';

import {
  Button,
  Textarea,
  Card,
  ZoruCardContent,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Badge,
} from '@/components/zoruui';
import { useState } from 'react';
import { Download, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';

interface CacheResult {
  url: string;
  googleCacheStatus: 'loading' | 'cached' | 'not-cached' | 'error' | 'pending';
  googleCacheUrl?: string;
  waybackStatus: 'loading' | 'cached' | 'not-cached' | 'error' | 'pending';
  waybackUrl?: string;
}

export default function CacheCheckerPage() {
  const [urlsInput, setUrlsInput] = useState('');
  const [results, setResults] = useState<CacheResult[]>([]);
  const [isChecking, setIsChecking] = useState(false);

  const checkUrls = async () => {
    const urls = urlsInput
      .split('\n')
      .map((u) => u.trim())
      .filter((u) => u);

    if (urls.length === 0) return;

    const initialResults: CacheResult[] = urls.map((url) => ({
      url,
      googleCacheStatus: 'pending',
      waybackStatus: 'pending',
    }));

    setResults(initialResults);
    setIsChecking(true);

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      setResults((prev) => {
        const next = [...prev];
        next[i] = { ...next[i], googleCacheStatus: 'loading', waybackStatus: 'loading' };
        return next;
      });

      // Check Google Cache
      const googleCacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
      let gStatus: CacheResult['googleCacheStatus'] = 'error';
      try {
        const gRes = await apiFetchUrl(googleCacheUrl);
        if (gRes.status === 200) {
          gStatus = 'cached';
        } else if (gRes.status === 404) {
          gStatus = 'not-cached';
        } else if (gRes.error) {
          gStatus = 'error';
        } else {
          gStatus = 'not-cached';
        }
      } catch (err) {
        gStatus = 'error';
      }

      // Check Wayback Machine
      const waybackApiUrl = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
      let wStatus: CacheResult['waybackStatus'] = 'error';
      let wUrl: string | undefined = undefined;
      try {
        const wRes = await apiFetchUrl(waybackApiUrl);
        if (wRes.status === 200 && wRes.body) {
          const data = JSON.parse(wRes.body);
          if (data?.archived_snapshots?.closest?.available) {
            wStatus = 'cached';
            wUrl = data.archived_snapshots.closest.url;
          } else {
            wStatus = 'not-cached';
          }
        } else {
          wStatus = 'error';
        }
      } catch (err) {
        wStatus = 'error';
      }

      setResults((prev) => {
        const next = [...prev];
        next[i] = {
          ...next[i],
          googleCacheStatus: gStatus,
          googleCacheUrl: gStatus === 'cached' ? googleCacheUrl : undefined,
          waybackStatus: wStatus,
          waybackUrl: wUrl,
        };
        return next;
      });
    }

    setIsChecking(false);
  };

  const exportToCSV = () => {
    if (!results.length) return;
    const header = ['URL', 'Google Cache Status', 'Google Cache URL', 'Wayback Status', 'Wayback URL'].join(',');
    const rows = results.map((r) =>
      [
        `"${r.url}"`,
        `"${r.googleCacheStatus}"`,
        `"${r.googleCacheUrl || ''}"`,
        `"${r.waybackStatus}"`,
        `"${r.waybackUrl || ''}"`,
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cache_status.csv';
    a.click();
  };

  const copyToClipboard = () => {
    if (!results.length) return;
    const header = ['URL', 'Google Cache Status', 'Google Cache URL', 'Wayback Status', 'Wayback URL'].join('\t');
    const rows = results.map((r) =>
      [
        r.url,
        r.googleCacheStatus,
        r.googleCacheUrl || '',
        r.waybackStatus,
        r.waybackUrl || '',
      ].join('\t')
    );
    const text = [header, ...rows].join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Results copied to clipboard');
  };

  const StatusBadge = ({ status }: { status: CacheResult['googleCacheStatus'] }) => {
    if (status === 'pending') return <Badge variant="outline" className="text-gray-500">Pending</Badge>;
    if (status === 'loading') return <Badge variant="secondary" className="animate-pulse">Checking...</Badge>;
    if (status === 'cached') return <Badge className="bg-green-500 hover:bg-green-600">Cached</Badge>;
    if (status === 'not-cached') return <Badge variant="destructive">Not Cached</Badge>;
    return <Badge variant="destructive">Error</Badge>;
  };

  return (
    <ToolShell title="Cache Checker" description="Check if URLs are cached by Google and the Wayback Machine.">
      <div className="space-y-4">
        <Textarea
          value={urlsInput}
          onChange={(e) => setUrlsInput(e.target.value)}
          placeholder="Enter URLs to check (one per line)"
          rows={5}
        />
        <Button onClick={checkUrls} disabled={isChecking || !urlsInput.trim()}>
          {isChecking && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
          Check Cache Status
        </Button>
      </div>

      {results.length > 0 && (
        <Card className="mt-8">
          <ZoruCardContent className="p-0">
            <div className="flex justify-between items-center p-4 border-b border-border/50">
              <h3 className="text-lg font-semibold">Results</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={exportToCSV}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Google Cache</TableHead>
                    <TableHead>Wayback Machine</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="max-w-[300px] truncate" title={r.url}>
                        {r.url}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={r.googleCacheStatus} />
                          {r.googleCacheUrl && (
                            <a
                              href={r.googleCacheUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={r.waybackStatus} />
                          {r.waybackUrl && (
                            <a
                              href={r.waybackUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
