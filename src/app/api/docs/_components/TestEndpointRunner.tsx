'use client';

/**
 * Live endpoint test runner embedded on every per-endpoint docs page.
 *
 * Lets the user paste a SabNode API key (saved to localStorage so they
 * don't have to retype it across endpoints) and fire a real request
 * against `/api/v1/<path>` from their browser. The request fills in
 * `[pathParam]` segments from the path-params form, appends query
 * params if any, and (for body methods) sends the JSON pasted into the
 * body editor.
 *
 * Browser-side fetch, so the user's API key never touches the server
 * (other than the API call itself). The fetch is same-origin — relies
 * on the docs being served from the same host as the API. For
 * cross-origin deployments, point `baseUrl` somewhere else.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Textarea,
  Label,
} from '@/components/sabcrm/20ui/compat';

interface ParamSpec {
  name: string;
  type: string;
  description?: string;
  required?: boolean;
}

interface Props {
  method: string;
  /** OpenAPI-style path, e.g. `/contacts/{id}`. */
  path: string;
  pathParams: ParamSpec[];
  queryParams: ParamSpec[];
  hasBody: boolean;
}

interface RunResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  parsedBody: unknown;
  elapsedMs: number;
}

const KEY_STORAGE = 'sabnode.apiKey';
const BASE_STORAGE = 'sabnode.apiBaseUrl';
const DEFAULT_BASE = '/api/v1';

export function TestEndpointRunner({
  method,
  path,
  pathParams,
  queryParams,
  hasBody,
}: Props): JSX.Element {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE);
  const [pathValues, setPathValues] = useState<Record<string, string>>({});
  const [queryValues, setQueryValues] = useState<Record<string, string>>({});
  const [body, setBody] = useState('{}');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* Persist API key + base URL across pages. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedKey = localStorage.getItem(KEY_STORAGE);
    if (savedKey) setApiKey(savedKey);
    const savedBase = localStorage.getItem(BASE_STORAGE);
    if (savedBase) setBaseUrl(savedBase);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (apiKey) localStorage.setItem(KEY_STORAGE, apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (baseUrl) localStorage.setItem(BASE_STORAGE, baseUrl);
  }, [baseUrl]);

  const builtUrl = useMemo(() => {
    let p = path;
    for (const param of pathParams) {
      const v = pathValues[param.name];
      p = p.replace(`{${param.name}}`, v ? encodeURIComponent(v) : `{${param.name}}`);
    }
    const qs = new URLSearchParams();
    for (const q of queryParams) {
      const v = queryValues[q.name];
      if (v && v.length) qs.set(q.name, v);
    }
    const suffix = qs.toString();
    return `${baseUrl.replace(/\/$/, '')}${p}${suffix ? `?${suffix}` : ''}`;
  }, [baseUrl, path, pathParams, pathValues, queryParams, queryValues]);

  const allPathParamsFilled = pathParams.every((p) => (pathValues[p.name] ?? '').length > 0);

  const run = async (): Promise<void> => {
    setError(null);
    setResult(null);

    if (!apiKey) {
      setError('Paste an API key first.');
      return;
    }
    if (!allPathParamsFilled) {
      setError('Fill in all path parameters.');
      return;
    }

    let bodyJson: string | undefined;
    if (hasBody) {
      const trimmed = body.trim();
      if (trimmed) {
        try {
          JSON.parse(trimmed);
          bodyJson = trimmed;
        } catch {
          setError('Body is not valid JSON.');
          return;
        }
      }
    }

    setBusy(true);
    const started = performance.now();
    try {
      const res = await fetch(builtUrl, {
        method,
        headers: {
          authorization: `Bearer ${apiKey}`,
          ...(hasBody ? { 'content-type': 'application/json' } : {}),
          accept: 'application/json',
        },
        body: bodyJson,
      });
      const elapsedMs = Math.round(performance.now() - started);
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        headers[k] = v;
      });
      setResult({
        status: res.status,
        statusText: res.statusText,
        headers,
        body: text,
        parsedBody: parsed,
        elapsedMs,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <Input
          type="password"
          placeholder="Paste your SabNode API key…"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="font-mono text-sm"
        />
        <Input
          type="text"
          placeholder="Base URL"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className="font-mono text-sm"
        />
      </div>

      {pathParams.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-zoru-ink-muted mb-1.5">Path parameters</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {pathParams.map((p) => (
              <div key={p.name} className="space-y-1">
                <Label className="text-xs font-normal text-zoru-ink-muted">
                  <span className="font-mono text-zoru-ink-muted">{p.name}</span>
                  {p.description ? <span className="ml-1">— {p.description}</span> : null}
                </Label>
                <Input
                  value={pathValues[p.name] ?? ''}
                  onChange={(e) => setPathValues({ ...pathValues, [p.name]: e.target.value })}
                  className="font-mono text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {queryParams.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-zoru-ink-muted mb-1.5">Query parameters</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {queryParams.map((q) => (
              <div key={q.name} className="space-y-1">
                <Label className="text-xs font-normal text-zoru-ink-muted">
                  <span className="font-mono text-zoru-ink-muted">{q.name}</span>
                  {q.required ? <span className="ml-1 text-zoru-danger">*</span> : null}
                  {q.description ? <span className="ml-1">— {q.description}</span> : null}
                </Label>
                <Input
                  value={queryValues[q.name] ?? ''}
                  onChange={(e) => setQueryValues({ ...queryValues, [q.name]: e.target.value })}
                  className="font-mono text-sm"
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {hasBody ? (
        <div>
          <p className="text-xs font-medium text-zoru-ink-muted mb-1.5">JSON body</p>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="font-mono text-xs"
            spellCheck={false}
          />
        </div>
      ) : null}

      <div className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2 text-xs font-mono text-zoru-ink break-all">
        <span className="text-zoru-ink-muted">{method}</span>{' '}
        <span>{builtUrl}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button onClick={run} disabled={busy}>
          {busy ? 'Sending…' : 'Send request'}
        </Button>
        {error ? <span className="text-xs text-zoru-danger">{error}</span> : null}
      </div>

      {result ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={
                result.status >= 500
                  ? 'text-zoru-danger'
                  : result.status >= 400
                    ? 'text-zoru-warning'
                    : result.status >= 300
                      ? 'text-zoru-ink-muted'
                      : 'text-zoru-success'
              }
            >
              <strong>{result.status}</strong> {result.statusText}
            </span>
            <span className="text-zoru-ink-subtle">· {result.elapsedMs} ms</span>
          </div>

          <details className="border border-zoru-line rounded-[var(--zoru-radius)]">
            <summary className="cursor-pointer px-3 py-1.5 text-xs text-zoru-ink bg-zoru-surface">
              Response headers ({Object.keys(result.headers).length})
            </summary>
            <pre className="px-3 py-2 text-[11px] text-zoru-ink m-0 overflow-x-auto">
{Object.entries(result.headers)
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n')}
            </pre>
          </details>

          <details open className="border border-zoru-line rounded-[var(--zoru-radius)]">
            <summary className="cursor-pointer px-3 py-1.5 text-xs text-zoru-ink bg-zoru-surface">
              Response body
            </summary>
            <pre className="px-3 py-2 text-[11px] text-zoru-ink m-0 overflow-x-auto max-h-96">
{typeof result.parsedBody === 'object' && result.parsedBody !== null
  ? JSON.stringify(result.parsedBody, null, 2)
  : result.body}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
