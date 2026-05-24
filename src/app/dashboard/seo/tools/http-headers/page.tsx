'use client';

import { 
  Button, 
  Input, 
  Card, 
  ZoruCardContent, 
  cn,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '@/components/zoruui';
import React, { useState } from 'react';
import { ArrowRightIcon, AlertCircle } from 'lucide-react';

import { ToolShell } from '@/components/seo-tools/tool-shell';
import { apiFetchUrl } from '@/lib/seo-tools/api-client';

const USER_AGENTS = [
  { label: 'Default Server', value: '' },
  { label: 'Googlebot Desktop', value: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { label: 'Googlebot Smartphone', value: 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.97 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' },
  { label: 'Bingbot', value: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' },
  { label: 'Custom...', value: 'custom' },
];

class ErrorBoundary extends React.Component<{children: React.ReactNode, onReset?: () => void}, {hasError: boolean, error?: Error}> {
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
        <Card className="border-red-500 mt-4">
          <ZoruCardContent className="p-4 flex flex-col items-center justify-center space-y-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <div className="text-red-500 font-semibold text-center">Something went wrong rendering the results!</div>
            <p className="text-sm text-gray-500 text-center max-w-md break-all">{this.state.error?.message}</p>
            <Button onClick={() => {
              this.setState({ hasError: false });
              this.props.onReset?.();
            }}>Try again</Button>
          </ZoruCardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

export default function HttpHeadersPage() {
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('GET');
  const [userAgentType, setUserAgentType] = useState('');
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
      let finalUserAgent = userAgentType;
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
        <div className="flex gap-2 items-center flex-wrap">
          <Input 
            className="flex-1 min-w-[200px]" 
            value={url} 
            onChange={(e) => setUrl(e.target.value)} 
            placeholder="https://example.com" 
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
          
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="HEAD">HEAD</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
            </SelectContent>
          </Select>

          <Select value={userAgentType} onValueChange={setUserAgentType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="User-Agent" />
            </SelectTrigger>
            <SelectContent>
              {USER_AGENTS.map((ua) => (
                <SelectItem key={ua.value} value={ua.value}>{ua.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={run} disabled={loading}>
            {loading ? 'Checking…' : 'Check'}
          </Button>
        </div>

        {userAgentType === 'custom' && (
          <Input 
            value={customUserAgent} 
            onChange={(e) => setCustomUserAgent(e.target.value)} 
            placeholder="Enter custom User-Agent string..." 
          />
        )}
      </div>

      {error && (
        <Card className="border-red-500 mt-4">
          <ZoruCardContent className="p-4 text-red-600 text-sm">
            {error}
          </ZoruCardContent>
        </Card>
      )}

      {data && (
        <ErrorBoundary onReset={() => setData(null)}>
          <div className="mt-4 flex flex-col gap-4">
            
            {data.redirectChain && data.redirectChain.length > 1 && (
              <Card>
                <ZoruCardContent className="p-4">
                  <h3 className="font-semibold mb-3">Redirect Trace</h3>
                  <div className="flex flex-col gap-3">
                    {data.redirectChain.map((step: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 text-sm">
                        <div className="flex flex-col items-center gap-1 min-w-[50px] mt-0.5">
                          <span className={cn("px-2 py-0.5 rounded text-xs font-semibold", 
                            step.status >= 300 && step.status < 400 ? "bg-yellow-100 text-yellow-800" :
                            step.status >= 200 && step.status < 300 ? "bg-green-100 text-green-800" :
                            "bg-red-100 text-red-800"
                          )}>
                            {step.status}
                          </span>
                          {idx < data.redirectChain.length - 1 && (
                            <ArrowRightIcon className="w-4 h-4 text-gray-400 rotate-90" />
                          )}
                        </div>
                        <div className="flex flex-col break-all pt-0.5">
                          <span className="font-mono text-gray-800 font-medium">{step.url}</span>
                          {step.location && (
                            <span className="text-gray-500 text-xs mt-1">↳ {step.location}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ZoruCardContent>
              </Card>
            )}

            <Card>
              <ZoruCardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <span className="font-semibold">Final Status:</span> 
                  <span className={cn("px-2 py-0.5 rounded text-sm font-semibold", 
                    data.status >= 200 && data.status < 300 ? "bg-green-100 text-green-800" :
                    data.status >= 400 ? "bg-red-100 text-red-800" :
                    "bg-gray-100 text-gray-800"
                  )}>
                    {data.status}
                  </span>
                </div>
                
                <h3 className="font-semibold mb-3">Response Headers</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <tbody>
                      {Object.entries(data.headers || {}).map(([k, v]) => (
                        <tr key={k} className="border-t border-gray-100 hover:bg-gray-50/50 transition-colors">
                          <td className="py-2 pr-4 font-mono w-48 sm:w-60 align-top text-gray-600">{k}</td>
                          <td className="py-2 break-all font-mono text-gray-900">{String(v)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ZoruCardContent>
            </Card>
          </div>
        </ErrorBoundary>
      )}
    </ToolShell>
  );
}
