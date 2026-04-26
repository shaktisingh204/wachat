'use client';

import { useCallback, useState } from 'react';
import { createId } from '@paralleldrive/cuid2';
import {
  LuWebhook,
  LuPlus,
  LuTrash2,
  LuPlay,
  LuLoader,
  LuChevronDown,
  LuChevronRight,
  LuToggleLeft,
  LuToggleRight,
} from 'react-icons/lu';
import { cn } from '@/lib/utils';
import type { Block, Variable, WebhookOptions, KVPair, WebhookBody } from '@/lib/sabflow/types';
import { Field, PanelHeader, inputClass, selectClass, Divider } from './shared/primitives';
import { VariableSelect } from './shared/VariableSelect';

/* ══════════════════════════════════════════════════════════
   Constants
   ══════════════════════════════════════════════════════════ */

type HttpMethod = NonNullable<WebhookOptions['method']>;
type BodyType = WebhookBody['type'];
type ActiveTab = 'headers' | 'params' | 'body' | 'response';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const BODY_METHODS: HttpMethod[] = ['POST', 'PUT', 'PATCH'];
const BODY_TYPES: { value: BodyType; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'form-data', label: 'Form Data' },
  { value: 'raw', label: 'Raw' },
];

const METHOD_BADGE: Record<HttpMethod, string> = {
  GET:    'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  POST:   'border-blue-500/40   bg-blue-500/10   text-blue-400',
  PUT:    'border-amber-500/40  bg-amber-500/10  text-amber-400',
  PATCH:  'border-purple-500/40 bg-purple-500/10 text-purple-400',
  DELETE: 'border-red-500/40    bg-red-500/10    text-red-400',
};

/* ══════════════════════════════════════════════════════════
   Props
   ══════════════════════════════════════════════════════════ */

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ══════════════════════════════════════════════════════════
   Sub-components
   ══════════════════════════════════════════════════════════ */

/** Reusable key-value list editor */
function KVList({
  rows,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value or {{variable}}',
  emptyLabel = 'No rows yet.',
  addLabel = 'Add row',
  onChange,
}: {
  rows: KVPair[];
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  emptyLabel?: string;
  addLabel?: string;
  onChange: (rows: KVPair[]) => void;
}) {
  const add = () => onChange([...rows, { id: createId(), key: '', value: '' }]);
  const remove = (id: string) => onChange(rows.filter((r) => r.id !== id));
  const patch = (id: string, field: 'key' | 'value', val: string) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)));

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-[11px] text-[var(--gray-8)] italic">{emptyLabel}</p>
      )}
      {rows.map((r) => (
        <div key={r.id} className="flex gap-1.5 items-center">
          <input
            type="text"
            value={r.key}
            onChange={(e) => patch(r.id, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            className={cn(inputClass, 'flex-1 text-[12px]')}
          />
          <input
            type="text"
            value={r.value}
            onChange={(e) => patch(r.id, 'value', e.target.value)}
            placeholder={valuePlaceholder}
            className={cn(inputClass, 'flex-1 text-[12px]')}
          />
          <button
            type="button"
            onClick={() => remove(r.id)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--gray-8)] hover:bg-[var(--gray-4)] hover:text-red-400 transition-colors"
            aria-label="Remove row"
          >
            <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--gray-6)] px-3 py-1.5 w-full justify-center text-[12px] text-[var(--gray-9)] hover:text-[var(--gray-12)] hover:border-[var(--gray-8)] hover:bg-[var(--gray-2)] transition-colors"
      >
        <LuPlus className="h-3.5 w-3.5" strokeWidth={2} />
        {addLabel}
      </button>
    </div>
  );
}

/** Inline toggle switch */
function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  const Icon = checked ? LuToggleRight : LuToggleLeft;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-[12px] text-[var(--gray-11)] hover:text-[var(--gray-12)] transition-colors"
    >
      <Icon
        className={cn(
          'h-5 w-5 transition-colors',
          checked ? 'text-[#f76808]' : 'text-[var(--gray-7)]',
        )}
        strokeWidth={1.8}
      />
      {label}
    </button>
  );
}

/* ══════════════════════════════════════════════════════════
   Test-response status badge
   ══════════════════════════════════════════════════════════ */

function statusColor(code: number): string {
  if (code >= 500) return 'text-red-400';
  if (code >= 400) return 'text-amber-400';
  if (code >= 300) return 'text-blue-400';
  return 'text-emerald-400';
}

/* ══════════════════════════════════════════════════════════
   Main component
   ══════════════════════════════════════════════════════════ */

export function HttpRequestSettings({ block, onBlockChange, variables = [] }: Props) {
  /* ── Derive options ───────────────────────────────── */
  const opts = (block.options ?? {}) as WebhookOptions;

  const method: HttpMethod = opts.method ?? 'GET';
  const url: string = opts.url ?? '';
  const headers: KVPair[] = opts.headers ?? [];
  const queryParams: KVPair[] = opts.queryParams ?? [];
  const body: WebhookBody =
    typeof opts.body === 'string'
      ? { type: 'json', content: opts.body }
      : opts.body ?? { type: 'json', content: '' };
  const responseMappings = opts.responseMappings ?? [];
  const timeout: number = opts.timeout ?? 30000;
  const saveFullResponse: boolean = opts.saveFullResponseToVariable ?? false;
  const fullResponseVarId: string | undefined = opts.fullResponseVariableId;
  const statusCodeVarId: string | undefined = opts.statusCodeVariableId;

  /* ── Local UI state ───────────────────────────────── */
  const [activeTab, setActiveTab] = useState<ActiveTab>('headers');
  const [testResult, setTestResult] = useState<{
    status: number;
    statusText: string;
    body: string;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testExpanded, setTestExpanded] = useState(true);

  /* ── Patch helper ─────────────────────────────────── */
  const update = useCallback(
    (patch: Partial<WebhookOptions>) => {
      onBlockChange({ ...block, options: { ...opts, ...patch } });
    },
    [block, opts, onBlockChange],
  );

  /* ── Body helpers ─────────────────────────────────── */
  const updateBody = useCallback(
    (patch: Partial<WebhookBody>) => {
      update({ body: { ...body, ...patch } });
    },
    [body, update],
  );

  /* ── Test request ─────────────────────────────────── */
  const handleTest = useCallback(async () => {
    if (!url) return;
    setIsTesting(true);
    setTestResult(null);
    setTestError(null);
    setTestExpanded(true);

    try {
      const headersObj: Record<string, string> = {};
      headers.forEach(({ key, value }) => {
        if (key.trim()) headersObj[key.trim()] = value;
      });

      // Build query string
      const queryParts = queryParams
        .filter((p) => p.key.trim())
        .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`);
      const finalUrl =
        queryParts.length > 0
          ? `${url}${url.includes('?') ? '&' : '?'}${queryParts.join('&')}`
          : url;

      const fetchInit: RequestInit = {
        method,
        headers: headersObj,
        signal: AbortSignal.timeout(timeout),
      };

      if (BODY_METHODS.includes(method)) {
        if (body.type === 'json' && body.content) {
          headersObj['Content-Type'] ??= 'application/json';
          fetchInit.body = body.content;
        } else if (body.type === 'raw' && body.content) {
          fetchInit.body = body.content;
        } else if (body.type === 'form-data' && body.formData) {
          const fd = new FormData();
          body.formData.forEach(({ key, value }) => {
            if (key.trim()) fd.append(key.trim(), value);
          });
          fetchInit.body = fd;
        }
      }

      const res = await fetch(finalUrl, fetchInit);
      const text = await res.text();
      let pretty: string;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        pretty = text;
      }
      setTestResult({ status: res.status, statusText: res.statusText, body: pretty });
    } catch (err) {
      setTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsTesting(false);
    }
  }, [url, method, headers, queryParams, body, timeout]);

  /* ── Tab config ───────────────────────────────────── */
  const tabs: { id: ActiveTab; label: string; count?: number }[] = [
    { id: 'headers',  label: 'Headers',  count: headers.length      || undefined },
    { id: 'params',   label: 'Params',   count: queryParams.length  || undefined },
    { id: 'body',     label: 'Body',     count: BODY_METHODS.includes(method) ? undefined : undefined },
    { id: 'response', label: 'Response' },
  ];

  const showBody = BODY_METHODS.includes(method);

  /* ── Render ───────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Header */}
      <PanelHeader icon={LuWebhook} title="HTTP Request" />

      {/* Method + URL row */}
      <div className="flex gap-2 items-center">
        {/* Method picker — pill buttons */}
        <div className="flex gap-1 shrink-0 flex-wrap">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => update({ method: m })}
              className={cn(
                'rounded border px-2 py-1 text-[10.5px] font-mono font-semibold transition-colors',
                method === m
                  ? METHOD_BADGE[m]
                  : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-8)] hover:text-[var(--gray-11)]',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* URL input */}
      <Field label="URL">
        <input
          type="url"
          value={url}
          onChange={(e) => update({ url: e.target.value })}
          placeholder="https://api.example.com/endpoint"
          className={inputClass}
          spellCheck={false}
        />
      </Field>

      <Divider />

      {/* Tab strip */}
      <div
        role="tablist"
        className="flex gap-0.5 rounded-lg bg-[var(--gray-3)] p-1"
      >
        {tabs.map((t) => {
          const isDisabled = t.id === 'body' && !showBody;
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={activeTab === t.id}
              disabled={isDisabled}
              onClick={() => !isDisabled && setActiveTab(t.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 rounded-md py-1.5 text-[11.5px] font-medium transition-colors',
                activeTab === t.id && !isDisabled
                  ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                  : isDisabled
                    ? 'text-[var(--gray-6)] cursor-not-allowed'
                    : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="rounded-full bg-[#f76808] px-1.5 py-px text-[9px] font-semibold text-white leading-none">
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Headers tab ─────────────────────────────── */}
      {activeTab === 'headers' && (
        <KVList
          rows={headers}
          keyPlaceholder="Header name"
          valuePlaceholder="Value or {{variable}}"
          emptyLabel="No headers yet."
          addLabel="Add header"
          onChange={(rows) => update({ headers: rows })}
        />
      )}

      {/* ── Query Params tab ─────────────────────────── */}
      {activeTab === 'params' && (
        <KVList
          rows={queryParams}
          keyPlaceholder="Param name"
          valuePlaceholder="Value or {{variable}}"
          emptyLabel="No query params yet."
          addLabel="Add param"
          onChange={(rows) => update({ queryParams: rows })}
        />
      )}

      {/* ── Body tab ──────────────────────────────────── */}
      {activeTab === 'body' && showBody && (
        <div className="space-y-3">
          {/* Body type selector */}
          <Field label="Encoding">
            <div className="flex gap-1">
              {BODY_TYPES.map((bt) => (
                <button
                  key={bt.value}
                  type="button"
                  onClick={() => updateBody({ type: bt.value })}
                  className={cn(
                    'flex-1 rounded-md border py-1.5 text-[11.5px] font-medium transition-colors',
                    body.type === bt.value
                      ? 'border-[#f76808] bg-[#f7680814] text-[#f76808]'
                      : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-9)] hover:text-[var(--gray-12)]',
                  )}
                >
                  {bt.label}
                </button>
              ))}
            </div>
          </Field>

          {/* JSON body */}
          {body.type === 'json' && (
            <Field label="Body">
              <textarea
                value={body.content ?? ''}
                onChange={(e) => updateBody({ content: e.target.value })}
                placeholder={'{\n  "key": "{{variable}}"\n}'}
                rows={8}
                spellCheck={false}
                className={cn(inputClass, 'font-mono text-[12px] resize-y min-h-[120px]')}
              />
              <p className="mt-1 text-[11px] text-[var(--gray-8)]">
                Use{' '}
                <code className="rounded bg-[var(--gray-3)] px-1 font-mono text-[#f76808]">
                  {'{{variable}}'}
                </code>{' '}
                to inject flow variables.
              </p>
            </Field>
          )}

          {/* Form-data body */}
          {body.type === 'form-data' && (
            <KVList
              rows={body.formData ?? []}
              keyPlaceholder="Field name"
              valuePlaceholder="Value or {{variable}}"
              emptyLabel="No form fields yet."
              addLabel="Add field"
              onChange={(rows) => updateBody({ formData: rows })}
            />
          )}

          {/* Raw body */}
          {body.type === 'raw' && (
            <Field label="Body">
              <textarea
                value={body.content ?? ''}
                onChange={(e) => updateBody({ content: e.target.value })}
                placeholder="Raw request body…"
                rows={8}
                spellCheck={false}
                className={cn(inputClass, 'font-mono text-[12px] resize-y min-h-[120px]')}
              />
            </Field>
          )}
        </div>
      )}

      {/* ── Response tab ─────────────────────────────── */}
      {activeTab === 'response' && (
        <div className="space-y-4">
          {/* Save full response toggle */}
          <div className="flex items-center justify-between">
            <Toggle
              checked={saveFullResponse}
              onChange={(v) => update({ saveFullResponseToVariable: v })}
              label="Save full response to variable"
            />
          </div>

          {saveFullResponse && (
            <Field label="Response variable">
              <VariableSelect
                variables={variables}
                value={fullResponseVarId}
                onChange={(id) => update({ fullResponseVariableId: id })}
                placeholder="— select variable —"
              />
            </Field>
          )}

          <Field label="Save status code to">
            <VariableSelect
              variables={variables}
              value={statusCodeVarId}
              onChange={(id) => update({ statusCodeVariableId: id })}
              placeholder="— select variable —"
            />
          </Field>

          <Divider />

          {/* JSON path mappings */}
          <div className="space-y-2">
            <span className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide block">
              JSON Path Mappings
            </span>
            <p className="text-[11px] text-[var(--gray-8)]">
              Extract values from the response using JSONPath expressions (e.g.{' '}
              <code className="rounded bg-[var(--gray-3)] px-1 font-mono text-[#f76808]">
                $.data.user.name
              </code>
              ).
            </p>

            {responseMappings.length === 0 && (
              <p className="text-[11px] text-[var(--gray-8)] italic">No mappings yet.</p>
            )}

            {responseMappings.map((m) => (
              <div key={m.id} className="flex gap-1.5 items-center">
                <input
                  type="text"
                  value={m.jsonPath}
                  onChange={(e) =>
                    update({
                      responseMappings: responseMappings.map((x) =>
                        x.id === m.id ? { ...x, jsonPath: e.target.value } : x,
                      ),
                    })
                  }
                  placeholder="$.path.to.value"
                  className={cn(inputClass, 'flex-1 font-mono text-[12px]')}
                />
                <span className="shrink-0 text-[11px] text-[var(--gray-7)]">→</span>
                <div className="flex-1">
                  <VariableSelect
                    variables={variables}
                    value={m.variableId}
                    onChange={(id) =>
                      update({
                        responseMappings: responseMappings.map((x) =>
                          x.id === m.id ? { ...x, variableId: id } : x,
                        ),
                      })
                    }
                    placeholder="— select variable —"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    update({
                      responseMappings: responseMappings.filter((x) => x.id !== m.id),
                    })
                  }
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-[var(--gray-8)] hover:bg-[var(--gray-4)] hover:text-red-400 transition-colors"
                  aria-label="Remove mapping"
                >
                  <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                update({
                  responseMappings: [
                    ...responseMappings,
                    { id: createId(), jsonPath: '', variableId: undefined },
                  ],
                })
              }
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--gray-6)] px-3 py-1.5 w-full justify-center text-[12px] text-[var(--gray-9)] hover:text-[var(--gray-12)] hover:border-[var(--gray-8)] hover:bg-[var(--gray-2)] transition-colors"
            >
              <LuPlus className="h-3.5 w-3.5" strokeWidth={2} />
              Add mapping
            </button>
          </div>

          <Divider />

          {/* Timeout */}
          <Field label="Timeout (ms)">
            <input
              type="number"
              value={timeout}
              min={500}
              max={120000}
              step={500}
              onChange={(e) => update({ timeout: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
        </div>
      )}

      <Divider />

      {/* Test button */}
      <button
        type="button"
        onClick={handleTest}
        disabled={!url.trim() || isTesting}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#f76808] px-3 py-2 text-[12px] font-medium text-[#f76808] hover:bg-[#f7680814] disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
      >
        {isTesting ? (
          <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <LuPlay className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {isTesting ? 'Sending…' : 'Send test request'}
      </button>

      {/* Test result panel */}
      {(testResult !== null || testError !== null) && (
        <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] overflow-hidden">
          {/* Result header */}
          <button
            type="button"
            onClick={() => setTestExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 hover:bg-[var(--gray-3)] transition-colors"
          >
            <div className="flex items-center gap-2">
              {testResult !== null ? (
                <>
                  <span
                    className={cn(
                      'text-[11px] font-semibold font-mono',
                      statusColor(testResult.status),
                    )}
                  >
                    {testResult.status}
                  </span>
                  <span className="text-[11px] text-[var(--gray-9)]">
                    {testResult.statusText}
                  </span>
                </>
              ) : (
                <span className="text-[11px] text-red-400 font-medium">Error</span>
              )}
            </div>
            {testExpanded ? (
              <LuChevronDown className="h-3.5 w-3.5 text-[var(--gray-8)]" strokeWidth={2} />
            ) : (
              <LuChevronRight className="h-3.5 w-3.5 text-[var(--gray-8)]" strokeWidth={2} />
            )}
          </button>

          {/* Body */}
          {testExpanded && (
            <div className="border-t border-[var(--gray-4)] p-3">
              <pre className="max-h-[280px] overflow-y-auto whitespace-pre-wrap break-all font-mono text-[11px] text-[var(--gray-11)]">
                {testResult !== null ? testResult.body : testError}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
