'use client';

import {
  Button,
  Input,
  Card,
  CardBody,
  Badge,
  Table,
  TBody,
  Tr,
  Td,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import React, { useState } from 'react';
import { ArrowRightIcon, AlertCircle } from 'lucide-react';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';

const USER_AGENTS = [
  { label: 'Default Server', value: 'default' },
  { label: 'Googlebot Desktop', value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { label: 'Googlebot Smartphone', value: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.97 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { label: 'Bingbot', value: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' },
  { label: 'Custom...', value: 'custom' },
];

/** Map an HTTP status code to a meaningful Badge tone (color carries meaning). */
function statusTone(status: number): BadgeTone {
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'info';
  if (status >= 400 && status < 500) return 'warning';
  if (status >= 500) return 'danger';
  return 'neutral';
}

class ErrorBoundary extends React.Component<{children: React.ReactNode, title?: string, onReset?: () => void}, {hasError: boolean, error?: Error}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('HTTP Headers ErrorBoundary:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <Card className="mt-4">
          <CardBody className="flex flex-col items-center justify-center gap-4 py-2">
            <AlertCircle className="h-8 w-8 text-[var(--st-danger)]" aria-hidden="true" />
            <div className="text-center font-semibold text-[var(--st-text)]">{this.props.title || 'Something went wrong rendering the results.'}</div>
            <p className="max-w-md break-all text-center text-sm text-[var(--st-text-secondary)]">{this.state.error?.message}</p>
            <Button variant="primary" onClick={() => {
              this.setState({ hasError: false });
              this.props.onReset?.();
            }}>Try again</Button>
          </CardBody>
        </Card>
      );
    }
    return this.props.children;
  }
}

const FetchErrorThrower = ({ error }: { error: string }) => {
  if (error) {
    throw new Error(error);
  }
  return null;
};

export default function HttpHeadersPage() {
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [userAgentType, setUserAgentType] = useState('default');
  const [customUserAgent, setCustomUserAgent] = useState('');

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const run = async () => {
    if (!url) {
      setError('Please enter a valid URL.');
      return;
    }
    setLoading(true); setError(''); setData(null);
    try {
      let finalUserAgent = userAgentType === 'default' ? '' : userAgentType;
      if (userAgentType === 'custom') {
        finalUserAgent = customUserAgent;
      }

      const r = await apiFetchUrl(url, {
        method,
        userAgent: finalUserAgent || undefined
      });
      if (r.error) setError(r.error);
      else setData(r);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while fetching the URL.');
    } finally { setLoading(false); }
  };

  return (
    <ToolShell title="HTTP Headers Checker" description="View HTTP response headers for any URL, check redirect chains, and verify server responses.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="min-w-[200px] flex-1"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            aria-label="URL to check"
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />

          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-[100px]" aria-label="HTTP method">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="HEAD">HEAD</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
            </SelectContent>
          </Select>

          <Select value={userAgentType} onValueChange={setUserAgentType}>
            <SelectTrigger className="w-[200px]" aria-label="User-Agent">
              <SelectValue placeholder="User-Agent" />
            </SelectTrigger>
            <SelectContent>
              {USER_AGENTS.map((ua) => (
                <SelectItem key={ua.value} value={ua.value}>{ua.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="primary" onClick={run} loading={loading}>
            {loading ? 'Checking' : 'Check'}
          </Button>
        </div>

        {userAgentType === 'custom' && (
          <Input
            value={customUserAgent}
            onChange={(e) => setCustomUserAgent(e.target.value)}
            placeholder="Enter custom User-Agent string..."
            aria-label="Custom User-Agent string"
          />
        )}
      </div>

      {(error || data) && (
        <ErrorBoundary
          title={error ? "HTTP Request Failed" : "Something went wrong rendering the results."}
          onReset={() => { setError(''); setData(null); }}
        >
          {error && <FetchErrorThrower error={error} />}
          {data && (
            <div className="mt-4 flex flex-col gap-4">

            {data.redirectChain && data.redirectChain.length > 1 && (
              <Card>
                <CardBody>
                  <h3 className="mb-3 font-semibold text-[var(--st-text)]">Redirect Trace</h3>
                  <div className="flex flex-col gap-3">
                    {data.redirectChain.map((step: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 text-sm">
                        <div className="mt-0.5 flex min-w-[50px] flex-col items-center gap-1">
                          <Badge tone={statusTone(step.status)}>{step.status}</Badge>
                          {idx < data.redirectChain.length - 1 && (
                            <ArrowRightIcon className="h-4 w-4 rotate-90 text-[var(--st-text-secondary)]" aria-hidden="true" />
                          )}
                        </div>
                        <div className="flex flex-col break-all pt-0.5">
                          <span className="font-mono font-medium text-[var(--st-text)]">{step.url}</span>
                          {step.location && (
                            <span className="mt-1 text-xs text-[var(--st-text-secondary)]">&#8627; {step.location}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            )}

            <Card>
              <CardBody>
                <div className="mb-4 flex items-center gap-2">
                  <span className="font-semibold text-[var(--st-text)]">Final Status:</span>
                  <Badge tone={statusTone(data.status)}>{data.status}</Badge>
                </div>

                <h3 className="mb-3 font-semibold text-[var(--st-text)]">Response Headers</h3>
                <div className="overflow-x-auto">
                  <Table density="compact" className="w-full text-left text-xs">
                    <TBody>
                      {Object.entries(data.headers || {}).map(([k, v]) => (
                        <Tr key={k}>
                          <Td className="w-48 pr-4 align-top font-mono text-[var(--st-text-secondary)] sm:w-60">{k}</Td>
                          <Td className="break-all font-mono text-[var(--st-text)]">{String(v)}</Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                </div>
              </CardBody>
            </Card>
            </div>
          )}
        </ErrorBoundary>
      )}
    </ToolShell>
  );
}
