'use client';

/**
 * ForgeFieldRenderer
 *
 * Render a single declarative `ForgeField` against the surrounding options
 * dictionary.  All field types collapse into the handful of primitive inputs
 * defined in `blocks/shared/primitives.tsx` so the visual language stays
 * consistent with hand-written block panels.
 */

import { useCallback, useMemo, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { LuPlus, LuX } from 'react-icons/lu';

import { Field, inputClass, selectClass, toggleClass } from '../shared/primitives';
import type {
  ForgeField,
  ForgeKeyValuePair,
  ForgeSelectOption,
} from '@/lib/sabflow/forge/types';
import { cn } from '@/lib/utils';
import { useLoadOptions } from './useLoadOptions';
import { ResourceLocatorField } from './ResourceLocatorField';

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  field: ForgeField;
  /** Current value from the options object. */
  value: unknown;
  /** Called with the next value for this field. */
  onChange: (value: unknown) => void;
  /** Block id — required to resolve loadOptions server-side. */
  blockId?: string;
  /** Selected action id for multi-action blocks. */
  actionId?: string;
  /** Currently selected credential id (for credential-bound loadOptions). */
  credentialId?: string;
  /** Snapshot of sibling field values — useful for dependent dropdowns. */
  options?: Record<string, unknown>;
};

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const asString = (v: unknown): string => {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v == null) return '';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return '';
  }
};

const asNumber = (v: unknown): string => {
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'string') return v;
  return '';
};

const asKvList = (v: unknown): ForgeKeyValuePair[] => {
  if (!Array.isArray(v)) return [];
  return v.filter(
    (row): row is ForgeKeyValuePair =>
      typeof row === 'object' &&
      row !== null &&
      'id' in row &&
      typeof (row as ForgeKeyValuePair).id === 'string',
  );
};

let kvIdCounter = 0;
const nextKvId = (): string => {
  kvIdCounter += 1;
  return `kv_${Date.now().toString(36)}_${kvIdCounter}`;
};

/* ── Field renderer ──────────────────────────────────────────────────────── */

export function ForgeFieldRenderer({
  field,
  value,
  onChange,
  blockId,
  actionId,
  credentialId,
  options,
}: Props) {
  const handleText = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  const handleNumber = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === '') {
        onChange('');
        return;
      }
      const parsed = Number(raw);
      onChange(Number.isNaN(parsed) ? raw : parsed);
    },
    [onChange],
  );

  const control = useMemo(() => {
    switch (field.type) {
      case 'text':
      case 'variable':
        return (
          <input
            type="text"
            className={inputClass}
            value={asString(value)}
            onChange={handleText}
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case 'password':
        return (
          <input
            type="password"
            className={inputClass}
            value={asString(value)}
            onChange={handleText}
            placeholder={field.placeholder ?? '••••••••'}
            required={field.required}
            autoComplete="off"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            className={inputClass}
            value={asNumber(value)}
            onChange={handleNumber}
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case 'textarea':
        return (
          <textarea
            className={cn(inputClass, 'min-h-[90px] resize-y font-sans')}
            value={asString(value)}
            onChange={handleText}
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case 'code':
      case 'json':
        return (
          <textarea
            className={cn(
              inputClass,
              'min-h-[140px] resize-y font-mono text-[12px] leading-relaxed',
            )}
            value={asString(value)}
            onChange={handleText}
            placeholder={field.placeholder}
            spellCheck={false}
          />
        );

      case 'select':
        if (field.loadOptions && blockId) {
          return (
            <DynamicSelect
              field={field}
              value={value}
              onChange={onChange}
              blockId={blockId}
              actionId={actionId}
              credentialId={credentialId}
              options={options ?? {}}
            />
          );
        }
        return (
          <div className="relative">
            <select
              className={selectClass}
              value={asString(value)}
              onChange={handleText}
              required={field.required}
            >
              {!field.required && <option value="">Select…</option>}
              {field.options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'toggle':
        return (
          <ToggleInput checked={Boolean(value)} onChange={onChange} label={field.label} />
        );

      case 'credential':
        return (
          <input
            type="password"
            className={inputClass}
            value={asString(value)}
            onChange={handleText}
            placeholder={field.placeholder ?? 'Credential'}
            autoComplete="off"
          />
        );

      case 'key-value-list':
        return <KeyValueListInput rows={asKvList(value)} onChange={onChange} />;

      case 'resourceLocator':
        if (!blockId) return null;
        return (
          <ResourceLocatorField
            field={field}
            value={value}
            onChange={onChange}
            blockId={blockId}
            actionId={actionId}
            credentialId={credentialId}
            options={options ?? {}}
          />
        );

      default:
        return null;
    }
  }, [field, value, handleText, handleNumber, onChange, blockId, actionId, credentialId, options]);

  return (
    <Field label={field.label}>
      {control}
      {field.helperText && (
        <p className="text-[11px] text-[var(--gray-9)] leading-snug">{field.helperText}</p>
      )}
    </Field>
  );
}

/* ── Toggle ──────────────────────────────────────────────────────────────── */

type ToggleProps = { checked: boolean; onChange: (v: boolean) => void; label: string };

function ToggleInput({ checked, onChange, label }: ToggleProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        onChange(!checked);
      }
    },
    [checked, onChange],
  );
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      onKeyDown={handleKeyDown}
      className={toggleClass(checked)}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}

/* ── Dynamic select (loadOptions) ────────────────────────────────────────── */

type DynamicSelectProps = {
  field: ForgeField;
  value: unknown;
  onChange: (value: unknown) => void;
  blockId: string;
  actionId?: string;
  credentialId?: string;
  options: Record<string, unknown>;
};

function DynamicSelect({
  field,
  value,
  onChange,
  blockId,
  actionId,
  credentialId,
  options,
}: DynamicSelectProps) {
  const { items: remote, loading, error } = useLoadOptions({
    blockId,
    actionId,
    field,
    options,
    credentialId,
  });

  const merged = useMemo<ForgeSelectOption[]>(() => {
    const out: ForgeSelectOption[] = [];
    const seen = new Set<string>();
    const push = (opt: ForgeSelectOption) => {
      if (seen.has(opt.value)) return;
      seen.add(opt.value);
      out.push(opt);
    };
    // Remote options take precedence; static field.options act as fallback.
    if (remote) remote.forEach(push);
    field.options?.forEach(push);
    return out;
  }, [remote, field.options]);

  return (
    <div className="relative space-y-1">
      <select
        className={selectClass}
        value={asString(value)}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
        disabled={loading && merged.length === 0}
      >
        {!field.required && <option value="">Select…</option>}
        {merged.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {loading && (
        <p className="text-[11px] text-[var(--gray-9)] leading-snug">Loading options…</p>
      )}
      {error && !loading && (
        <p className="text-[11px] text-[#f76808] leading-snug">
          {error} — using fallback options.
        </p>
      )}
    </div>
  );
}

/* ── Key/value list ──────────────────────────────────────────────────────── */

type KvProps = {
  rows: ForgeKeyValuePair[];
  onChange: (rows: ForgeKeyValuePair[]) => void;
};

function KeyValueListInput({ rows, onChange }: KvProps) {
  const updateRow = useCallback(
    (id: string, patch: Partial<ForgeKeyValuePair>) => {
      onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [rows, onChange],
  );

  const removeRow = useCallback(
    (id: string) => {
      onChange(rows.filter((r) => r.id !== id));
    },
    [rows, onChange],
  );

  const addRow = useCallback(() => {
    onChange([...rows, { id: nextKvId(), key: '', value: '' }]);
  }, [rows, onChange]);

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.id} className="flex items-center gap-2">
          <input
            type="text"
            className={cn(inputClass, 'flex-1')}
            placeholder="Key"
            value={row.key}
            onChange={(e) => updateRow(row.id, { key: e.target.value })}
          />
          <input
            type="text"
            className={cn(inputClass, 'flex-1')}
            placeholder="Value"
            value={row.value}
            onChange={(e) => updateRow(row.id, { value: e.target.value })}
          />
          <button
            type="button"
            onClick={() => removeRow(row.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--gray-9)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] transition-colors"
            aria-label="Remove row"
          >
            <LuX className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-1.5 text-[12px] text-[var(--gray-10)] hover:border-[#f76808] hover:text-[#f76808] transition-colors"
      >
        <LuPlus className="h-3.5 w-3.5" />
        Add row
      </button>
    </div>
  );
}
