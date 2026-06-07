'use client';

/**
 * ForgeFieldRenderer
 *
 * Render a single declarative `ForgeField` against the surrounding options
 * dictionary. All field types collapse into the handful of 20ui primitives so
 * the visual language stays consistent with hand-written block panels.
 */

import { useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { Plus, X } from 'lucide-react';

import {
  Field,
  Input,
  Button,
  IconButton,
  Switch,
  Spinner,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import type {
  ForgeField,
  ForgeKeyValuePair,
  ForgeSelectOption,
} from '@/lib/sabflow/forge/types';
import { useLoadOptions } from './useLoadOptions';
import { ResourceLocatorField } from './ResourceLocatorField';
import { ExpressionEditor } from '../ExpressionEditor';
import { useContextVariables } from './useContextVariables';

/* -- Props ---------------------------------------------------------------- */

type Props = {
  field: ForgeField;
  /** Current value from the options object. */
  value: unknown;
  /** Called with the next value for this field. */
  onChange: (value: unknown) => void;
  /** Block id, required to resolve loadOptions server-side. */
  blockId?: string;
  /** Selected action id for multi-action blocks. */
  actionId?: string;
  /** Currently selected credential id (for credential-bound loadOptions). */
  credentialId?: string;
  /** Snapshot of sibling field values, useful for dependent dropdowns. */
  options?: Record<string, unknown>;
  /** Canvas node ID for graph traversal */
  nodeId?: string;
};

/* -- Helpers -------------------------------------------------------------- */

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

/* -- Field renderer ------------------------------------------------------- */

export function ForgeFieldRenderer({
  field,
  value,
  onChange,
  blockId,
  actionId,
  credentialId,
  options,
  nodeId,
}: Props) {
  const contextVariables = useContextVariables(nodeId);

  const handleText = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
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
          <ExpressionEditor
            value={asString(value)}
            onChange={onChange}
            placeholder={field.placeholder}
            minHeight="38px"
            variables={contextVariables}
          />
        );

      case 'password':
        return (
          <Input
            type="password"
            value={asString(value)}
            onChange={handleText}
            placeholder={field.placeholder ?? '••••••••'}
            required={field.required}
            autoComplete="off"
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={asNumber(value)}
            onChange={handleNumber}
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case 'textarea':
        return (
          <ExpressionEditor
            value={asString(value)}
            onChange={onChange}
            placeholder={field.placeholder}
            minHeight="90px"
            variables={contextVariables}
          />
        );

      case 'code':
      case 'json':
        return (
          <ExpressionEditor
            className="font-mono text-[12px] leading-relaxed"
            value={asString(value)}
            onChange={onChange}
            placeholder={field.placeholder}
            minHeight="140px"
            variables={contextVariables}
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
          <Select
            value={asString(value)}
            onValueChange={onChange}
            required={field.required}
          >
            <SelectTrigger aria-label={field.label}>
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'toggle':
        return (
          <Switch
            checked={Boolean(value)}
            onCheckedChange={onChange}
            aria-label={field.label}
          />
        );

      case 'credential':
        return (
          <Input
            type="password"
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
  }, [field, value, handleText, handleNumber, onChange, blockId, actionId, credentialId, options, contextVariables]);

  return (
    <Field label={field.label} help={field.helperText}>
      {control}
    </Field>
  );
}

/* -- Dynamic select (loadOptions) ----------------------------------------- */

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
    <div className="space-y-1">
      <Select
        value={asString(value)}
        onValueChange={onChange}
        required={field.required}
        disabled={loading && merged.length === 0}
      >
        <SelectTrigger aria-label={field.label}>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {merged.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {loading && (
        <p className="flex items-center gap-1.5 text-[11px] leading-snug text-[var(--st-text-secondary)]">
          <Spinner size="sm" label="Loading options" />
          Loading options
        </p>
      )}
      {error && !loading && (
        <p className="text-[11px] leading-snug text-[var(--st-danger)]">
          {error}, using fallback options.
        </p>
      )}
    </div>
  );
}

/* -- Key/value list ------------------------------------------------------- */

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
          <Input
            type="text"
            className="flex-1"
            placeholder="Key"
            value={row.key}
            onChange={(e) => updateRow(row.id, { key: e.target.value })}
          />
          <Input
            type="text"
            className="flex-1"
            placeholder="Value"
            value={row.value}
            onChange={(e) => updateRow(row.id, { value: e.target.value })}
          />
          <IconButton
            label="Remove row"
            icon={X}
            variant="ghost"
            size="sm"
            onClick={() => removeRow(row.id)}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" iconLeft={Plus} onClick={addRow}>
        Add row
      </Button>
    </div>
  );
}
