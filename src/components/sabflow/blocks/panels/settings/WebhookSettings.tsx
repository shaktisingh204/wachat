'use client';
import { useState } from 'react';
import type { Block } from '@/lib/sabflow/types';
import { cn } from '@/lib/utils';
import { LuPlus, LuTrash2 } from 'react-icons/lu';
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

const inputClass =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[#f76808] transition-colors';

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
      <div className="flex gap-1 rounded-lg bg-[var(--gray-3)] p-1">
        {(['request', 'response'] as const).map((tab) => (
          <button
            key={tab}
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
            <div className="flex gap-1.5 flex-wrap">
              {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as HttpMethod[]).map((m) => (
                <button
                  key={m}
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
                    onClick={() => removeHeader(h.id)}
                    className="shrink-0 flex h-7 w-7 items-center justify-center rounded text-[var(--gray-8)] hover:text-red-500 hover:bg-[var(--gray-3)] transition-colors"
                  >
                    <LuTrash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                </div>
              ))}
              <button
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
                value={String(options.body ?? '{}')}
                onChange={(e) => update({ body: e.target.value })}
                placeholder={'{\n  "key": "{{value}}"\n}'}
                rows={6}
                className={cn(
                  inputClass,
                  'font-mono text-[12px] resize-y min-h-[100px]',
                )}
              />
              <p className="text-[11px] text-[var(--gray-8)] mt-1">
                Use <code className="font-mono bg-[var(--gray-3)] px-1 rounded">{'{{variable}}'}</code> to
                insert dynamic values.
              </p>
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

          <div className="rounded-lg border border-dashed border-[var(--gray-6)] p-3 text-[12px] text-[var(--gray-9)] leading-relaxed">
            The full JSON response body is saved to the variable above.
            Access nested values using dot notation in subsequent blocks.
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
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
