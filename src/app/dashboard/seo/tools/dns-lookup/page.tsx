'use client';

import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { Button, Input, Card, ZoruCardContent } from '@/components/zoruui';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiDnsLookup } from '@/lib/seo-tools/api-client';
import { Copy, Download, AlertCircle } from 'lucide-react';

class ErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('DNS Lookup Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default function DnsLookupPageWrapper() {
  return (
    <ErrorBoundary fallback={<div className="p-4 text-red-500">Something went wrong in the DNS Lookup tool.</div>}>
      <DnsLookupPage />
    </ErrorBoundary>
  );
}

function DnsLookupPage() {
  const [host, setHost] = useState('');
  const [type, setType] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const cleanHost = (input: string) => {
    try {
      if (input.startsWith('http://') || input.startsWith('https://')) {
        return new URL(input).hostname;
      }
      return input.split('/')[0];
    } catch {
      return input;
    }
  };

  const run = async () => {
    const targetHost = cleanHost(host.trim());
    if (!targetHost) {
      setError('Please enter a valid hostname.');
      return;
    }
    setHost(targetHost);
    setLoading(true);
    setError('');
    setData(null);
    try {
      const r = await apiDnsLookup(targetHost, type === 'ALL' ? undefined : type);
      if (r.error) setError(r.error);
      else setData(r);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const flattenRecords = (records: Record<string, any>) => {
    if (!records) return [];
    const rows: { type: string; value: string }[] = [];
    for (const [t, d] of Object.entries(records)) {
      if (d?.error) {
        rows.push({ type: t, value: `Error: ${d.error}` });
        continue;
      }
      if (Array.isArray(d)) {
        for (const item of d) {
          if (typeof item === 'string') {
            rows.push({ type: t, value: item });
          } else if (Array.isArray(item)) {
            rows.push({ type: t, value: item.join(' ') });
          } else if (typeof item === 'object') {
            const parts = Object.entries(item)
              .map(([k, v]) => `${k}=${v}`)
              .join(', ');
            rows.push({ type: t, value: parts });
          }
        }
      } else if (typeof d === 'object') {
        const parts = Object.entries(d)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        rows.push({ type: t, value: parts });
      } else {
        rows.push({ type: t, value: String(d) });
      }
    }
    return rows;
  };

  const handleCopy = () => {
    if (!data?.records) return;
    const flat = flattenRecords(data.records);
    const text = flat.map((r) => `${r.type}\t${r.value}`).join('\n');
    navigator.clipboard.writeText(text);
  };

  const handleExportCsv = () => {
    if (!data?.records) return;
    const flat = flattenRecords(data.records);
    const csvRows = ['Type,Value'];
    for (const r of flat) {
      const val = r.value.replace(/"/g, '""');
      const csvVal = /[,"\n]/.test(val) ? `"${val}"` : val;
      csvRows.push(`${r.type},${csvVal}`);
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dns_${data.host || 'lookup'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const flattenedData = data?.records ? flattenRecords(data.records) : [];

  return (
    <ToolShell title="DNS Lookup" description="Query DNS records for any hostname.">
      <div className="flex gap-2">
        <Input
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="example.com"
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <select
          className="border rounded h-9 px-2 bg-background"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option>ALL</option>
          <option>A</option>
          <option>AAAA</option>
          <option>MX</option>
          <option>TXT</option>
          <option>NS</option>
          <option>CNAME</option>
          <option>SOA</option>
        </select>
        <Button onClick={run} disabled={loading}>
          {loading ? 'Looking up…' : 'Lookup'}
        </Button>
      </div>

      {error && (
        <Card className="border-red-500">
          <ZoruCardContent className="p-4 flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </ZoruCardContent>
        </Card>
      )}

      {data && !error && (
        <Card>
          <ZoruCardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
              <div className="text-lg font-semibold">Results for: {data.host}</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCsv}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>

            {flattenedData.length === 0 ? (
              <div className="text-sm text-muted-foreground p-4 bg-muted rounded">
                No DNS records found for the selected type(s).
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-2 border font-medium w-24">Type</th>
                      <th className="p-2 border font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flattenedData.map((row, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="p-2 border font-mono font-semibold text-primary">{row.type}</td>
                        <td className="p-2 border font-mono break-all text-xs">
                          {row.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
