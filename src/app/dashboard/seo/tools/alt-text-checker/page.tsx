'use client';

import { useState } from 'react';
import React, { Component, ReactNode } from 'react';
import { Download, Copy, CheckCircle2 } from 'lucide-react';

import {
  Button,
  Input,
  Field,
  Card,
  CardBody,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Alert,
  Badge,
} from '@/components/sabcrm/20ui';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

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
        <div className="m-4">
          <Alert tone="danger" title="Something went wrong">
            {this.state.error?.message}
          </Alert>
        </div>
      );
    }
    return this.props.children;
  }
}

function AltTextCheckerContent() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<{ src: string; alt: string; hasAlt?: boolean }[]>([]);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const run = async () => {
    if (!url) return;
    setLoading(true); setError(''); setImages([]); setCopied(false);
    try {
      const targetUrl = url.startsWith('http') ? url : `https://${url}`;
      // Routing fetch through apiFetchUrl to bypass CORS as per enhancement plan
      const r = await apiFetchUrl(targetUrl);
      if (r.error) setError(r.error);
      else setImages(parseHtml(r.body).images);
    } catch (err: any) {
      setError(err.message || 'An error occurred fetching the URL');
    } finally { setLoading(false); }
  };

  const missing = images.filter((i) => !i.hasAlt || !i.alt).length;

  const exportMissingToCsv = () => {
    const missingImages = images.filter((i) => !i.hasAlt || !i.alt);
    if (missingImages.length === 0) return;
    const csvLines = ['Image URL'];
    missingImages.forEach((img) => {
      csvLines.push(`"${img.src.replace(/"/g, '""')}"`);
    });
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'missing-alt-images.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  const copyMissingToClipboard = async () => {
    const missingImages = images.filter((i) => !i.hasAlt || !i.alt);
    if (missingImages.length === 0) return;
    const text = missingImages.map(img => img.src).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <ToolShell title="Alt Text Checker" description="Find images missing alt attributes on any page.">
      <div className="flex items-end gap-2">
        <Field label="Page URL" className="flex-1">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
        </Field>
        <Button variant="primary" onClick={run} loading={loading} disabled={loading}>
          {loading ? 'Loading...' : 'Check'}
        </Button>
      </div>
      {error && (
        <Alert tone="danger" title="Could not check this page">
          {error}
        </Alert>
      )}
      {images.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-[var(--st-text-secondary)]">
              {images.length} images ·{' '}
              <span className="text-[var(--st-text)] font-semibold">{missing} missing alt</span>
            </div>
            {missing > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={copied ? CheckCircle2 : Copy}
                  onClick={copyMissingToClipboard}
                >
                  {copied ? 'Copied' : 'Copy Missing'}
                </Button>
                <Button variant="outline" size="sm" iconLeft={Download} onClick={exportMissingToCsv}>
                  Export Missing (CSV)
                </Button>
              </div>
            )}
          </div>
          <Card padding="none">
            <CardBody className="p-0">
              <div className="max-h-[600px] overflow-auto">
                <Table density="compact" stickyHeader>
                  <THead>
                    <Tr>
                      <Th>Image</Th>
                      <Th>Alt</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {images.map((img, i) => {
                      const isMissing = !img.hasAlt || !img.alt;
                      return (
                        <Tr key={i} selected={isMissing}>
                          <Td truncate className="max-w-xs font-mono text-xs">
                            {img.src}
                          </Td>
                          <Td className="text-xs">
                            {!isMissing ? (
                              img.alt
                            ) : (
                              <Badge tone="danger" kind="soft">
                                missing
                              </Badge>
                            )}
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </ToolShell>
  );
}

export default function AltTextCheckerPage() {
  return (
    <ErrorBoundary>
      <AltTextCheckerContent />
    </ErrorBoundary>
  );
}
