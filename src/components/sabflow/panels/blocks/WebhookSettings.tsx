'use client';

import { useState } from 'react';
import { LuWebhook, LuPlus, LuTrash2, LuBraces } from 'react-icons/lu';
import type { Block, Variable } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { Field, inputClass, PanelHeader } from './shared/primitives';
import { VariableSelect } from './shared/VariableSelect';

/* ── Types ──────────────────────────────────────────────────── */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type KVPair = { id: string; key: string; value: string };

type Props = {
  block: Block;
  onBlockChange: (block: Block) => void;
  variables?: Variable[];
};

/* ── Helpers ────────────────────────────────────────────────── */
function makeKV(): KVPair {
  return { id: crypto.randomUUID(), key: '', value: '' };
}

function methodColor(method: HttpMethod): string {
  const map: Record<HttpMethod, string> = {
    GET: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
    POST: 'border-green-500/40 bg-green-500/10 text-green-400',
    PUT: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
    PATCH: 'border-orange-500/40 bg-orange-500/10 text-orange-400',
    DELETE: 'border-red-500/40 bg-red-500/10 text-red-400',
  };
  return map[method];
}

/* ── Main component ─────────────────────────────────────────── */
export function WebhookSettings({ block, onBlockChange, variables = [] }: Props) {
  const options = block.options ?? {};
  const [activeTab, setActiveTab] = useState<'request' | 'response'>('request');

  const url = typeof options.url === 'string' ? options.url : '';
  const method: HttpMethod = (options.method as HttpMethod) ?? 'POST';
  const headers: KVPair[] = Array.isArray(options.headers) ? (options.headers as KVPair[]) : [];
  const body = typeof options.body === 'string' ? options.body : '{}';
  const showBody = method !== 'GET';

  const update = (patch: Record<string, unknown>) =>
    onBlockChange({ ...block, options: { ...options, ...patch } });

  const updateHeaders = (updated: KVPair[]) => update({ headers: updated });
  const addHeader = () => updateHeaders([...headers, makeKV()]);
  const updateHeader = (id: string, patch: Partial<KVPair>) =>
    updateHeaders(headers.map((h) => (h.id === id ? { ...h, ...patch } : h)));
  const removeHeader = (id: string) =>
    updateHeaders(headers.filter((h) => h.id !== id));

  return (
    <div className="space-y-4">
      <PanelHeader icon={LuWebhook} title="Webhook" />

      {/* Tab strip */}
      <div className="flex gap-1 rounded-lg bg-[var(--gray-3)] p-1">
        {(['request', 'response'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'flex-1 rounded-md py-1.5 text-[12px] font-medium transition-colors capitalize',
              activeTab === tab
                ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
            )}
          >
            {tab === 'request' ? 'Request' : 'Response'}
          </button>
        ))}
      </div>

      {/* ── Request tab ────────────────────────────────────── */}
      {activeTab === 'request' && (
        <div className="space-y-4">
          {/* URL */}
          <Field label="URL">
            <div className="relative flex items-center">
              <input
                type="text"
                value={url}
                onChange={(e) => update({ url: e.target.value })}
                placeholder="https://api.example.com/endpoint or {{webhookUrl}}"
                className={cn(inputClass, 'pr-8')}
              />
              <LuBraces
                className="absolute right-2.5 h-3.5 w-3.5 text-[var(--gray-7)] pointer-events-none"
                strokeWidth={1.8}
              />
            </div>
          </Field>

          {/* Method */}
          <Field label="Method">
            <div className="flex gap-1.5 flex-wrap">
              {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as HttpMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => update({ method: m })}
                  className={cn(
                    'rounded-md border px-2.5 py-1 text-[11.5px] font-mono font-semibold transition-colors',
                    method === m
                      ? methodColor(m)
                      : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-9)] hover:text-[var(--gray-12)]',
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </Field>

          {/* Headers */}
          <Field label="Headers">
            <div className="space-y-2">
              {headers.map((h) => (
                <div key={h.id} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={h.key}
                    onChange={(e) => updateHeader(h.id, { key: e.target.value })}
                    placeholder="Header name"
                    className={cn(inputClass, 'flex-1')}
                  />
                  <input
                    type="text"
                    value={h.value}
                    onChange={(e) => updateHeader(h.id, { value: e.target.value })}
                    placeholder="Value"
                    className={cn(inputClass, 'flex-1')}
                  />
                  <button
                    type="button"
                    onClick={() => removeHeader(h.id)}
                    className="shrink-0 flex h-7 w-7 items-center justify-center rounded text-[var(--gray-8)] hover:text-red-500 hover:bg-[var(--gray-3)] transition-colors"
                    aria-label="Remove header"
                  >
                    <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addHeader}
                className={cn(
                  'flex w-full items-center justify-center gap-1.5 rounded-lg',
                  'border border-dashed border-[var(--gray-6)] py-1.5',
                  'text-[12px] text-[var(--gray-9)] hover:text-[var(--gray-12)]',
                  'hover:border-[var(--gray-8)] hover:bg-[var(--gray-2)]',
                  'transition-colors',
                )}
              >
                <LuPlus className="h-3.5 w-3.5" strokeWidth={2} />
                Add header
              </button>
            </div>
          </Field>

          {/* Body */}
          {showBody && (
            <Field label="Body (JSON)">
              <textarea
                value={body}
                onChange={(e) => update({ body: e.target.value })}
                placeholder={'{\n  "key": "{{value}}"\n}'}
                rows={6}
                spellCheck={false}
                className={cn(
                  inputClass,
                  'font-mono text-[12px] resize-y min-h-[100px]',
                )}
              />
              <p className="text-[11px] text-[var(--gray-8)] mt-1">
                Use{' '}
                <code className="font-mono bg-[var(--gray-3)] px-1 rounded text-[#f76808]">
                  {'{{variable}}'}
                </code>{' '}
                to inject dynamic values.
              </p>
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
              value={typeof options.responseVariableId === 'string' ? options.responseVariableId : undefined}
              onChange={(id) => update({ responseVariableId: id })}
              placeholder="— select variable —"
            />
          </Field>

          <Field label="Save status code to">
            <VariableSelect
              variables={variables}
              value={typeof options.statusCodeVariableId === 'string' ? options.statusCodeVariableId : undefined}
              onChange={(id) => update({ statusCodeVariableId: id })}
              placeholder="— select variable —"
            />
          </Field>

          <div className="rounded-lg border border-dashed border-[var(--gray-6)] p-3 text-[12px] text-[var(--gray-9)] leading-relaxed">
            The full JSON response body is saved to the variable above.
            Access nested values with dot notation in later blocks.
          </div>
        </div>
      )}
    </div>
  );
}
