'use client';

import { useState } from 'react';
import {
  Button,
  IconButton,
  Input,
  Field,
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
} from '@/components/sabcrm/20ui';
import { ToolShell } from '@/components/seo-tools/tool-shell';
import { Plus, Trash2, Link2 } from 'lucide-react';

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
        <Field className="flex-1">
          <Input
            placeholder="https://user:pass@example.com:8080/path?x=1#hash"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
          />
        </Field>
        <Button variant="primary" onClick={run} disabled={!url}>
          Parse
        </Button>
      </div>

      {error && (
        <Alert tone="danger" title="Could not parse URL">
          {error}
        </Alert>
      )}

      {rebuiltUrl && parts && (
        <Card padding="none" className="bg-[var(--st-bg-secondary)]">
          <CardBody className="p-4 flex flex-col gap-2">
            <span className="text-sm font-semibold text-[var(--st-text)]">
              Rebuilt URL
            </span>
            <span className="font-mono text-sm break-all text-[var(--st-text)]">
              {rebuiltUrl}
            </span>
          </CardBody>
        </Card>
      )}

      {parts && (
        <Card padding="none">
          <CardBody className="p-4 flex flex-col gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-[var(--st-text)]">
                URL Parts
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {Object.entries(parts).map(([k, v]) => (
                  <Field key={k} label={<span className="capitalize">{k}</span>}>
                    <Input
                      value={v}
                      onChange={(e) =>
                        updatePart(k as keyof UrlParts, e.target.value)
                      }
                      className="font-mono text-xs"
                    />
                  </Field>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--st-text)]">
                  Query Parameters
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  iconLeft={Plus}
                  onClick={addQueryParam}
                >
                  Add Parameter
                </Button>
              </div>

              {queryParams.length === 0 ? (
                <EmptyState
                  icon={Link2}
                  title="No query parameters"
                  description="Parse a URL with a query string, or add a parameter to start building one."
                  size="sm"
                />
              ) : (
                <div className="border border-[var(--st-border)] rounded-[var(--st-radius)] overflow-hidden">
                  <Table density="compact">
                    <THead>
                      <Tr>
                        <Th>Key</Th>
                        <Th>Value</Th>
                        <Th width={48}>
                          <span className="sr-only">Actions</span>
                        </Th>
                      </Tr>
                    </THead>
                    <TBody>
                      {queryParams.map((param) => (
                        <Tr key={param.id}>
                          <Td>
                            <Field>
                              <Input
                                value={param.key}
                                onChange={(e) =>
                                  updateQueryParam(param.id, 'key', e.target.value)
                                }
                                inputSize="sm"
                                className="font-mono text-xs"
                                placeholder="Key"
                              />
                            </Field>
                          </Td>
                          <Td>
                            <Field>
                              <Input
                                value={param.value}
                                onChange={(e) =>
                                  updateQueryParam(param.id, 'value', e.target.value)
                                }
                                inputSize="sm"
                                className="font-mono text-xs"
                                placeholder="Value"
                              />
                            </Field>
                          </Td>
                          <Td align="center">
                            <IconButton
                              icon={Trash2}
                              label="Remove parameter"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeQueryParam(param.id)}
                            />
                          </Td>
                        </Tr>
                      ))}
                    </TBody>
                  </Table>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}
    </ToolShell>
  );
}
