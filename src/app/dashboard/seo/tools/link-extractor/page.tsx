'use client';

import {
  Button,
  Input,
  Field,
  Textarea,
  Card,
  CardBody,
  Badge,
  Alert,
  EmptyState,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui';
import { useState } from 'react';
import { Download, Link2 } from 'lucide-react';
import { ToolShell } from '@/components/seo-tools/tool-shell';

import { apiFetchUrl, parseHtml } from '@/lib/seo-tools/api-client';

interface LinkRow {
  href: string;
  text: string;
  rel: string;
  nofollow: boolean;
  isInternal?: boolean;
}

export default function LinkExtractorPage() {
  const [inputType, setInputType] = useState<'url' | 'html'>('url');
  const [url, setUrl] = useState('');
  const [rawHtml, setRawHtml] = useState('');
  const [userAgent, setUserAgent] = useState('SabNodeSEOBot/1.0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<LinkRow[] | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [followFilter, setFollowFilter] = useState<'all' | 'dofollow' | 'nofollow'>('all');

  const run = async () => {
    if (inputType === 'url' && !url) return;
    if (inputType === 'html' && !rawHtml) return;

    let validUrl = url;
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      validUrl = 'https://' + url;
      if (inputType === 'url') setUrl(validUrl);
    }
    setLoading(true);
    setError('');
    setRows(null);

    try {
      let resolveBaseUrl = validUrl || 'http://localhost';
      let htmlToParse = '';

      if (inputType === 'url') {
        const r = await apiFetchUrl(validUrl, { userAgent });
        if (r.error) {
          setError(r.error + ' (Try using the Paste Raw HTML option if the site is blocking bots)');
          setLoading(false);
          return;
        }
        resolveBaseUrl = r.finalUrl || validUrl;
        htmlToParse = r.body || '';
      } else {
        htmlToParse = rawHtml;
      }

      const parsed = parseHtml(htmlToParse);

      let baseHost = '';
      try {
        baseHost = new URL(resolveBaseUrl).hostname;
      } catch (e) {}

      const resolvedLinks = (parsed.links || []).map((l: any) => {
        let finalHref = l.href;
        let isInternal = false;
        try {
          const u = new URL(l.href, resolveBaseUrl);
          finalHref = u.href;
          if (baseHost) {
            isInternal = u.hostname === baseHost;
          }
        } catch (e) {}

        return {
          ...l,
          href: finalHref,
          isInternal,
        };
      });
      setRows(resolvedLinks);
    } catch (e: any) {
      setError(e.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const filteredRows = (rows || []).filter((r) => {
    if (typeFilter === 'internal' && !r.isInternal) return false;
    if (typeFilter === 'external' && r.isInternal) return false;
    if (followFilter === 'dofollow' && r.nofollow) return false;
    if (followFilter === 'nofollow' && !r.nofollow) return false;
    return true;
  });

  const exportCsv = () => {
    if (!filteredRows.length) return;
    const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
    const header = 'href,text,rel,nofollow,type\n';
    const body = filteredRows
      .map((r) =>
        [esc(r.href), esc(r.text), esc(r.rel), r.nofollow, r.isInternal ? 'internal' : 'external'].join(','),
      )
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'links.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <ToolShell title="Link Extractor" description="Extract all links from a page and export them as CSV.">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Button
            variant={inputType === 'url' ? 'primary' : 'outline'}
            onClick={() => setInputType('url')}
            block
          >
            Fetch from URL
          </Button>
          <Button
            variant={inputType === 'html' ? 'primary' : 'outline'}
            onClick={() => setInputType('html')}
            block
          >
            Paste Raw HTML
          </Button>
        </div>

        {inputType === 'url' ? (
          <div className="flex gap-2 items-end">
            <Field label="Page URL" className="flex-1">
              <Input
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </Field>
            <Field label="User Agent" className="w-[200px]">
              <Select value={userAgent} onValueChange={setUserAgent}>
                <SelectTrigger aria-label="User Agent">
                  <SelectValue placeholder="User Agent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SabNodeSEOBot/1.0">SabNode SEO Bot</SelectItem>
                  <SelectItem value="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)">
                    Googlebot Desktop
                  </SelectItem>
                  <SelectItem value="Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)">
                    Googlebot Smartphone
                  </SelectItem>
                  <SelectItem value="Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)">
                    Bingbot
                  </SelectItem>
                  <SelectItem value="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36">
                    Chrome (Windows)
                  </SelectItem>
                  <SelectItem value="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36">
                    Chrome (Mac)
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Button onClick={run} loading={loading} disabled={!url}>
              {loading ? 'Extracting...' : 'Extract'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Field label="HTML source">
              <Textarea
                placeholder="Paste HTML source code here to bypass bot blocking..."
                value={rawHtml}
                onChange={(e) => setRawHtml(e.target.value)}
                rows={8}
                className="font-mono text-xs"
              />
            </Field>
            <div className="flex gap-2 items-end">
              <Field
                label="Base URL"
                help="Optional, for resolving relative links e.g. https://example.com"
                className="flex-1"
              >
                <Input
                  placeholder="https://example.com"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </Field>
              <Button onClick={run} loading={loading} disabled={!rawHtml}>
                {loading ? 'Extracting...' : 'Extract'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}

      {rows && (
        <Card className="mt-4" padding="none">
          <CardBody className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="text-sm font-semibold text-[var(--st-text)]">
                  {filteredRows.length} links
                </div>
                <div className="flex items-center gap-2">
                  <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                    <SelectTrigger aria-label="Link type" className="w-[130px]">
                      <SelectValue placeholder="Link Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                      <SelectItem value="external">External</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={followFilter} onValueChange={(v: any) => setFollowFilter(v)}>
                    <SelectTrigger aria-label="Follow status" className="w-[130px]">
                      <SelectValue placeholder="Follow Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Follow</SelectItem>
                      <SelectItem value="dofollow">Dofollow</SelectItem>
                      <SelectItem value="nofollow">Nofollow</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" variant="outline" iconLeft={Download} onClick={exportCsv}>
                Export CSV
              </Button>
            </div>
            {filteredRows.length === 0 ? (
              <EmptyState
                icon={Link2}
                title="No links match these filters"
                description="Try changing the link type or follow status filters above."
              />
            ) : (
              <div className="overflow-auto max-h-[600px]">
                <Table density="compact" stickyHeader className="w-full">
                  <THead>
                    <Tr>
                      <Th>Href</Th>
                      <Th>Text</Th>
                      <Th>Type</Th>
                      <Th>Rel</Th>
                      <Th>Nofollow</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {filteredRows.map((r, i) => (
                      <Tr key={i}>
                        <Td className="font-mono text-xs break-all max-w-xs">
                          <a
                            href={r.href}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[var(--st-text)] hover:underline"
                          >
                            {r.href}
                          </a>
                        </Td>
                        <Td truncate className="max-w-xs">
                          {r.text}
                        </Td>
                        <Td>
                          {r.isInternal ? (
                            <Badge tone="info" kind="outline">
                              Internal
                            </Badge>
                          ) : (
                            <Badge tone="neutral">External</Badge>
                          )}
                        </Td>
                        <Td className="text-xs">{r.rel}</Td>
                        <Td>
                          {r.nofollow ? (
                            <Badge tone="danger">Yes</Badge>
                          ) : (
                            <Badge tone="neutral" kind="outline">
                              No
                            </Badge>
                          )}
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
