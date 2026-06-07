'use client';

import { useState } from 'react';
import { Globe, Plus, X, Lock } from 'lucide-react';
import {
  Field,
  Input,
  Textarea,
  Button,
  IconButton,
  Checkbox,
  Switch,
  SegmentedControl,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  cn,
} from '@/components/sabcrm/20ui';

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

const TABS: { value: ActiveTab; label: string }[] = [
  { value: 'params', label: 'Params' },
  { value: 'headers', label: 'Headers' },
  { value: 'body', label: 'Body' },
  { value: 'auth', label: 'Auth' },
  { value: 'settings', label: 'Settings' },
];

let _idCounter = 0;
export function makeKv(key = '', value = ''): KeyValuePair {
  return { id: `kv-${++_idCounter}`, key, value, enabled: true };
}

/* ── Component ───────────────────────────────────────────── */

export function HttpRequestNode({ config, onChange, className }: HttpRequestNodeProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('params');

  return (
    <div className={cn('ui20 space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-muted)] text-[var(--st-text)]">
          <Globe className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--st-text)]">HTTP Request</p>
          <p className="text-[11px] text-[var(--st-text-secondary)]">Make an HTTP/HTTPS request</p>
        </div>
      </div>

      {/* Method + URL */}
      <div className="flex gap-2">
        <div className="w-[112px] shrink-0">
          <Select
            value={config.method}
            onValueChange={(method) => onChange({ ...config, method: method as HttpMethod })}
          >
            <SelectTrigger aria-label="HTTP method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Input
            type="url"
            aria-label="Request URL"
            value={config.url}
            onChange={(e) => onChange({ ...config, url: e.target.value })}
            placeholder="https://api.example.com/v1/resource"
          />
        </div>
      </div>

      {/* Tabs */}
      <SegmentedControl
        aria-label="HTTP request sections"
        fullWidth
        size="sm"
        items={TABS}
        value={activeTab}
        onChange={setActiveTab}
      />

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

      {activeTab === 'body' && <BodyEditor config={config} onChange={onChange} />}

      {activeTab === 'auth' && <AuthEditor config={config} onChange={onChange} />}

      {activeTab === 'settings' && <SettingsEditor config={config} onChange={onChange} />}

      {/* Output */}
      <Field label="Save Response to Variable">
        <Input
          type="text"
          value={config.outputVariable}
          onChange={(e) => onChange({ ...config, outputVariable: e.target.value })}
          placeholder="{{httpResponse}}"
        />
      </Field>

      <OutputSchema
        accent="#ec4899"
        fields={[
          { key: 'statusCode', type: 'number', description: 'HTTP response status code' },
          { key: 'body', type: 'unknown', description: 'Parsed response body' },
          { key: 'headers', type: 'object', description: 'Response headers' },
          { key: 'responseTime', type: 'number', description: 'Round-trip time in ms' },
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

  const noun = label.split(' ')[0].toLowerCase();

  return (
    <div className="space-y-2">
      <SectionLabel>{label}</SectionLabel>
      {pairs.map((pair) => (
        <div key={pair.id} className="flex items-center gap-1.5">
          <Checkbox
            size="sm"
            checked={pair.enabled}
            onChange={(e) => update(pair.id, 'enabled', e.target.checked)}
            aria-label={pair.enabled ? `Disable ${pair.key || noun}` : `Enable ${pair.key || noun}`}
          />
          <div className={cn('flex-1', !pair.enabled && 'opacity-50')}>
            <Input
              type="text"
              aria-label={`${label} key`}
              value={pair.key}
              onChange={(e) => update(pair.id, 'key', e.target.value)}
              placeholder={keyPlaceholder}
            />
          </div>
          <div className={cn('flex-1', !pair.enabled && 'opacity-50')}>
            <Input
              type="text"
              aria-label={`${label} value`}
              value={pair.value}
              onChange={(e) => update(pair.id, 'value', e.target.value)}
              placeholder={valuePlaceholder}
            />
          </div>
          <IconButton
            label={`Remove ${pair.key || noun}`}
            icon={X}
            size="sm"
            onClick={() => remove(pair.id)}
          />
        </div>
      ))}
      <Button variant="ghost" size="sm" iconLeft={Plus} onClick={add}>
        Add {noun}
      </Button>
    </div>
  );
}

/* ── Body editor ─────────────────────────────────────────── */

function BodyEditor({ config, onChange }: Pick<HttpRequestNodeProps, 'config' | 'onChange'>) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <SectionLabel>Body Format</SectionLabel>
        <SegmentedControl
          aria-label="Body format"
          size="sm"
          items={BODY_FORMATS.map((f) => ({ value: f, label: f }))}
          value={config.bodyFormat}
          onChange={(bodyFormat) => onChange({ ...config, bodyFormat })}
        />
      </div>

      {(config.bodyFormat === 'json' || config.bodyFormat === 'raw') && (
        <Field label={config.bodyFormat === 'json' ? 'JSON Body' : 'Raw Body'}>
          <Textarea
            className="min-h-[120px] resize-y font-mono text-[12px]"
            value={config.body}
            onChange={(e) => onChange({ ...config, body: e.target.value })}
            placeholder={config.bodyFormat === 'json' ? '{\n  "key": "{{variable}}"\n}' : 'Raw request body'}
            spellCheck={false}
          />
        </Field>
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
        <p className="text-center text-[12px] italic text-[var(--st-text-secondary)]">
          No body will be sent
        </p>
      )}
    </div>
  );
}

/* ── Auth editor ─────────────────────────────────────────── */

function AuthEditor({ config, onChange }: Pick<HttpRequestNodeProps, 'config' | 'onChange'>) {
  const { auth } = config;

  return (
    <div className="space-y-3">
      <Field
        label={
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
            Authentication Mode
          </span>
        }
      >
        <Select
          value={auth.mode}
          onValueChange={(value) => onChange({ ...config, auth: { mode: value as AuthMode } })}
        >
          <SelectTrigger aria-label="Authentication mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="basic">Basic Auth</SelectItem>
            <SelectItem value="bearer">Bearer Token</SelectItem>
            <SelectItem value="api-key">API Key</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {auth.mode === 'basic' && (
        <>
          <Field label="Username">
            <Input
              type="text"
              value={auth.basic?.username ?? ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  auth: { ...auth, basic: { username: e.target.value, password: auth.basic?.password ?? '' } },
                })
              }
              autoComplete="off"
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={auth.basic?.password ?? ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  auth: { ...auth, basic: { username: auth.basic?.username ?? '', password: e.target.value } },
                })
              }
              autoComplete="off"
            />
          </Field>
        </>
      )}

      {auth.mode === 'bearer' && (
        <Field label="Bearer Token">
          <Input
            type="password"
            value={auth.bearer?.token ?? ''}
            onChange={(e) => onChange({ ...config, auth: { ...auth, bearer: { token: e.target.value } } })}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp..."
            autoComplete="off"
          />
        </Field>
      )}

      {auth.mode === 'api-key' && (
        <>
          <Field label="Key Name">
            <Input
              type="text"
              value={auth.apiKey?.name ?? ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  auth: {
                    ...auth,
                    apiKey: { name: e.target.value, value: auth.apiKey?.value ?? '', in: auth.apiKey?.in ?? 'header' },
                  },
                })
              }
              placeholder="X-Api-Key"
            />
          </Field>
          <Field label="Key Value">
            <Input
              type="password"
              value={auth.apiKey?.value ?? ''}
              onChange={(e) =>
                onChange({
                  ...config,
                  auth: {
                    ...auth,
                    apiKey: { name: auth.apiKey?.name ?? '', value: e.target.value, in: auth.apiKey?.in ?? 'header' },
                  },
                })
              }
              autoComplete="off"
            />
          </Field>
          <Field label="Send In">
            <Select
              value={auth.apiKey?.in ?? 'header'}
              onValueChange={(value) =>
                onChange({
                  ...config,
                  auth: {
                    ...auth,
                    apiKey: {
                      name: auth.apiKey?.name ?? '',
                      value: auth.apiKey?.value ?? '',
                      in: value as 'header' | 'query',
                    },
                  },
                })
              }
            >
              <SelectTrigger aria-label="Send API key in">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="header">Header</SelectItem>
                <SelectItem value="query">Query Parameter</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </>
      )}
    </div>
  );
}

/* ── Settings editor ─────────────────────────────────────── */

function SettingsEditor({ config, onChange }: Pick<HttpRequestNodeProps, 'config' | 'onChange'>) {
  return (
    <div className="space-y-3">
      <Field label="Timeout (ms)">
        <Input
          type="number"
          min={100}
          max={300_000}
          step={100}
          value={config.timeoutMs}
          onChange={(e) => onChange({ ...config, timeoutMs: Number(e.target.value) })}
        />
      </Field>

      <div className="flex items-center justify-between rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2.5">
        <div>
          <p className="text-[12.5px] font-medium text-[var(--st-text)]">Follow Redirects</p>
          <p className="text-[11px] text-[var(--st-text-secondary)]">Automatically follow 3xx responses</p>
        </div>
        <Switch
          checked={config.followRedirects}
          onCheckedChange={(v) => onChange({ ...config, followRedirects: v })}
          aria-label="Follow redirects"
        />
      </div>
    </div>
  );
}

/* ── Shared primitives ───────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-tertiary)]">
      {children}
    </p>
  );
}

type OutputField = { key: string; type: string; description: string };

function OutputSchema({ accent, fields }: { accent: string; fields: OutputField[] }) {
  return (
    <div className="space-y-1.5">
      <SectionLabel>Output</SectionLabel>
      <div className="divide-y divide-[var(--st-border)] rounded-[var(--st-radius)] border border-dashed border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-2 px-3 py-1.5">
            {/* accent is a caller-picked colour, so it stays a runtime style */}
            <code className="min-w-[90px] font-mono text-[11.5px] font-medium" style={{ color: accent }}>
              {f.key}
            </code>
            <span className="rounded-[var(--st-radius-sm)] bg-[var(--st-bg-muted)] px-1 py-0.5 font-mono text-[10px] text-[var(--st-text-secondary)]">
              {f.type}
            </span>
            <span className="flex-1 truncate text-[11px] text-[var(--st-text-secondary)]">
              {f.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
