'use client';

import {
  Button,
  Input,
  Field,
  Card,
  CardBody,
  Badge,
  Alert,
  Table,
  TBody,
  Tr,
  Td,
} from '@/components/sabcrm/20ui';
import { useState } from 'react';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl, parseHtml, type ParsedHtml } from '@/lib/seo-tools/api-client';

function getValidationBadge(type: 'title' | 'description', text: string = '') {
  const len = text.length;
  if (type === 'title') {
    if (len === 0) return <Badge tone="danger">Missing</Badge>;
    if (len < 30) return <Badge tone="warning">{len} chars - Too short</Badge>;
    if (len > 60) return <Badge tone="warning">{len} chars - Too long</Badge>;
    return <Badge tone="success">{len} chars - Good</Badge>;
  }
  if (type === 'description') {
    if (len === 0) return <Badge tone="danger">Missing</Badge>;
    if (len < 120) return <Badge tone="warning">{len} chars - Too short</Badge>;
    if (len > 160) return <Badge tone="warning">{len} chars - Too long</Badge>;
    return <Badge tone="success">{len} chars - Good</Badge>;
  }
  return null;
}

export default function MetaTagAnalyzerPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedHtml | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    if (!url) return;
    setLoading(true); setError(''); setParsed(null);
    try {
      let fetchUrl = url;
      if (!fetchUrl.startsWith('http://') && !fetchUrl.startsWith('https://')) {
        fetchUrl = 'https://' + fetchUrl;
      }
      const r = await apiFetchUrl(fetchUrl);
      if (r.error) setError(r.error);
      else setParsed(parseHtml(r.body));
    } catch (e: any) {
      setError(e.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const rows: [string, string, React.ReactNode][] = parsed
    ? [
        ['Title', parsed.title, getValidationBadge('title', parsed.title)],
        ['Description', parsed.metaDescription, getValidationBadge('description', parsed.metaDescription)],
        ['Canonical', parsed.canonical, null],
        ['Robots', parsed.robots, null],
        ['Viewport', parsed.viewport, null],
        ['Lang', parsed.lang, null],
        ['Charset', parsed.charset, null],
      ]
    : [];

  let domain = '';
  try {
    domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
  } catch {
    domain = url;
  }

  const ogImage = parsed?.openGraph?.['og:image'];
  const ogTitle = parsed?.openGraph?.['og:title'] || parsed?.title;
  const ogDesc = parsed?.openGraph?.['og:description'] || parsed?.metaDescription;

  const twImage = parsed?.twitter?.['twitter:image'] || parsed?.twitter?.['twitter:image:src'] || ogImage;
  const twTitle = parsed?.twitter?.['twitter:title'] || ogTitle;
  const twDesc = parsed?.twitter?.['twitter:description'] || ogDesc;

  return (
    <ToolShell title="Meta Tag Analyzer" description="Inspect meta tags, Open Graph, and Twitter cards of any URL.">
      <div className="flex gap-2">
        <Field className="flex-1">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            aria-label="URL to analyze"
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
        </Field>
        <Button variant="primary" onClick={run} loading={loading} disabled={loading}>
          {loading ? 'Loading...' : 'Analyze'}
        </Button>
      </div>
      {error && (
        <Alert tone="danger" title="Could not analyze that URL">
          {error}
        </Alert>
      )}

      {parsed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="flex flex-col gap-6">
            <Card>
              <CardBody className="p-4">
                <div className="font-semibold text-sm mb-4 text-[var(--st-text)]">Meta Tags</div>
                <Table density="compact" hover={false}>
                  <TBody>
                    {rows.map(([k, v, badge]) => (
                      <Tr key={k as string}>
                        <Td className="font-semibold w-32 align-top text-[var(--st-text)]">{k as string}</Td>
                        <Td>
                          <div className="flex flex-col gap-1.5 items-start">
                            {badge && <div>{badge}</div>}
                            <span className="break-all text-[var(--st-text)]">
                              {v || <span className="text-[var(--st-text-secondary)]">Not set</span>}
                            </span>
                          </div>
                        </Td>
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </CardBody>
            </Card>

            {(Object.keys(parsed.openGraph).length > 0 || Object.keys(parsed.twitter).length > 0) && (
              <Card>
                <CardBody className="p-4">
                  <div className="font-semibold text-sm mb-4 text-[var(--st-text)]">Social Tags</div>

                  {Object.keys(parsed.openGraph).length > 0 && (
                    <div className="mb-6">
                      <div className="text-xs font-semibold text-[var(--st-text-secondary)] mb-2 uppercase tracking-wider">Open Graph</div>
                      {Object.entries(parsed.openGraph).map(([k, v]) => (
                        <div key={k} className="text-xs border-t border-[var(--st-border)] py-2 break-all">
                          <span className="font-mono text-[var(--st-text-secondary)] mr-2">{k}:</span>
                          <span className="text-[var(--st-text)]">{v as string}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {Object.keys(parsed.twitter).length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-[var(--st-text-secondary)] mb-2 uppercase tracking-wider">Twitter</div>
                      {Object.entries(parsed.twitter).map(([k, v]) => (
                        <div key={k} className="text-xs border-t border-[var(--st-border)] py-2 break-all">
                          <span className="font-mono text-[var(--st-text-secondary)] mr-2">{k}:</span>
                          <span className="text-[var(--st-text)]">{v as string}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardBody className="p-4">
                <div className="font-semibold text-sm mb-4 text-[var(--st-text)]">Google SERP Preview</div>
                <div className="p-4 bg-[var(--st-bg)] rounded-[var(--st-radius)] border border-[var(--st-border)] max-w-2xl shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-7 h-7 rounded-full bg-[var(--st-bg-secondary)] flex items-center justify-center text-xs overflow-hidden border border-[var(--st-border)]">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
                        alt=""
                        aria-hidden="true"
                        className="w-4 h-4"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[14px] text-[var(--st-text)] truncate leading-tight">{domain}</span>
                      <span className="text-[12px] text-[var(--st-text-secondary)] truncate leading-tight">{url}</span>
                    </div>
                  </div>
                  <div className="text-[20px] text-[var(--st-accent)] hover:underline cursor-pointer truncate mb-1 font-[arial,sans-serif]">
                    {parsed.title || 'No Title'}
                  </div>
                  <div className="text-[14px] text-[var(--st-text-secondary)] line-clamp-2 font-[arial,sans-serif]">
                    {parsed.metaDescription || 'No description provided.'}
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="p-4">
                <div className="font-semibold text-sm mb-4 text-[var(--st-text)]">Twitter / X Card Preview</div>
                <div className="max-w-[500px] border border-[var(--st-border)] rounded-2xl overflow-hidden bg-[var(--st-bg)] hover:bg-[var(--st-bg-secondary)] cursor-pointer transition-colors">
                  {twImage ? (
                    <div className="w-full aspect-[1.91/1] bg-[var(--st-bg-secondary)] border-b border-[var(--st-border)] relative">
                      <img
                        src={twImage}
                        alt="Twitter card preview"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-[1.91/1] bg-[var(--st-bg-secondary)] border-b border-[var(--st-border)] flex items-center justify-center text-[var(--st-text-secondary)]">
                      No Image Provided
                    </div>
                  )}
                  <div className="p-3">
                    <div className="text-[13px] text-[var(--st-text-secondary)] mb-0.5 truncate">{domain}</div>
                    <div className="text-[15px] font-semibold text-[var(--st-text)] truncate">{twTitle || 'No Title'}</div>
                    <div className="text-[15px] text-[var(--st-text-secondary)] line-clamp-2 mt-0.5 leading-snug">{twDesc || 'No description provided.'}</div>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody className="p-4">
                <div className="font-semibold text-sm mb-4 text-[var(--st-text)]">Facebook / LinkedIn Card Preview</div>
                <div className="max-w-[500px] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] hover:opacity-95 cursor-pointer shadow-sm">
                  {ogImage ? (
                    <div className="w-full aspect-[1.91/1] bg-[var(--st-bg-secondary)] relative">
                      <img
                        src={ogImage}
                        alt="Open Graph card preview"
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-[1.91/1] bg-[var(--st-bg-secondary)] flex items-center justify-center text-[var(--st-text-secondary)]">
                      No Image Provided
                    </div>
                  )}
                  <div className="p-3 bg-[var(--st-bg-secondary)] border-t border-[var(--st-border)]">
                    <div className="text-[12px] uppercase text-[var(--st-text-secondary)] mb-1 truncate tracking-wide">{domain}</div>
                    <div className="text-[16px] font-semibold text-[var(--st-text)] truncate mb-1 leading-snug">{ogTitle || 'No Title'}</div>
                    <div className="text-[14px] text-[var(--st-text-secondary)] line-clamp-2 leading-snug">{ogDesc || 'No description provided.'}</div>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
