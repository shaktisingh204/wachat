'use client';

import { useState } from 'react';
import type { Block } from '@/lib/sabflow/types';
import { Plus, Trash2 } from 'lucide-react';
import {
  Field,
  Input,
  Textarea,
  IconButton,
  Button,
  SegmentedControl,
  Callout,
} from '@/components/sabcrm/20ui';
import { VariableInput } from '../VariableInput';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type KVPair = { id: string; key: string; value: string };

type Props = {
  block: Block;
  onUpdate: (changes: Partial<Block>) => void;
  variables?: string[];
};

function makeKV(): KVPair {
  return { id: crypto.randomUUID(), key: '', value: '' };
}

const TABS = [
  { value: 'request', label: 'Request' },
  { value: 'response', label: 'Response' },
] as const;

const METHODS: ReadonlyArray<{ value: HttpMethod; label: HttpMethod }> = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
];

export function WebhookSettings({ block, onUpdate, variables = [] }: Props) {
  const options = block.options ?? {};
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('request');

  const headers: KVPair[] = Array.isArray(options.headers)
    ? (options.headers as KVPair[])
    : [];

  const update = (patch: Record<string, unknown>) =>
    onUpdate({ options: { ...options, ...patch } });

  const updateHeaders = (updated: KVPair[]) => update({ headers: updated });
  const addHeader = () => updateHeaders([...headers, makeKV()]);
  const updateHeader = (id: string, patch: Partial<KVPair>) =>
    updateHeaders(headers.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const removeHeader = (id: string) =>
    updateHeaders(headers.filter((h) => h.id !== id));

  const method = (options.method as HttpMethod) ?? 'POST';
  const showBody = method !== 'GET';

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <SegmentedControl
        items={TABS}
        value={activeTab}
        onChange={(tab) => setActiveTab(tab)}
        fullWidth
        aria-label="Webhook configuration section"
      />

      {activeTab === 'request' && (
        <div className="space-y-4">
          {/* URL */}
          <Field label="URL">
            <VariableInput
              value={String(options.url ?? '')}
              onChange={(url) => update({ url })}
              placeholder="https://api.example.com/endpoint"
              variables={variables}
            />
          </Field>

          {/* Method */}
          <Field label="Method">
            <SegmentedControl
              items={METHODS}
              value={method}
              onChange={(m) => update({ method: m })}
              size="sm"
              aria-label="HTTP method"
            />
          </Field>

          {/* Headers */}
          <Field label="Headers">
            <div className="space-y-2">
              {headers.map((h) => (
                <div key={h.id} className="flex gap-2 items-center">
                  <Input
                    inputSize="sm"
                    value={h.key}
                    onChange={(e) => updateHeader(h.id, { key: e.target.value })}
                    placeholder="Header name"
                    aria-label="Header name"
                    className="flex-1"
                  />
                  <Input
                    inputSize="sm"
                    value={h.value}
                    onChange={(e) => updateHeader(h.id, { value: e.target.value })}
                    placeholder="Value"
                    aria-label="Header value"
                    className="flex-1"
                  />
                  <IconButton
                    label="Remove header"
                    icon={Trash2}
                    size="sm"
                    onClick={() => removeHeader(h.id)}
                  />
                </div>
              ))}
              <Button variant="outline" size="sm" block iconLeft={Plus} onClick={addHeader}>
                Add header
              </Button>
            </div>
          </Field>

          {/* Body */}
          {showBody && (
            <Field
              label="Body (JSON)"
              help="Use {{variable}} to insert dynamic values."
            >
              <Textarea
                value={String(options.body ?? '{}')}
                onChange={(e) => update({ body: e.target.value })}
                placeholder={'{\n  "key": "{{value}}"\n}'}
                rows={6}
                className="font-mono resize-y min-h-[100px]"
              />
            </Field>
          )}
        </div>
      )}

      {activeTab === 'response' && (
        <div className="space-y-4">
          <Field label="Save full response to">
            <VariableInput
              value={String(options.responseVariable ?? '')}
              onChange={(responseVariable) => update({ responseVariable })}
              placeholder="{{httpResponse}}"
              variables={variables}
            />
          </Field>

          <Field label="Save status code to">
            <VariableInput
              value={String(options.statusCodeVariable ?? '')}
              onChange={(statusCodeVariable) => update({ statusCodeVariable })}
              placeholder="{{statusCode}}"
              variables={variables}
            />
          </Field>

          <Callout tone="info">
            The full JSON response body is saved to the variable above. Access
            nested values using dot notation in subsequent blocks.
          </Callout>
        </div>
      )}
    </div>
  );
}
