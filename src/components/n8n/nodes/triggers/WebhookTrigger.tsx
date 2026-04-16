'use client';

import { useState } from 'react';
import { LuWebhook, LuCopy, LuCheck, LuShieldCheck, LuChevronDown } from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ── Types ──────────────────────────────────────────────── */

export type WebhookTriggerMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ANY';

export type WebhookTriggerAuth =
  | { type: 'none' }
  | { type: 'basic'; username: string; password: string }
  | { type: 'bearer'; token: string }
  | { type: 'header'; name: string; value: string };

export interface WebhookTriggerConfig {
  /** Path segment appended to the base webhook URL, e.g. "my-hook" */
  path: string;
  method: WebhookTriggerMethod;
  auth: WebhookTriggerAuth;
  /** Whether to respond immediately with a 200 or wait for the flow to finish */
  respondImmediately: boolean;
}

/** Shape of the data this trigger emits to the next node */
export interface WebhookTriggerOutput {
  body: Record<string, unknown>;
  headers: Record<string, string>;
  query: Record<string, string>;
  method: string;
  path: string;
}

export type WebhookTriggerProps = {
  config: WebhookTriggerConfig;
  /** Base URL shown to the user (e.g. "https://app.sabnode.com/api/webhooks") */
  baseUrl?: string;
  onChange: (config: WebhookTriggerConfig) => void;
  className?: string;
};

/* ── Helpers ─────────────────────────────────────────────── */

const METHODS: WebhookTriggerMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'ANY'];

const METHOD_COLORS: Record<WebhookTriggerMethod, string> = {
  GET:    'text-emerald-600 bg-emerald-50 border-emerald-200',
  POST:   'text-blue-600 bg-blue-50 border-blue-200',
  PUT:    'text-amber-600 bg-amber-50 border-amber-200',
  PATCH:  'text-orange-600 bg-orange-50 border-orange-200',
  DELETE: 'text-red-600 bg-red-50 border-red-200',
  ANY:    'text-purple-600 bg-purple-50 border-purple-200',
};

/* ── Component ───────────────────────────────────────────── */

export function WebhookTrigger({ config, baseUrl = '', onChange, className }: WebhookTriggerProps) {
  const [copied, setCopied] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const fullUrl = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/${config.path.replace(/^\//, '')}`
    : `/${config.path}`;

  const copyUrl = async () => {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setAuth = (auth: WebhookTriggerAuth) => onChange({ ...config, auth });

  return (
    <div className={cn('space-y-4', className)}>
      {/* Node header chip */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6366f1]/10 text-[#6366f1]">
          <LuWebhook className="h-4 w-4" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--gray-12)]">Webhook Trigger</p>
          <p className="text-[11px] text-[var(--gray-9)]">Receives incoming HTTP requests</p>
        </div>
      </div>

      {/* Webhook URL display */}
      <div className="space-y-1.5">
        <Label>Webhook URL</Label>
        <div className="flex items-center gap-1 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2">
          <code className="flex-1 min-w-0 truncate text-[12px] font-mono text-[var(--gray-11)]">
            {fullUrl}
          </code>
          <button
            type="button"
            onClick={copyUrl}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--gray-9)] hover:text-[var(--gray-12)] transition-colors"
            title="Copy URL"
          >
            {copied
              ? <LuCheck className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2} />
              : <LuCopy className="h-3.5 w-3.5" strokeWidth={2} />
            }
          </button>
        </div>
      </div>

      {/* URL path */}
      <div className="space-y-1.5">
        <Label>Path</Label>
        <input
          type="text"
          className={INPUT_CLS}
          value={config.path}
          onChange={(e) => onChange({ ...config, path: e.target.value })}
          placeholder="my-webhook"
        />
      </div>

      {/* HTTP Method */}
      <div className="space-y-1.5">
        <Label>Method</Label>
        <div className="flex flex-wrap gap-1.5">
          {METHODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...config, method: m })}
              className={cn(
                'rounded-md border px-2.5 py-1 text-[11.5px] font-semibold transition-colors',
                config.method === m
                  ? METHOD_COLORS[m]
                  : 'border-[var(--gray-4)] bg-[var(--gray-2)] text-[var(--gray-9)] hover:border-[var(--gray-6)]',
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Authentication */}
      <div className="space-y-1.5">
        <button
          type="button"
          onClick={() => setAuthOpen((v) => !v)}
          className="flex w-full items-center gap-2 text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide"
        >
          <LuShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
          Authentication
          <LuChevronDown
            className={cn(
              'ml-auto h-3.5 w-3.5 transition-transform',
              authOpen ? 'rotate-180' : '',
            )}
            strokeWidth={2}
          />
        </button>

        {authOpen && (
          <div className="space-y-3 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3">
            {/* Auth type selector */}
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select
                className={INPUT_CLS}
                value={config.auth.type}
                onChange={(e) => {
                  const t = e.target.value as WebhookTriggerAuth['type'];
                  if (t === 'none') setAuth({ type: 'none' });
                  else if (t === 'basic') setAuth({ type: 'basic', username: '', password: '' });
                  else if (t === 'bearer') setAuth({ type: 'bearer', token: '' });
                  else setAuth({ type: 'header', name: '', value: '' });
                }}
              >
                <option value="none">None</option>
                <option value="basic">Basic Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="header">Custom Header</option>
              </select>
            </div>

            {config.auth.type === 'basic' && (
              <>
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <input
                    type="text"
                    className={INPUT_CLS}
                    value={config.auth.username}
                    onChange={(e) => setAuth({ ...config.auth, username: e.target.value } as WebhookTriggerAuth)}
                    placeholder="username"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Password</Label>
                  <input
                    type="password"
                    className={INPUT_CLS}
                    value={config.auth.password}
                    onChange={(e) => setAuth({ ...config.auth, password: e.target.value } as WebhookTriggerAuth)}
                    placeholder="••••••••"
                    autoComplete="off"
                  />
                </div>
              </>
            )}

            {config.auth.type === 'bearer' && (
              <div className="space-y-1.5">
                <Label>Token</Label>
                <input
                  type="password"
                  className={INPUT_CLS}
                  value={config.auth.token}
                  onChange={(e) => setAuth({ type: 'bearer', token: e.target.value })}
                  placeholder="Bearer token"
                  autoComplete="off"
                />
              </div>
            )}

            {config.auth.type === 'header' && (
              <>
                <div className="space-y-1.5">
                  <Label>Header Name</Label>
                  <input
                    type="text"
                    className={INPUT_CLS}
                    value={config.auth.name}
                    onChange={(e) => setAuth({ ...config.auth, name: e.target.value } as WebhookTriggerAuth)}
                    placeholder="X-Api-Key"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Header Value</Label>
                  <input
                    type="password"
                    className={INPUT_CLS}
                    value={config.auth.value}
                    onChange={(e) => setAuth({ ...config.auth, value: e.target.value } as WebhookTriggerAuth)}
                    placeholder="secret-value"
                    autoComplete="off"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Respond immediately toggle */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2.5">
        <div>
          <p className="text-[12.5px] font-medium text-[var(--gray-12)]">Respond immediately</p>
          <p className="text-[11px] text-[var(--gray-9)]">Return 200 without waiting for the flow to finish</p>
        </div>
        <Toggle
          checked={config.respondImmediately}
          onChange={(v) => onChange({ ...config, respondImmediately: v })}
        />
      </div>

      {/* Output schema preview */}
      <OutputSchema
        fields={[
          { key: 'body', type: 'object', description: 'Parsed request body' },
          { key: 'headers', type: 'object', description: 'Request headers map' },
          { key: 'query', type: 'object', description: 'URL query parameters' },
          { key: 'method', type: 'string', description: 'HTTP method used' },
          { key: 'path', type: 'string', description: 'Request path' },
        ]}
      />
    </div>
  );
}

/* ── Shared sub-components (internal) ───────────────────── */

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
        'relative h-5 w-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f76808]',
        checked ? 'bg-[#f76808]' : 'bg-[var(--gray-5)]',
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

type OutputField = { key: string; type: string; description: string };

function OutputSchema({ fields }: { fields: OutputField[] }) {
  return (
    <div className="space-y-1.5">
      <Label>Output</Label>
      <div className="rounded-lg border border-dashed border-[var(--gray-5)] bg-[var(--gray-2)] divide-y divide-[var(--gray-4)]">
        {fields.map((f) => (
          <div key={f.key} className="flex items-center gap-2 px-3 py-1.5">
            <code className="min-w-[80px] text-[11.5px] font-mono font-medium text-[#6366f1]">{f.key}</code>
            <span className="rounded bg-[var(--gray-4)] px-1 py-0.5 text-[10px] font-mono text-[var(--gray-9)]">{f.type}</span>
            <span className="flex-1 text-[11px] text-[var(--gray-9)] truncate">{f.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Shared class strings ────────────────────────────────── */

const INPUT_CLS =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-3)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';
