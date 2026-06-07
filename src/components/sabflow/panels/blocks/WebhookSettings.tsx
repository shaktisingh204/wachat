'use client';

import { useState } from 'react';
import { createId } from '@paralleldrive/cuid2';
import { Webhook, Plus, Trash2, Braces } from 'lucide-react';
import type { Block, Variable, WebhookOptions, KVPair } from '@/lib/sabflow/types';
import {
  Field,
  Input,
  Textarea,
  Button,
  IconButton,
  SegmentedControl,
  Callout,
} from '@/components/sabcrm/20ui';
import { PanelHeader } from './shared/primitives';
import { VariableSelect } from './shared/VariableSelect';

/* ── Types ──────────────────────────────────────────────────── */
type HttpMethod = NonNullable<WebhookOptions['method']>;

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

const HTTP_METHODS: ReadonlyArray<HttpMethod> = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

/* ── Helpers ────────────────────────────────────────────────── */
function makeKV(): KVPair {
  return { id: createId(), key: '', value: '' };
}

/* ── Main component ─────────────────────────────────────────── */
export function WebhookSettings({ block, onBlockChange, variables = [] }: Props) {
  const options = (block.options ?? {}) as WebhookOptions;
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('request');

  const url: string = options.url ?? '';
  const method: HttpMethod = options.method ?? 'POST';
  const headers: KVPair[] = options.headers ?? [];
  // body.content for backwards compat with the old string body field
  const bodyContent: string =
    typeof options.body === 'string'
      ? options.body
      : options.body?.content ?? '{}';
  const showBody = method !== 'GET';

  const update = (patch: Partial<WebhookOptions>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  const updateHeaders = (updated: KVPair[]) => update({ headers: updated });
  const addHeader = () => updateHeaders([...headers, makeKV()]);
  const updateHeader = (id: string, patch: Partial<KVPair>) =>
    updateHeaders(headers.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const removeHeader = (id: string) =>
    updateHeaders(headers.filter((h) => h.id !== id));

  return (
    <div className="space-y-4">
      <PanelHeader icon={Webhook} title="Webhook" />

      {/* Tab strip */}
      <SegmentedControl
        aria-label="Webhook section"
        fullWidth
        value={activeTab}
        onChange={(tab) => setActiveTab(tab as 'request' | 'response')}
        items={[
          { value: 'request', label: 'Request' },
          { value: 'response', label: 'Response' },
        ]}
      />

      {/* ── Request tab ────────────────────────────────────── */}
      {activeTab === 'request' && (
        <div className="space-y-4">
          {/* URL */}
          <Field label="URL">
            <Input
              type="text"
              value={url}
              onChange={(e) => update({ url: e.target.value })}
              placeholder="https://api.example.com/endpoint or {{webhookUrl}}"
              iconRight={Braces}
            />
          </Field>

          {/* Method */}
          <Field label="Method">
            <SegmentedControl
              aria-label="HTTP method"
              value={method}
              onChange={(m) => update({ method: m as HttpMethod })}
              items={HTTP_METHODS.map((m) => ({ value: m, label: m }))}
            />
          </Field>

          {/* Headers */}
          <Field label="Headers">
            <div className="space-y-2">
              {headers.map((h) => (
                <div key={h.id} className="flex gap-2 items-center">
                  <Input
                    type="text"
                    value={h.key}
                    onChange={(e) => updateHeader(h.id, { key: e.target.value })}
                    placeholder="Header name"
                    className="flex-1"
                  />
                  <Input
                    type="text"
                    value={h.value}
                    onChange={(e) => updateHeader(h.id, { value: e.target.value })}
                    placeholder="Value"
                    className="flex-1"
                  />
                  <IconButton
                    label="Remove header"
                    icon={Trash2}
                    onClick={() => removeHeader(h.id)}
                    className="shrink-0"
                  />
                </div>
              ))}
              <Button
                variant="outline"
                block
                iconLeft={Plus}
                onClick={addHeader}
              >
                Add header
              </Button>
            </div>
          </Field>

          {/* Body */}
          {showBody && (
            <Field
              label="Body (JSON)"
              help="Use {{variable}} to inject dynamic values."
            >
              <Textarea
                value={bodyContent}
                onChange={(e) =>
                  update({ body: { type: 'json', content: e.target.value } })
                }
                placeholder={'{\n  "key": "{{value}}"\n}'}
                rows={6}
                spellCheck={false}
                className="font-mono resize-y min-h-[100px]"
              />
            </Field>
          )}
        </div>
      )}

      {/* ── Response tab ───────────────────────────────────── */}
      {activeTab === 'response' && (
        <div className="space-y-4">
          <Field label="Save full response to">
            <VariableSelect
              variables={variables}
              value={options.fullResponseVariableId}
              onChange={(id) => update({ fullResponseVariableId: id })}
              placeholder="select variable"
            />
          </Field>

          <Field label="Save status code to">
            <VariableSelect
              variables={variables}
              value={options.statusCodeVariableId}
              onChange={(id) => update({ statusCodeVariableId: id })}
              placeholder="select variable"
            />
          </Field>

          <Callout tone="info">
            The full JSON response body is saved to the variable above. Access
            nested values with dot notation in later blocks.
          </Callout>
        </div>
      )}
    </div>
  );
}
