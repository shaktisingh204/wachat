'use client';

/**
 * NodeSettings
 *
 * Generic settings panel rendered from a `NodeDescriptor` served by the Rust
 * `sabflow-nodes` crate at `/api/sabflow/nodes/[type]`. This component is
 * intentionally minimal. It provides a property-driven renderer so that any
 * Rust-side node can ship metadata and immediately have a working UI.
 *
 * Specialised hand-written panels (e.g. GoogleSheetsSettings) should be
 * preferred when present; this is the fallback for nodes that only exist on
 * the Rust side.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, Sparkles } from 'lucide-react';
import {
  Field,
  Input,
  Textarea,
  Checkbox,
  Button,
  Alert,
  Spinner,
  ColorPicker,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/sabcrm/20ui';
import { CredentialSelect } from './CredentialSelect';
import type { CredentialType } from '@/lib/sabflow/credentials/types';
import { getStubFallback } from '@/lib/sabflow/forge/stubFallbacks';

/* ── Descriptor shape (matches Rust serde-camelCase output) ───────────────── */

export type NodePropertyType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'options'
  | 'multiOptions'
  | 'json'
  | 'code'
  | 'expression'
  | 'credential'
  | 'collection'
  | 'dateTime'
  | 'color'
  | 'hidden';

export interface NodePropertyOption {
  name: string;
  value: unknown;
  description?: string;
}

export interface NodeProperty {
  name: string;
  displayName: string;
  type: NodePropertyType;
  default?: unknown;
  description?: string;
  placeholder?: string;
  options: NodePropertyOption[];
  displayOptions?: Record<string, string[]>;
  required: boolean;
  children: NodeProperty[];
}

export interface NodeDescriptorCredential {
  name: string;
  displayName: string;
  required: boolean;
}

export interface NodeDescriptor {
  name: string;
  displayName: string;
  description: string;
  category: string;
  version: number;
  icon: string;
  color: string;
  isTrigger: boolean;
  inputs: number;
  outputs: number;
  outputNames: string[];
  credentials: NodeDescriptorCredential[];
  properties: NodeProperty[];
  stub: boolean;
}

/* ── Props ────────────────────────────────────────────────────────────────── */

interface Props {
  /** Rust node identifier, e.g. "slack", used to fetch the descriptor. */
  nodeType: string;
  /** Current block.options snapshot. */
  values: Record<string, unknown>;
  /** Called with the next merged options object whenever a field changes. */
  onChange: (next: Record<string, unknown>) => void;
  /**
   * Optional swap-the-block callback. When supplied, the stub banner offers
   * a one-click migration to a curated forge equivalent (see
   * `@/lib/sabflow/forge/stubFallbacks`). When omitted, the stub banner
   * stays advisory-only.
   */
  onChangeBlockType?: (nextType: string) => void;
}

/* ── Name-form helpers (so snake_case block.type still resolves) ──────────── */

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
}
function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
function stripUnderscore(s: string): string {
  return s.replace(/_/g, '');
}
function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr.filter((x) => x !== '' && x != null)));
}

// Sentinel value for the "no selection" row of an optional Select. Radix
// Select forbids an empty-string item value, so map it to/from '' at the edge.
const NONE_VALUE = '__none__';

/* ── Component ────────────────────────────────────────────────────────────── */

export function NodeSettings({ nodeType, values, onChange, onChangeBlockType }: Props) {
  const [descriptor, setDescriptor] = useState<NodeDescriptor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // Generate name candidates so blocks created with snake_case types
    // (e.g. "google_sheets") or "forge_*"-prefixed types still resolve to
    // camelCase Rust descriptors (e.g. "googleSheets", "github").
    // First successful match wins.
    const stripped = nodeType.replace(/^forge_/, '');
    const candidates = uniq([
      nodeType,
      snakeToCamel(nodeType),
      camelToSnake(nodeType),
      stripUnderscore(nodeType),
      stripped,
      snakeToCamel(stripped),
    ]);

    (async () => {
      for (const name of candidates) {
        try {
          const res = await fetch(`/api/sabflow/nodes/${encodeURIComponent(name)}`);
          if (res.ok) {
            const d = (await res.json()) as NodeDescriptor;
            if (!cancelled) {
              setDescriptor(d);
              setLoading(false);
            }
            return;
          }
        } catch {
          /* try next candidate */
        }
      }
      if (!cancelled) {
        setError(`No settings descriptor for "${nodeType}".`);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [nodeType]);

  /** Merge a single property change into the values object and notify parent. */
  const setField = (name: string, value: unknown) => {
    onChange({ ...values, [name]: value });
  };

  /* ── Loading / error states ────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-2 text-[11.5px] text-[var(--st-text-tertiary)]">
        <Spinner size="sm" label="Loading node" />
        Loading node...
      </div>
    );
  }

  if (error || !descriptor) {
    return (
      <Alert tone="danger" icon={AlertTriangle}>
        {error ?? 'Failed to load node descriptor.'}
      </Alert>
    );
  }

  /* ── Visibility predicate ──────────────────────────────────────────────── */

  const isVisible = (prop: NodeProperty): boolean => {
    if (!prop.displayOptions) return true;
    for (const [key, allowed] of Object.entries(prop.displayOptions)) {
      const current = values[key];
      // Compare loosely as strings so option values stay flexible.
      const matches = allowed.some((a) => String(a) === String(current));
      if (!matches) return false;
    }
    return true;
  };

  /* ── Per-property renderer ─────────────────────────────────────────────── */

  const renderProperty = (prop: NodeProperty) => {
    if (prop.type === 'hidden') return null;
    if (!isVisible(prop)) return null;

    const current = values[prop.name] ?? prop.default;

    switch (prop.type) {
      case 'boolean':
        return (
          <Checkbox
            key={prop.name}
            size="sm"
            checked={Boolean(current)}
            required={prop.required}
            onChange={(e) => setField(prop.name, e.target.checked)}
            label={prop.displayName}
          />
        );

      case 'string':
        return (
          <Field
            key={prop.name}
            label={prop.displayName}
            required={prop.required}
            help={prop.description}
          >
            <Input
              inputSize="sm"
              value={typeof current === 'string' ? current : current == null ? '' : String(current)}
              placeholder={prop.placeholder}
              onChange={(e) => setField(prop.name, e.target.value)}
            />
          </Field>
        );

      case 'number':
        return (
          <Field
            key={prop.name}
            label={prop.displayName}
            required={prop.required}
            help={prop.description}
          >
            <Input
              type="number"
              inputSize="sm"
              value={typeof current === 'number' ? current : current == null ? '' : Number(current)}
              placeholder={prop.placeholder}
              onChange={(e) => {
                const v = e.target.value;
                setField(prop.name, v === '' ? undefined : Number(v));
              }}
            />
          </Field>
        );

      case 'options': {
        const selectValue = current == null || current === '' ? NONE_VALUE : String(current);
        return (
          <Field
            key={prop.name}
            label={prop.displayName}
            required={prop.required}
            help={prop.description}
          >
            <Select
              value={selectValue}
              onValueChange={(v) => setField(prop.name, v === NONE_VALUE ? '' : v)}
            >
              <SelectTrigger aria-label={prop.displayName}>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {!prop.required && <SelectItem value={NONE_VALUE}>None</SelectItem>}
                {prop.options.map((o) => (
                  <SelectItem key={String(o.value)} value={String(o.value)}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        );
      }

      case 'multiOptions': {
        const selected = Array.isArray(current) ? current.map((v) => String(v)) : [];
        const toggle = (val: string, checked: boolean) => {
          const next = checked
            ? uniq([...selected, val])
            : selected.filter((v) => v !== val);
          setField(prop.name, next);
        };
        return (
          <Field
            key={prop.name}
            label={prop.displayName}
            required={prop.required}
            help={prop.description}
          >
            <div className="flex flex-col gap-1.5 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-2.5">
              {prop.options.map((o) => {
                const val = String(o.value);
                return (
                  <Checkbox
                    key={val}
                    size="sm"
                    checked={selected.includes(val)}
                    onChange={(e) => toggle(val, e.target.checked)}
                    label={o.name}
                  />
                );
              })}
            </div>
          </Field>
        );
      }

      case 'json':
      case 'code':
      case 'expression':
        return (
          <Field
            key={prop.name}
            label={prop.displayName}
            required={prop.required}
            help={prop.description}
          >
            <Textarea
              rows={6}
              value={
                typeof current === 'string'
                  ? current
                  : current == null
                    ? ''
                    : JSON.stringify(current, null, 2)
              }
              placeholder={prop.placeholder}
              onChange={(e) => setField(prop.name, e.target.value)}
              spellCheck={false}
              className="font-mono text-[12px] leading-snug resize-y"
            />
          </Field>
        );

      case 'credential': {
        const credentialType = descriptor.credentials[0]?.name as CredentialType | undefined;
        if (!credentialType) {
          return (
            <div key={prop.name} className="text-[11px] text-[var(--st-text-tertiary)]">
              Credential property declared but no credential type provided on descriptor.
            </div>
          );
        }
        return (
          <Field key={prop.name} label={prop.displayName} required={prop.required}>
            <CredentialSelect
              credentialType={credentialType}
              value={typeof current === 'string' ? current : undefined}
              onChange={(credId) => setField(prop.name, credId)}
            />
          </Field>
        );
      }

      case 'dateTime':
        return (
          <Field
            key={prop.name}
            label={prop.displayName}
            required={prop.required}
            help={prop.description}
          >
            <Input
              type="datetime-local"
              inputSize="sm"
              value={typeof current === 'string' ? current : ''}
              onChange={(e) => setField(prop.name, e.target.value)}
            />
          </Field>
        );

      case 'color':
        return (
          <Field key={prop.name} label={prop.displayName} required={prop.required}>
            <ColorPicker
              value={typeof current === 'string' && current ? current : '#000000'}
              onChange={(color) => setField(prop.name, color)}
            />
          </Field>
        );

      case 'collection':
        // Render child properties inline. A future revision can support
        // repeating collections; for now we render the schema once.
        return (
          <div
            key={prop.name}
            className="space-y-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3"
          >
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
              {prop.displayName}
            </div>
            {prop.children.map((child) => renderProperty(child))}
          </div>
        );

      default:
        return null;
    }
  };

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[13px] font-semibold text-[var(--st-text)]">{descriptor.displayName}</div>
        {descriptor.description && (
          <p className="mt-0.5 text-[11px] text-[var(--st-text-tertiary)]">{descriptor.description}</p>
        )}
      </div>

      {descriptor.stub && (() => {
        // Two presentations:
        //  - With fallback: this is a legacy descriptor whose modern
        //    SabFlow equivalent is ready. Show a friendly "Upgrade
        //    available" Alert with one-click swap as the primary action.
        //    Avoids the alarming "broken" language for the common case.
        //  - No fallback: rare. Surface the original warning so the user
        //    knows the descriptor is configurable but not executable.
        const fallback = getStubFallback(descriptor.name);
        if (fallback && onChangeBlockType) {
          return (
            <Alert
              tone="info"
              icon={Sparkles}
              title={
                <>
                  Upgrade available, use{' '}
                  <span className="underline decoration-dotted underline-offset-2">
                    {fallback.label}
                  </span>
                </>
              }
            >
              <p className="text-[10.5px] leading-snug">{fallback.rationale}</p>
              <div className="mt-2 flex justify-end">
                <Button
                  variant="primary"
                  size="sm"
                  iconRight={ArrowRight}
                  onClick={() => onChangeBlockType(fallback.forgeType)}
                >
                  Switch to {fallback.label}
                </Button>
              </div>
            </Alert>
          );
        }
        return (
          <Alert tone="warning" icon={AlertTriangle}>
            This descriptor is configurable but its executor is not yet shipped. The fields below
            test the schema only, the block will not run.
          </Alert>
        );
      })()}

      <div className="space-y-3">{descriptor.properties.map((p) => renderProperty(p))}</div>
    </div>
  );
}

export default NodeSettings;
