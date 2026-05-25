'use client';

import { Button, Input, Card, ZoruCardContent, cn } from '@/components/zoruui';
import { cn as _zoruCn, useState } from 'react';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Plus, Trash2 } from 'lucide-react';

void _zoruCn;

type UrlParts = {
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  hash: string;
  username: string;
  password: string;
};

type QueryParam = {
  id: number;
  key: string;
  value: string;
};

export default function UrlParserPage() {
  const [url, setUrl] = useState('');
  const [parts, setParts] = useState<UrlParts | null>(null);
  const [queryParams, setQueryParams] = useState<QueryParam[]>([]);
  const [nextId, setNextId] = useState(0);
  const [error, setError] = useState('');
  const [rebuiltUrl, setRebuiltUrl] = useState('');

  const run = () => {
    setError('');
    setParts(null);
    setQueryParams([]);
    setRebuiltUrl('');
    try {
      const u = new URL(url);
      setParts({
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port,
        pathname: u.pathname,
        hash: u.hash,
        username: u.username,
        password: u.password,
      });

      const params = new URLSearchParams(u.search);
      const newQueryParams: QueryParam[] = [];
      let currentId = nextId;
      params.forEach((value, key) => {
        newQueryParams.push({ id: currentId++, key, value });
      });
      setQueryParams(newQueryParams);
      setNextId(currentId);
      setRebuiltUrl(u.href);
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Invalid URL.');
      }
    }
  };

  const rebuildUrl = (
    currentParts: UrlParts | null,
    currentQueryParams: QueryParam[]
  ) => {
    if (!currentParts) return;
    try {
      const u = new URL('http://localhost'); // dummy to start
      
      // Update parts safely
      if (currentParts.protocol) u.protocol = currentParts.protocol;
      if (currentParts.hostname) u.hostname = currentParts.hostname;
      if (currentParts.port) u.port = currentParts.port;
      if (currentParts.pathname) u.pathname = currentParts.pathname;
      if (currentParts.hash) u.hash = currentParts.hash;
      if (currentParts.username) u.username = currentParts.username;
      if (currentParts.password) u.password = currentParts.password;

      // Ensure protocol is valid if they cleared it
      if (!u.protocol) u.protocol = 'http:';
      
      const searchParams = new URLSearchParams();
      currentQueryParams.forEach((p) => {
        if (p.key) searchParams.append(p.key, p.value);
      });
      u.search = searchParams.toString();

      setRebuiltUrl(u.href);
      setUrl(u.href);
      setError('');
    } catch (e: unknown) {
      if (e instanceof Error) {
        setError(`Error rebuilding URL: ${e.message}`);
      } else {
        setError('Unknown error rebuilding URL.');
      }
    }
  };

  const updatePart = (key: keyof UrlParts, value: string) => {
    if (!parts) return;
    const newParts = { ...parts, [key]: value };
    setParts(newParts);
    rebuildUrl(newParts, queryParams);
  };

  const updateQueryParam = (id: number, field: 'key' | 'value', value: string) => {
    const newParams = queryParams.map((p) =>
      p.id === id ? { ...p, [field]: value } : p
    );
    setQueryParams(newParams);
    rebuildUrl(parts, newParams);
  };

  const addQueryParam = () => {
    const newParams = [...queryParams, { id: nextId, key: '', value: '' }];
    setQueryParams(newParams);
    setNextId(nextId + 1);
    rebuildUrl(parts, newParams);
  };

  const removeQueryParam = (id: number) => {
    const newParams = queryParams.filter((p) => p.id !== id);
    setQueryParams(newParams);
    rebuildUrl(parts, newParams);
  };

  return (
    <ToolShell
      title="URL Parser"
      description="Break a URL into its component parts using the WHATWG URL parser, edit them, and rebuild."
    >
      <div className="flex gap-2">
        <Input
          placeholder="https://user:pass@example.com:8080/path?x=1#hash"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
        />
        <Button onClick={run} disabled={!url}>
          Parse
        </Button>
      </div>

      {error && (
        <Card className="border-red-500/50">
          <ZoruCardContent className="p-4 text-sm text-red-500">
            {error}
          </ZoruCardContent>
        </Card>
      )}

      {rebuiltUrl && parts && (
        <Card className="bg-primary/5">
          <ZoruCardContent className="p-4 flex flex-col gap-2">
            <span className="text-sm font-semibold">Rebuilt URL</span>
            <span className="font-mono text-sm break-all">{rebuiltUrl}</span>
          </ZoruCardContent>
        </Card>
      )}

      {parts && (
        <Card>
          <ZoruCardContent className="p-4 flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">URL Parts</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {Object.entries(parts).map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-1.5">
                    <label className="font-semibold capitalize text-muted-foreground">
                      {k}
                    </label>
                    <Input
                      value={v}
                      onChange={(e) =>
                        updatePart(k as keyof UrlParts, e.target.value)
                      }
                      className="font-mono text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Query Parameters</h3>
                <Button size="sm" variant="outline" onClick={addQueryParam}>
                  <Plus className="w-4 h-4 mr-1" /> Add Parameter
                </Button>
              </div>

              {queryParams.length === 0 ? (
                <div className="text-sm text-muted-foreground italic border rounded p-4 text-center">
                  No query parameters.
                </div>
              ) : (
                <div className="border rounded overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-2 text-left font-semibold">Key</th>
                        <th className="p-2 text-left font-semibold">Value</th>
                        <th className="p-2 w-12"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {queryParams.map((param) => (
                        <tr key={param.id} className="border-t">
                          <td className="p-2">
                            <Input
                              value={param.key}
                              onChange={(e) =>
                                updateQueryParam(param.id, 'key', e.target.value)
                              }
                              className="font-mono text-xs h-8"
                              placeholder="Key"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={param.value}
                              onChange={(e) =>
                                updateQueryParam(param.id, 'value', e.target.value)
                              }
                              className="font-mono text-xs h-8"
                              placeholder="Value"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => removeQueryParam(param.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </ZoruCardContent>
        </Card>
      )}
    </ToolShell>
  );
}
