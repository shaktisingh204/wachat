'use client';

import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import {
  Button,
  Input,
  Card,
  CardBody,
  Alert,
  EmptyState,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Badge,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiDnsLookup } from '@/lib/seo-tools/api-client';
import { Copy, Download, Inbox } from 'lucide-react';

const RECORD_TYPES = ['ALL', 'A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA'] as const;

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
    <ErrorBoundary
      fallback={
        <div className="p-4">
          <Alert tone="danger" title="Something went wrong">
            The DNS Lookup tool hit an unexpected error. Reload the page to try again.
          </Alert>
        </div>
      }
    >
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
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <Input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="example.com"
            aria-label="Hostname to look up"
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger aria-label="DNS record type" className="sm:w-40">
            <SelectValue placeholder="Record type" />
          </SelectTrigger>
          <SelectContent>
            {RECORD_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="primary" onClick={run} loading={loading}>
          {loading ? 'Looking up...' : 'Lookup'}
        </Button>
      </div>

      {error && (
        <Alert tone="danger" title="Lookup failed">
          {error}
        </Alert>
      )}

      {data && !error && (
        <Card>
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-col items-start justify-between gap-2 sm:flex-row sm:items-center">
              <div className="text-lg font-semibold text-[var(--st-text)]">
                Results for: {data.host}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" iconLeft={Copy} onClick={handleCopy}>
                  Copy
                </Button>
                <Button variant="outline" size="sm" iconLeft={Download} onClick={handleExportCsv}>
                  Export CSV
                </Button>
              </div>
            </div>

            {flattenedData.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="No DNS records found"
                description="No records were returned for the selected type. Try a different record type or hostname."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table density="compact">
                  <THead>
                    <Tr>
                      <Th width={96}>Type</Th>
                      <Th>Value</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {flattenedData.map((row, idx) => (
                      <Tr key={idx}>
                        <Td>
                          <Badge tone="neutral" className="font-mono">
                            {row.type}
                          </Badge>
                        </Td>
                        <Td>
                          <span className="break-all font-mono text-xs text-[var(--st-text)]">
                            {row.value}
                          </span>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </ToolShell>
  );
}
