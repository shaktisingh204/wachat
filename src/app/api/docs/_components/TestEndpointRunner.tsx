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
    <div className="rounded-md border border-zinc-800 bg-zinc-950 p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <input
          type="password"
          placeholder="Paste your SabNode API key…"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 font-mono placeholder-zinc-500"
        />
        <input
          type="text"
          placeholder="Base URL"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-sm text-zinc-100 font-mono placeholder-zinc-500"
        />
      </div>

      {pathParams.length > 0 ? (
        <div>
          <div className="text-xs text-zinc-400 mb-1">Path parameters</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {pathParams.map((p) => (
              <label key={p.name} className="text-xs text-zinc-400">
                <span className="font-mono text-amber-300">{p.name}</span>
                {p.description ? <span className="ml-1 text-zinc-500">— {p.description}</span> : null}
                <input
                  value={pathValues[p.name] ?? ''}
                  onChange={(e) => setPathValues({ ...pathValues, [p.name]: e.target.value })}
                  className="mt-1 block w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm font-mono text-zinc-100"
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {queryParams.length > 0 ? (
        <div>
          <div className="text-xs text-zinc-400 mb-1">Query parameters</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {queryParams.map((q) => (
              <label key={q.name} className="text-xs text-zinc-400">
                <span className="font-mono text-amber-300">{q.name}</span>
                {q.required ? <span className="ml-1 text-red-300">*</span> : null}
                {q.description ? <span className="ml-1 text-zinc-500">— {q.description}</span> : null}
                <input
                  value={queryValues[q.name] ?? ''}
                  onChange={(e) => setQueryValues({ ...queryValues, [q.name]: e.target.value })}
                  className="mt-1 block w-full bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 text-sm font-mono text-zinc-100"
                />
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {hasBody ? (
        <div>
          <div className="text-xs text-zinc-400 mb-1">JSON body</div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            className="block w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 font-mono"
            spellCheck={false}
          />
        </div>
      ) : null}

      <div className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs font-mono text-zinc-300 break-all">
        <span className="text-amber-300">{method}</span>{' '}
        <span>{builtUrl}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="bg-amber-500 hover:bg-amber-400 text-zinc-900 font-semibold rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Send request'}
        </button>
        {error ? <span className="text-xs text-red-400">{error}</span> : null}
      </div>

      {result ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={
                result.status >= 500
                  ? 'text-red-400'
                  : result.status >= 400
                    ? 'text-amber-300'
                    : result.status >= 300
                      ? 'text-blue-300'
                      : 'text-green-400'
              }
            >
              <strong>{result.status}</strong> {result.statusText}
            </span>
            <span className="text-zinc-500">· {result.elapsedMs} ms</span>
          </div>

          <details className="border border-zinc-800 rounded">
            <summary className="cursor-pointer px-3 py-1.5 text-xs text-zinc-300 bg-zinc-900/50">
              Response headers ({Object.keys(result.headers).length})
            </summary>
            <pre className="px-3 py-2 text-[11px] text-zinc-300 m-0 overflow-x-auto">
{Object.entries(result.headers)
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n')}
            </pre>
          </details>

          <details open className="border border-zinc-800 rounded">
            <summary className="cursor-pointer px-3 py-1.5 text-xs text-zinc-300 bg-zinc-900/50">
              Response body
            </summary>
            <pre className="px-3 py-2 text-[11px] text-zinc-100 m-0 overflow-x-auto max-h-96">
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
