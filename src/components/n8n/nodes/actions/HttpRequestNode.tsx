'use client';

import { useState } from 'react';
import { LuGlobe, LuPlus, LuX, LuChevronDown, LuLock } from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ── Types ───────────────────────────────────────────────── */

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
export type BodyFormat = 'json' | 'form-data' | 'form-urlencoded' | 'raw' | 'none';
export type AuthMode = 'none' | 'basic' | 'bearer' | 'api-key' | 'oauth2';

export interface KeyValuePair {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface HttpRequestAuth {
  mode: AuthMode;
  basic?: { username: string; password: string };
  bearer?: { token: string };
  apiKey?: { name: string; value: string; in: 'header' | 'query' };
}

export interface HttpRequestNodeConfig {
  method: HttpMethod;
  url: string;
  headers: KeyValuePair[];
  queryParams: KeyValuePair[];
  bodyFormat: BodyFormat;
  /** Raw JSON string or form fields depending on bodyFormat */
  body: string;
  formFields: KeyValuePair[];
  auth: HttpRequestAuth;
  /** Variable name to store the response into, e.g. "httpResponse" */
  outputVariable: string;
  /** Follow redirects */
  followRedirects: boolean;
  /** Timeout in ms */
  timeoutMs: number;
}

export interface HttpRequestOutput {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
  responseTime: number;
}

export type HttpRequestNodeProps = {
  config: HttpRequestNodeConfig;
  onChange: (config: HttpRequestNodeConfig) => void;
  className?: string;
};

/* ── Helpers ─────────────────────────────────────────────── */

type ActiveTab = 'params' | 'headers' | 'body' | 'auth' | 'settings';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const BODY_FORMATS: BodyFormat[] = ['json', 'form-data', 'form-urlencoded', 'raw', 'none'];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:     'text-emerald-600 bg-emerald-50',
  POST:    'text-blue-600 bg-blue-50',
  PUT:     'text-amber-600 bg-amber-50',
  PATCH:   'text-orange-600 bg-orange-50',
  DELETE:  'text-red-600 bg-red-50',
  HEAD:    'text-purple-600 bg-purple-50',
  OPTIONS: 'text-gray-600 bg-gray-100',
};

let _idCounter = 0;
export function makeKv(key = '', value = ''): KeyValuePair {
  return { id: `kv-${++_idCounter}`, key, value, enabled: true };
}

/* ── Component ───────────────────────────────────────────── */

export function HttpRequestNode({ config, onChange, className }: HttpRequestNodeProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('params');

  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'params',   label: 'Params' },
    { id: 'headers',  label: 'Headers' },
    { id: 'body',     label: 'Body' },
    { id: 'auth',     label: 'Auth' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ec4899]/10 text-[#ec4899]">
          <LuGlobe className="h-4 w-4" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--gray-12)]">HTTP Request</p>
          <p className="text-[11px] text-[var(--gray-9)]">Make an HTTP/HTTPS request</p>
        </div>
      </div>

      {/* Method + URL */}
      <div className="flex gap-2">
        <select
          className={cn(
            'rounded-lg border border-[var(--gray-5)] px-2.5 py-2 text-[12.5px] font-semibold outline-none focus:border-[#f76808] transition-colors shrink-0',
            METHOD_COLORS[config.method],
          )}
          value={config.method}
          onChange={(e) => onChange({ ...config, method: e.target.value as HttpMethod })}
        >
          {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <input
          type="url"
          className={cn(INPUT_CLS, 'flex-1')}
          value={config.url}
          onChange={(e) => onChange({ ...config, url: e.target.value })}
          placeholder="https://api.example.com/v1/resource"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 overflow-x-auto rounded-lg bg-[var(--gray-3)] p-1 scrollbar-none">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'shrink-0 rounded-md px-3 py-1.5 text-[11.5px] font-medium transition-colors',
              activeTab === t.id
                ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'params' && (
        <KvEditor
          label="Query Parameters"
          pairs={config.queryParams}
          onChange={(queryParams) => onChange({ ...config, queryParams })}
          keyPlaceholder="param"
          valuePlaceholder="value or {{variable}}"
        />
      )}

      {activeTab === 'headers' && (
        <KvEditor
          label="Request Headers"
          pairs={config.headers}
          onChange={(headers) => onChange({ ...config, headers })}
          keyPlaceholder="Content-Type"
          valuePlaceholder="application/json"
        />
      )}

      {activeTab === 'body' && (
        <BodyEditor config={config} onChange={onChange} />
      )}

      {activeTab === 'auth' && (
        <AuthEditor config={config} onChange={onChange} />
      )}

      {activeTab === 'settings' && (
        <SettingsEditor config={config} onChange={onChange} />
      )}

      {/* Output */}
      <div className="space-y-1.5">
        <Label>Save Response to Variable</Label>
        <input
          type="text"
          className={INPUT_CLS}
          value={config.outputVariable}
          onChange={(e) => onChange({ ...config, outputVariable: e.target.value })}
          placeholder="{{httpResponse}}"
        />
      </div>

      <OutputSchema
        accent="#ec4899"
        fields={[
          { key: 'statusCode',   type: 'number',  description: 'HTTP response status code' },
          { key: 'body',         type: 'unknown', description: 'Parsed response body' },
          { key: 'headers',      type: 'object',  description: 'Response headers' },
          { key: 'responseTime', type: 'number',  description: 'Round-trip time in ms' },
        ]}
      />
    </div>
  );
}

/* ── KV editor ───────────────────────────────────────────── */

function KvEditor({
  label,
  pairs,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  label: string;
  pairs: KeyValuePair[];
  onChange: (pairs: KeyValuePair[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const update = (id: string, field: keyof KeyValuePair, value: string | boolean) =>
    onChange(pairs.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const remove = (id: string) => onChange(pairs.filter((p) => p.id !== id));
  const add = () => onChange([...pairs, makeKv()]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {pairs.map((pair) => (
        <div key={pair.id} className="flex items-center gap-1.5">
          {/* Enabled toggle */}
          <button
            type="button"
            onClick={() => update(pair.id, 'enabled', !pair.enabled)}
            className={cn(
              'h-3.5 w-3.5 rounded border-2 flex shrink-0 items-center justify-center transition-colors',
              pair.enabled ? 'border-[#f76808] bg-[#f76808]' : 'border-[var(--gray-5)]',
            )}
          >
            {pair.enabled && (
              <svg viewBox="0 0 10 10" className="h-2 w-2 fill-none stroke-white" strokeWidth="1.8" strokeLinecap="round">
                <path d="M1.5 5L4 7.5L8.5 2" />
              </svg>
            )}
          </button>
          <input
            type="text"
            className={cn(INPUT_CLS, 'flex-1', !pair.enabled && 'opacity-50')}
            value={pair.key}
            onChange={(e) => update(pair.id, 'key', e.target.value)}
            placeholder={keyPlaceholder}
          />
          <input
            type="text"
            className={cn(INPUT_CLS, 'flex-1', !pair.enabled && 'opacity-50')}
            value={pair.value}
            onChange={(e) => update(pair.id, 'value', e.target.value)}
            placeholder={valuePlaceholder}
          />
          <button
            type="button"
            onClick={() => remove(pair.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--gray-8)] hover:text-red-500 transition-colors"
          >
            <LuX className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-[12px] font-medium text-[#f76808] hover:text-[#e25c00] transition-colors"
      >
        <LuPlus className="h-3.5 w-3.5" strokeWidth={2} />
        Add {label.split(' ')[0].toLowerCase()}
      </button>
    </div>
  );
}

/* ── Body editor ─────────────────────────────────────────── */

function BodyEditor({ config, onChange }: Pick<HttpRequestNodeProps, 'config' | 'onChange'>) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Body Format</Label>
        <div className="flex flex-wrap gap-1">
          {BODY_FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onChange({ ...config, bodyFormat: f })}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-colors',
                config.bodyFormat === f
                  ? 'border-[#f76808]/40 bg-[#f76808]/10 text-[#f76808]'
                  : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-9)] hover:border-[var(--gray-6)]',
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {(config.bodyFormat === 'json' || config.bodyFormat === 'raw') && (
        <div className="space-y-1.5">
          <Label>{config.bodyFormat === 'json' ? 'JSON Body' : 'Raw Body'}</Label>
          <textarea
            className={cn(INPUT_CLS, 'min-h-[120px] font-mono text-[12px] resize-y')}
            value={config.body}
            onChange={(e) => onChange({ ...config, body: e.target.value })}
            placeholder={config.bodyFormat === 'json' ? '{\n  "key": "{{variable}}"\n}' : 'Raw request body'}
            spellCheck={false}
          />
        </div>
      )}

      {(config.bodyFormat === 'form-data' || config.bodyFormat === 'form-urlencoded') && (
        <KvEditor
          label="Form Fields"
          pairs={config.formFields}
          onChange={(formFields) => onChange({ ...config, formFields })}
          keyPlaceholder="field_name"
          valuePlaceholder="value or {{variable}}"
        />
      )}

      {config.bodyFormat === 'none' && (
        <p className="text-center text-[12px] text-[var(--gray-9)] italic">No body will be sent</p>
      )}
    </div>
  );
}

/* ── Auth editor ─────────────────────────────────────────── */

function AuthEditor({ config, onChange }: Pick<HttpRequestNodeProps, 'config' | 'onChange'>) {
  const { auth } = config;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>
          <span className="flex items-center gap-1.5">
            <LuLock className="h-3.5 w-3.5" strokeWidth={2} />
            Authentication Mode
          </span>
        </Label>
        <select
          className={INPUT_CLS}
          value={auth.mode}
          onChange={(e) => {
            const mode = e.target.value as AuthMode;
            onChange({ ...config, auth: { mode } });
          }}
        >
          <option value="none">None</option>
          <option value="basic">Basic Auth</option>
          <option value="bearer">Bearer Token</option>
          <option value="api-key">API Key</option>
        </select>
      </div>

      {auth.mode === 'basic' && (
        <>
          <div className="space-y-1.5">
            <Label>Username</Label>
            <input
              type="text"
              className={INPUT_CLS}
              value={auth.basic?.username ?? ''}
              onChange={(e) => onChange({ ...config, auth: { ...auth, basic: { username: e.target.value, password: auth.basic?.password ?? '' } } })}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Password</Label>
            <input
              type="password"
              className={INPUT_CLS}
              value={auth.basic?.password ?? ''}
              onChange={(e) => onChange({ ...config, auth: { ...auth, basic: { username: auth.basic?.username ?? '', password: e.target.value } } })}
              autoComplete="off"
            />
          </div>
        </>
      )}

      {auth.mode === 'bearer' && (
        <div className="space-y-1.5">
          <Label>Bearer Token</Label>
          <input
            type="password"
            className={INPUT_CLS}
            value={auth.bearer?.token ?? ''}
            onChange={(e) => onChange({ ...config, auth: { ...auth, bearer: { token: e.target.value } } })}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp…"
            autoComplete="off"
          />
        </div>
      )}

      {auth.mode === 'api-key' && (
        <>
          <div className="space-y-1.5">
            <Label>Key Name</Label>
            <input
              type="text"
              className={INPUT_CLS}
              value={auth.apiKey?.name ?? ''}
              onChange={(e) => onChange({ ...config, auth: { ...auth, apiKey: { name: e.target.value, value: auth.apiKey?.value ?? '', in: auth.apiKey?.in ?? 'header' } } })}
              placeholder="X-Api-Key"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Key Value</Label>
            <input
              type="password"
              className={INPUT_CLS}
              value={auth.apiKey?.value ?? ''}
              onChange={(e) => onChange({ ...config, auth: { ...auth, apiKey: { name: auth.apiKey?.name ?? '', value: e.target.value, in: auth.apiKey?.in ?? 'header' } } })}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Send In</Label>
            <select
              className={INPUT_CLS}
              value={auth.apiKey?.in ?? 'header'}
              onChange={(e) => onChange({ ...config, auth: { ...auth, apiKey: { name: auth.apiKey?.name ?? '', value: auth.apiKey?.value ?? '', in: e.target.value as 'header' | 'query' } } })}
            >
              <option value="header">Header</option>
              <option value="query">Query Parameter</option>
            </select>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Settings editor ─────────────────────────────────────── */

function SettingsEditor({ config, onChange }: Pick<HttpRequestNodeProps, 'config' | 'onChange'>) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label>Timeout (ms)</Label>
        <input
          type="number"
          min={100}
          max={300_000}
          step={100}
          className={INPUT_CLS}
          value={config.timeoutMs}
          onChange={(e) => onChange({ ...config, timeoutMs: Number(e.target.value) })}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2.5">
        <div>
          <p className="text-[12.5px] font-medium text-[var(--gray-12)]">Follow Redirects</p>
          <p className="text-[11px] text-[var(--gray-9)]">Automatically follow 3xx responses</p>
        </div>
        <Toggle
          checked={config.followRedirects}
          onChange={(v) => onChange({ ...config, followRedirects: v })}
        />
      </div>
    </div>
  );
}

/* ── Shared primitives ───────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
      {children}
    </label>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 rounded-full transition-colors focus-visible:outline-none',
        checked ? 'bg-[#f76808]' : 'bg-[var(--gray-5)]',
      )}
    >
      <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-4' : 'translate-x-0.5')} />
    </button>
  );
}

type OutputField = { key: string; type: string; description: string };

function OutputSchema({ accent, fields }: { accent: string; fields: OutputField[] }) {
  return (
    <div className="space-y-1.5">
      <Label>Output</Label>
      <div className="rounded-lg border border-dashed border-[var(--gray-5)] bg-[var(--gray-2)] divide-y divide-[var(--gray-4)]">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-2 px-3 py-1.5">
            <code className="min-w-[90px] text-[11.5px] font-mono font-medium" style={{ color: accent }}>{f.key}</code>
            <span className="rounded bg-[var(--gray-4)] px-1 py-0.5 text-[10px] font-mono text-[var(--gray-9)]">{f.type}</span>
            <span className="flex-1 text-[11px] text-[var(--gray-9)] truncate">{f.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';
