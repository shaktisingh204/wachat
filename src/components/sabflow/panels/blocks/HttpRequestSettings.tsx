'use client';

import { useCallback, useState } from 'react';
import {
  LuWebhook,
  LuPlus,
  LuTrash2,
  LuPlay,
  LuChevronDown,
} from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, selectClass, Divider } from './shared/primitives';
import { VariableSelect } from './shared/VariableSelect';
import { VariableAutocompleteInput } from './shared/VariableAutocompleteInput';

/* ── Types ───────────────────────────────────────────────────────────────── */

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface KeyValuePair {
  id: string;
  key: string;
  value: string;
}

interface ResponseMapping {
  id: string;
  jsonPath: string;
  variableId?: string;
}

interface HttpRequestOptions {
  method?: HttpMethod;
  url?: string;
  headers?: KeyValuePair[];
  body?: string;
  responseMappings?: ResponseMapping[];
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-emerald-400',
  POST: 'text-blue-400',
  PUT: 'text-amber-400',
  DELETE: 'text-red-400',
  PATCH: 'text-purple-400',
};

const BODY_METHODS: HttpMethod[] = ['POST', 'PUT', 'PATCH'];

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ── Main component ──────────────────────────────────────────────────────── */

export function HttpRequestSettings({ block, onBlockChange, variables = [] }: Props) {
  const opts = (block.options ?? {}) as HttpRequestOptions;
  const method: HttpMethod = opts.method ?? 'GET';
  const url = opts.url ?? '';
  const headers: KeyValuePair[] = opts.headers ?? [];
  const body = opts.body ?? '';
  const responseMappings: ResponseMapping[] = opts.responseMappings ?? [];

  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [responseOpen, setResponseOpen] = useState(false);

  const update = useCallback(
    (patch: Partial<HttpRequestOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  /* ── Headers ─────────────────────────────────────────────────────── */
  const addHeader = () =>
    update({ headers: [...headers, { id: uid(), key: '', value: '' }] });

  const updateHeader = (id: string, field: 'key' | 'value', val: string) =>
    update({
      headers: headers.map((h) => (h.id === id ? { ...h, [field]: val } : h)),
    });

  const removeHeader = (id: string) =>
    update({ headers: headers.filter((h) => h.id !== id) });

  /* ── Response mappings ───────────────────────────────────────────── */
  const addMapping = () =>
    update({
      responseMappings: [
        ...responseMappings,
        { id: uid(), jsonPath: '', variableId: undefined },
      ],
    });

  const updateMapping = (
    id: string,
    field: keyof Omit<ResponseMapping, 'id'>,
    val: string | undefined,
  ) =>
    update({
      responseMappings: responseMappings.map((m) =>
        m.id === id ? { ...m, [field]: val } : m,
      ),
    });

  const removeMapping = (id: string) =>
    update({ responseMappings: responseMappings.filter((m) => m.id !== id) });

  /* ── Test ─────────────────────────────────────────────────────────── */
  const handleTest = async () => {
    if (!url) return;
    setIsTesting(true);
    setTestResponse(null);
    try {
      const headersObj: Record<string, string> = {};
      headers.forEach(({ key, value }) => {
        if (key) headersObj[key] = value;
      });
      const fetchOpts: RequestInit = { method, headers: headersObj };
      if (BODY_METHODS.includes(method) && body) {
        fetchOpts.body = body;
        headersObj['Content-Type'] ??= 'application/json';
      }
      const res = await fetch(url, fetchOpts);
      const text = await res.text();
      let pretty: string;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        pretty = text;
      }
      setTestResponse(`${res.status} ${res.statusText}\n\n${pretty}`);
    } catch (err) {
      setTestResponse(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsTesting(false);
    }
  };

  const showBody = BODY_METHODS.includes(method);

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuWebhook} title="HTTP Request" />

      {/* Method + URL */}
      <div className="flex gap-2">
        <select
          value={method}
          onChange={(e) => update({ method: e.target.value as HttpMethod })}
          className={`${selectClass} w-[108px] shrink-0 font-mono font-semibold ${METHOD_COLORS[method]}`}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div className="flex-1">
          <VariableAutocompleteInput
            value={url}
            onChange={(v) => update({ url: v })}
            variables={variables}
            placeholder="https://api.example.com/endpoint"
            aria-label="Request URL"
          />
        </div>
      </div>

      <Divider />

      {/* Headers */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
            Headers
          </span>
          <button
            type="button"
            onClick={addHeader}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#f76808] hover:bg-[#f7680814] transition-colors"
          >
            <LuPlus className="h-3 w-3" strokeWidth={2.5} />
            Add
          </button>
        </div>
        {headers.length === 0 && (
          <p className="text-[11px] text-[var(--gray-8)] italic">No headers yet.</p>
        )}
        {headers.map((h) => (
          <div key={h.id} className="flex gap-1.5 items-center">
            <input
              type="text"
              value={h.key}
              onChange={(e) => updateHeader(h.id, 'key', e.target.value)}
              placeholder="Key"
              className={`${inputClass} flex-1`}
            />
            <div className="flex-1">
              <VariableAutocompleteInput
                value={h.value}
                onChange={(v) => updateHeader(h.id, 'value', v)}
                variables={variables}
                placeholder="Value or {{variable}}"
                aria-label="Header value"
              />
            </div>
            <button
              type="button"
              onClick={() => removeHeader(h.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--gray-8)] hover:bg-[var(--gray-4)] hover:text-red-400 transition-colors"
              aria-label="Remove header"
            >
              <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          </div>
        ))}
      </div>

      {/* Body (collapsible, only for POST/PUT/PATCH) */}
      {showBody && (
        <>
          <Divider />
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setBodyOpen((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <span className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
                Body (JSON)
              </span>
              <LuChevronDown
                className={`h-3.5 w-3.5 text-[var(--gray-9)] transition-transform ${bodyOpen ? 'rotate-180' : ''}`}
                strokeWidth={2}
              />
            </button>
            {bodyOpen && (
              <VariableAutocompleteInput
                type="textarea"
                value={body}
                onChange={(v) => update({ body: v })}
                variables={variables}
                placeholder={'{\n  "key": "{{variable}}"\n}'}
                rows={6}
                spellCheck={false}
                aria-label="Request body"
                className="font-mono text-[12px] min-h-[120px]"
              />
            )}
          </div>
        </>
      )}

      <Divider />

      {/* Response mapping */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setResponseOpen((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <span className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
            Response mapping
          </span>
          <LuChevronDown
            className={`h-3.5 w-3.5 text-[var(--gray-9)] transition-transform ${responseOpen ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        </button>
        {responseOpen && (
          <div className="space-y-2">
            <p className="text-[11px] text-[var(--gray-8)]">
              Map JSON response fields (dot notation) to variables.
            </p>
            {responseMappings.map((m) => (
              <div key={m.id} className="flex gap-1.5 items-center">
                <input
                  type="text"
                  value={m.jsonPath}
                  onChange={(e) => updateMapping(m.id, 'jsonPath', e.target.value)}
                  placeholder="data.name"
                  className={`${inputClass} flex-1 font-mono text-[12px]`}
                />
                <span className="shrink-0 text-[var(--gray-8)] text-[11px]">→</span>
                <div className="flex-1">
                  <VariableSelect
                    variables={variables}
                    value={m.variableId}
                    onChange={(id) => updateMapping(m.id, 'variableId', id)}
                    placeholder="— select variable —"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeMapping(m.id)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--gray-8)] hover:bg-[var(--gray-4)] hover:text-red-400 transition-colors"
                  aria-label="Remove mapping"
                >
                  <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addMapping}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-[#f76808] hover:bg-[#f7680814] transition-colors"
            >
              <LuPlus className="h-3 w-3" strokeWidth={2.5} />
              Add mapping
            </button>
          </div>
        )}
      </div>

      <Divider />

      {/* Test button */}
      <button
        type="button"
        onClick={handleTest}
        disabled={!url || isTesting}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#f76808] px-3 py-2 text-[12px] font-medium text-[#f76808] hover:bg-[#f7680814] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <LuPlay className="h-3.5 w-3.5" strokeWidth={2} />
        {isTesting ? 'Testing…' : 'Test request'}
      </button>

      {testResponse !== null && (
        <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3 space-y-1">
          <p className="text-[10.5px] font-medium text-[var(--gray-9)] uppercase tracking-wide">
            Response
          </p>
          <pre className="text-[11px] text-[var(--gray-11)] font-mono whitespace-pre-wrap break-all max-h-[240px] overflow-y-auto">
            {testResponse}
          </pre>
        </div>
      )}
    </div>
  );
}
