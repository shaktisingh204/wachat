'use client';

import { useState } from 'react';
import { Webhook, Copy, Check, ShieldCheck, ChevronDown } from 'lucide-react';

import {
  cn,
  Button,
  IconButton,
  Card,
  Field,
  Input,
  Label,
  Switch,
  Badge,
  SegmentedControl,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
} from '@/components/sabcrm/20ui';

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

const METHOD_ITEMS = METHODS.map((m) => ({ value: m, label: m }));

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
        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-accent)]/10 text-[var(--st-accent)]">
          <Webhook className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--st-text)]">Webhook Trigger</p>
          <p className="text-[11px] text-[var(--st-text-secondary)]">Receives incoming HTTP requests</p>
        </div>
      </div>

      {/* Webhook URL display */}
      <div className="space-y-1.5">
        <Label>Webhook URL</Label>
        <div className="flex items-center gap-1 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2">
          <code className="flex-1 min-w-0 truncate text-[12px] font-mono text-[var(--st-text)]">
            {fullUrl}
          </code>
          <IconButton
            label="Copy URL"
            icon={copied ? Check : Copy}
            size="sm"
            onClick={copyUrl}
          />
        </div>
      </div>

      {/* URL path */}
      <Field label="Path">
        <Input
          type="text"
          value={config.path}
          onChange={(e) => onChange({ ...config, path: e.target.value })}
          placeholder="my-webhook"
        />
      </Field>

      {/* HTTP Method */}
      <div className="space-y-1.5">
        <Label>Method</Label>
        <SegmentedControl
          aria-label="HTTP method"
          items={METHOD_ITEMS}
          value={config.method}
          onChange={(m) => onChange({ ...config, method: m as WebhookTriggerMethod })}
        />
      </div>

      {/* Authentication */}
      <div className="space-y-1.5">
        <Button
          variant="ghost"
          block
          onClick={() => setAuthOpen((v) => !v)}
          aria-expanded={authOpen}
          iconLeft={ShieldCheck}
          iconRight={ChevronDown}
          className="justify-start text-[11.5px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]"
        >
          Authentication
        </Button>

        {authOpen && (
          <Card variant="outlined" padding="sm" className="space-y-3">
            {/* Auth type selector */}
            <Field label="Type">
              <Select
                value={config.auth.type}
                onValueChange={(t) => {
                  const type = t as WebhookTriggerAuth['type'];
                  if (type === 'none') setAuth({ type: 'none' });
                  else if (type === 'basic') setAuth({ type: 'basic', username: '', password: '' });
                  else if (type === 'bearer') setAuth({ type: 'bearer', token: '' });
                  else setAuth({ type: 'header', name: '', value: '' });
                }}
              >
                <SelectTrigger aria-label="Authentication type">
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="basic">Basic Auth</SelectItem>
                  <SelectItem value="bearer">Bearer Token</SelectItem>
                  <SelectItem value="header">Custom Header</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {config.auth.type === 'basic' && (
              <>
                <Field label="Username">
                  <Input
                    type="text"
                    value={config.auth.username}
                    onChange={(e) => setAuth({ ...config.auth, username: e.target.value } as WebhookTriggerAuth)}
                    placeholder="username"
                    autoComplete="off"
                  />
                </Field>
                <Field label="Password">
                  <Input
                    type="password"
                    value={config.auth.password}
                    onChange={(e) => setAuth({ ...config.auth, password: e.target.value } as WebhookTriggerAuth)}
                    placeholder="Enter a password"
                    autoComplete="off"
                  />
                </Field>
              </>
            )}

            {config.auth.type === 'bearer' && (
              <Field label="Token">
                <Input
                  type="password"
                  value={config.auth.token}
                  onChange={(e) => setAuth({ type: 'bearer', token: e.target.value })}
                  placeholder="Bearer token"
                  autoComplete="off"
                />
              </Field>
            )}

            {config.auth.type === 'header' && (
              <>
                <Field label="Header Name">
                  <Input
                    type="text"
                    value={config.auth.name}
                    onChange={(e) => setAuth({ ...config.auth, name: e.target.value } as WebhookTriggerAuth)}
                    placeholder="X-Api-Key"
                  />
                </Field>
                <Field label="Header Value">
                  <Input
                    type="password"
                    value={config.auth.value}
                    onChange={(e) => setAuth({ ...config.auth, value: e.target.value } as WebhookTriggerAuth)}
                    placeholder="secret-value"
                    autoComplete="off"
                  />
                </Field>
              </>
            )}
          </Card>
        )}
      </div>

      {/* Respond immediately toggle */}
      <Card
        variant="outlined"
        padding="sm"
        className="flex items-center justify-between gap-3"
      >
        <div>
          <p className="text-[12.5px] font-medium text-[var(--st-text)]">Respond immediately</p>
          <p className="text-[11px] text-[var(--st-text-secondary)]">Return 200 without waiting for the flow to finish</p>
        </div>
        <Switch
          aria-label="Respond immediately"
          checked={config.respondImmediately}
          onCheckedChange={(v) => onChange({ ...config, respondImmediately: v })}
        />
      </Card>

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

type OutputField = { key: string; type: string; description: string };

function OutputSchema({ fields }: { fields: OutputField[] }) {
  return (
    <div className="space-y-1.5">
      <Label>Output</Label>
      <Card variant="outlined" padding="none">
        <Table density="compact" hover={false}>
          <THead>
            <Tr>
              <Th>Field</Th>
              <Th>Type</Th>
              <Th>Description</Th>
            </Tr>
          </THead>
          <TBody>
            {fields.map((f) => (
              <Tr key={f.key}>
                <Td>
                  <code className="text-[11.5px] font-mono font-medium text-[var(--st-accent)]">{f.key}</code>
                </Td>
                <Td>
                  <Badge tone="neutral" kind="soft">{f.type}</Badge>
                </Td>
                <Td truncate>
                  <span className="text-[11px] text-[var(--st-text-secondary)]">{f.description}</span>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
