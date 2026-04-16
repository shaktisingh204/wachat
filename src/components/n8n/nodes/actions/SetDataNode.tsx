'use client';

import { useState } from 'react';
import { LuVariable, LuPlus, LuX, LuGripVertical, LuCode2 } from 'react-icons/lu';
import { cn } from '@/lib/utils';

/* ── Types ───────────────────────────────────────────────── */

export type SetDataValueType = 'string' | 'number' | 'boolean' | 'json' | 'expression';

export interface DataEntry {
  id: string;
  key: string;
  value: string;
  valueType: SetDataValueType;
}

export type SetDataMode =
  | 'merge'     // merge new keys into existing item data
  | 'replace';  // replace all item data with these keys

export interface SetDataNodeConfig {
  mode: SetDataMode;
  entries: DataEntry[];
}

/** Output: the same item data enriched/replaced with the defined keys */
export type SetDataOutput = Record<string, unknown>;

export type SetDataNodeProps = {
  config: SetDataNodeConfig;
  onChange: (config: SetDataNodeConfig) => void;
  className?: string;
};

/* ── Helpers ─────────────────────────────────────────────── */

let _id = 0;
function makeEntry(key = '', value = '', valueType: SetDataValueType = 'string'): DataEntry {
  return { id: `se-${++_id}`, key, value, valueType };
}

const VALUE_TYPE_LABELS: Record<SetDataValueType, string> = {
  string:     'String',
  number:     'Number',
  boolean:    'Boolean',
  json:       'JSON',
  expression: 'Expression',
};

const BOOL_OPTIONS = ['true', 'false'];

/* ── Component ───────────────────────────────────────────── */

export function SetDataNode({ config, onChange, className }: SetDataNodeProps) {
  const updateEntry = (id: string, field: keyof DataEntry, val: string) =>
    onChange({
      ...config,
      entries: config.entries.map((e) => (e.id === id ? { ...e, [field]: val } : e)),
    });

  const removeEntry = (id: string) =>
    onChange({ ...config, entries: config.entries.filter((e) => e.id !== id) });

  const addEntry = () =>
    onChange({ ...config, entries: [...config.entries, makeEntry()] });

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fb923c]/10 text-[#fb923c]">
          <LuVariable className="h-4 w-4" strokeWidth={2} />
        </div>
        <div>
          <p className="text-[12.5px] font-semibold text-[var(--gray-12)]">Set Data</p>
          <p className="text-[11px] text-[var(--gray-9)]">Set or overwrite key-value pairs in item data</p>
        </div>
      </div>

      {/* Mode */}
      <div className="space-y-1.5">
        <Label>Mode</Label>
        <div className="flex gap-1 rounded-lg bg-[var(--gray-3)] p-1">
          {(['merge', 'replace'] as SetDataMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...config, mode: m })}
              className={cn(
                'flex-1 rounded-md py-1.5 text-[12px] font-medium transition-colors capitalize',
                config.mode === m
                  ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                  : 'text-[var(--gray-9)] hover:text-[var(--gray-12)]',
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-[var(--gray-9)]">
          {config.mode === 'merge'
            ? 'Merge these keys into the item — existing keys not listed here are kept.'
            : 'Replace all item data with only these keys.'}
        </p>
      </div>

      {/* Entries */}
      <div className="space-y-2">
        <Label>Key-Value Pairs</Label>

        {config.entries.length === 0 && (
          <div className="rounded-lg border border-dashed border-[var(--gray-5)] py-6 text-center text-[12px] text-[var(--gray-9)]">
            <LuVariable className="mx-auto mb-2 h-5 w-5 opacity-30" strokeWidth={1.5} />
            No entries — click Add below
          </div>
        )}

        {config.entries.map((entry, idx) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            index={idx}
            onChange={updateEntry}
            onRemove={removeEntry}
          />
        ))}

        <button
          type="button"
          onClick={addEntry}
          className="flex items-center gap-1.5 text-[12px] font-medium text-[#f76808] hover:text-[#e25c00] transition-colors"
        >
          <LuPlus className="h-3.5 w-3.5" strokeWidth={2} />
          Add entry
        </button>
      </div>

      {/* Preview */}
      {config.entries.length > 0 && (
        <div className="space-y-1.5">
          <Label>Preview</Label>
          <pre className="overflow-x-auto rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3 text-[11.5px] font-mono text-[var(--gray-11)]">
            {buildPreview(config.entries)}
          </pre>
        </div>
      )}

      <OutputSchema
        accent="#fb923c"
        fields={[
          { key: '...keys', type: 'any', description: 'Each key defined above is available as output' },
        ]}
      />
    </div>
  );
}

/* ── Entry row ───────────────────────────────────────────── */

function EntryRow({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: DataEntry;
  index: number;
  onChange: (id: string, field: keyof DataEntry, val: string) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-3 space-y-2">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <LuGripVertical className="h-3.5 w-3.5 text-[var(--gray-7)] shrink-0 cursor-grab" strokeWidth={2} />
        <span className="text-[10.5px] font-mono text-[var(--gray-8)] shrink-0">{String(index + 1).padStart(2, '0')}</span>
        <div className="flex-1 min-w-0">
          <input
            type="text"
            className={cn(INPUT_CLS, 'py-1.5 text-[12px] font-mono')}
            value={entry.key}
            onChange={(e) => onChange(entry.id, 'key', e.target.value)}
            placeholder="key_name"
          />
        </div>
        {/* Type badge */}
        <select
          className="rounded-md border border-[var(--gray-5)] bg-[var(--gray-3)] px-2 py-1 text-[11px] text-[var(--gray-10)] outline-none focus:border-[#f76808] shrink-0"
          value={entry.valueType}
          onChange={(e) => onChange(entry.id, 'valueType', e.target.value)}
        >
          {(Object.keys(VALUE_TYPE_LABELS) as SetDataValueType[]).map((t) => (
            <option key={t} value={t}>{VALUE_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onRemove(entry.id)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--gray-8)] hover:text-red-500 transition-colors"
        >
          <LuX className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Value input */}
      {entry.valueType === 'boolean' ? (
        <div className="flex gap-2">
          {BOOL_OPTIONS.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => onChange(entry.id, 'value', b)}
              className={cn(
                'flex-1 rounded-md border py-1.5 text-[12px] font-semibold transition-colors',
                entry.value === b
                  ? b === 'true'
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-red-300 bg-red-50 text-red-700'
                  : 'border-[var(--gray-5)] bg-[var(--gray-2)] text-[var(--gray-9)] hover:border-[var(--gray-6)]',
              )}
            >
              {b}
            </button>
          ))}
        </div>
      ) : entry.valueType === 'json' ? (
        <textarea
          className={cn(INPUT_CLS, 'min-h-[80px] font-mono text-[12px] resize-y')}
          value={entry.value}
          onChange={(e) => onChange(entry.id, 'value', e.target.value)}
          placeholder='{ "key": "value" }'
          spellCheck={false}
        />
      ) : entry.valueType === 'expression' ? (
        <div className="relative">
          <LuCode2 className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--gray-8)]" strokeWidth={2} />
          <input
            type="text"
            className={cn(INPUT_CLS, 'pl-9 font-mono text-[12px]')}
            value={entry.value}
            onChange={(e) => onChange(entry.id, 'value', e.target.value)}
            placeholder="{{ $json.field + '_suffix' }}"
          />
        </div>
      ) : (
        <input
          type={entry.valueType === 'number' ? 'number' : 'text'}
          className={INPUT_CLS}
          value={entry.value}
          onChange={(e) => onChange(entry.id, 'value', e.target.value)}
          placeholder={entry.valueType === 'number' ? '42' : 'value or {{variable}}'}
        />
      )}
    </div>
  );
}

/* ── Preview builder ─────────────────────────────────────── */

function buildPreview(entries: DataEntry[]): string {
  const obj: Record<string, unknown> = {};
  for (const e of entries) {
    if (!e.key) continue;
    if (e.valueType === 'number') obj[e.key] = Number(e.value) || 0;
    else if (e.valueType === 'boolean') obj[e.key] = e.value === 'true';
    else if (e.valueType === 'json') {
      try { obj[e.key] = JSON.parse(e.value); } catch { obj[e.key] = e.value; }
    }
    else obj[e.key] = e.value;
  }
  return JSON.stringify(obj, null, 2);
}

/* ── Shared primitives ───────────────────────────────────── */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[11.5px] font-medium text-[var(--gray-10)] uppercase tracking-wide">
      {children}
    </label>
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
            <code className="min-w-[70px] text-[11.5px] font-mono font-medium" style={{ color: accent }}>{f.key}</code>
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
