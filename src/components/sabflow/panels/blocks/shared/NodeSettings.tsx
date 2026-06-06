'use client';

/**
 * NodeSettings
 *
 * Generic settings panel rendered from a `NodeDescriptor` served by the Rust
 * `sabflow-nodes` crate at `/api/sabflow/nodes/[type]`. This component is
 * intentionally minimal — it provides a property-driven renderer so that any
 * Rust-side node can ship metadata and immediately have a working UI.
 *
 * Specialised hand-written panels (e.g. GoogleSheetsSettings) should be
 * preferred when present; this is the fallback for nodes that only exist on
 * the Rust side.
 */

import { useEffect, useState } from 'react';
import { LuLoader, LuTriangleAlert, LuArrowRight, LuSparkles } from 'react-icons/lu';
import { CredentialSelect } from './CredentialSelect';
import { selectClass } from './primitives';
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
  /** Rust node identifier — e.g. "slack" — used to fetch the descriptor. */
  nodeType: string;
  /** Current block.options snapshot. */
  values: Record<string, unknown>;
  /** Called with the next merged options object whenever a field changes. */
  onChange: (next: Record<string, unknown>) => void;
  /**
   * Optional swap-the-block callback.  When supplied, the stub banner offers
   * a one-click migration to a curated forge equivalent (see
   * `@/lib/sabflow/forge/stubFallbacks`).  When omitted, the stub banner
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

/* ── Shared styles ────────────────────────────────────────────────────────── */

const labelClass = 'block text-[11.5px] text-[var(--gray-11)] mb-1';
const inputBase =
  'w-full rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-3 py-2 text-[13px] text-[var(--gray-12)] placeholder:text-[var(--gray-8)] outline-none focus:border-[var(--st-border)] transition-colors';
const textareaClass = `${inputBase} font-mono text-[12px] leading-snug resize-y`;

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
      <div className="flex items-center gap-2 text-[11.5px] text-[var(--gray-8)] px-1 py-2">
        <LuLoader className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
        Loading node…
      </div>
    );
  }

  if (error || !descriptor) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-[11.5px] text-[var(--st-text)]">
        <LuTriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" strokeWidth={1.8} />
        <span>{error ?? 'Failed to load node descriptor.'}</span>
      </div>
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
    const id = `node-prop-${prop.name}`;

    switch (prop.type) {
      case 'boolean':
        return (
          <div key={prop.name} className="flex items-center gap-2">
            <input
              id={id}
              type="checkbox"
              checked={Boolean(current)}
              onChange={(e) => setField(prop.name, e.target.checked)}
              className="h-3.5 w-3.5 rounded border-[var(--gray-5)] text-[var(--st-text)] focus:ring-[var(--st-border)]"
            />
            <label htmlFor={id} className="text-[11.5px] text-[var(--gray-11)] cursor-pointer">
              {prop.displayName}
              {prop.required && <span className="text-[var(--st-text)] ml-0.5">*</span>}
            </label>
          </div>
        );

      case 'string':
        return (
          <div key={prop.name}>
            <label htmlFor={id} className={labelClass}>
              {prop.displayName}
              {prop.required && <span className="text-[var(--st-text)] ml-0.5">*</span>}
            </label>
            <input
              id={id}
              type="text"
              value={typeof current === 'string' ? current : current == null ? '' : String(current)}
              placeholder={prop.placeholder}
              onChange={(e) => setField(prop.name, e.target.value)}
              className={inputBase}
            />
            {prop.description && (
              <p className="mt-1 text-[10.5px] text-[var(--gray-8)]">{prop.description}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={prop.name}>
            <label htmlFor={id} className={labelClass}>
              {prop.displayName}
              {prop.required && <span className="text-[var(--st-text)] ml-0.5">*</span>}
            </label>
            <input
              id={id}
              type="number"
              value={typeof current === 'number' ? current : current == null ? '' : Number(current)}
              placeholder={prop.placeholder}
              onChange={(e) => {
                const v = e.target.value;
                setField(prop.name, v === '' ? undefined : Number(v));
              }}
              className={inputBase}
            />
            {prop.description && (
              <p className="mt-1 text-[10.5px] text-[var(--gray-8)]">{prop.description}</p>
            )}
          </div>
        );

      case 'options':
        return (
          <div key={prop.name}>
            <label htmlFor={id} className={labelClass}>
              {prop.displayName}
              {prop.required && <span className="text-[var(--st-text)] ml-0.5">*</span>}
            </label>
            <select
              id={id}
              value={current == null ? '' : String(current)}
              onChange={(e) => setField(prop.name, e.target.value)}
              className={selectClass}
            >
              {!prop.required && <option value="">— select —</option>}
              {prop.options.map((o) => (
                <option key={String(o.value)} value={String(o.value)}>
                  {o.name}
                </option>
              ))}
            </select>
            {prop.description && (
              <p className="mt-1 text-[10.5px] text-[var(--gray-8)]">{prop.description}</p>
            )}
          </div>
        );

      case 'multiOptions': {
        const selected = Array.isArray(current) ? current.map((v) => String(v)) : [];
        return (
          <div key={prop.name}>
            <label htmlFor={id} className={labelClass}>
              {prop.displayName}
              {prop.required && <span className="text-[var(--st-text)] ml-0.5">*</span>}
            </label>
            <select
              id={id}
              multiple
              value={selected}
              onChange={(e) => {
                const next = Array.from(e.target.selectedOptions).map((o) => o.value);
                setField(prop.name, next);
              }}
              className={`${selectClass} min-h-[88px]`}
            >
              {prop.options.map((o) => (
                <option key={String(o.value)} value={String(o.value)}>
                  {o.name}
                </option>
              ))}
            </select>
            {prop.description && (
              <p className="mt-1 text-[10.5px] text-[var(--gray-8)]">{prop.description}</p>
            )}
          </div>
        );
      }

      case 'json':
      case 'code':
      case 'expression':
        return (
          <div key={prop.name}>
            <label htmlFor={id} className={labelClass}>
              {prop.displayName}
              {prop.required && <span className="text-[var(--st-text)] ml-0.5">*</span>}
            </label>
            <textarea
              id={id}
              rows={6}
              value={typeof current === 'string' ? current : current == null ? '' : JSON.stringify(current, null, 2)}
              placeholder={prop.placeholder}
              onChange={(e) => setField(prop.name, e.target.value)}
              className={textareaClass}
              spellCheck={false}
            />
            {prop.description && (
              <p className="mt-1 text-[10.5px] text-[var(--gray-8)]">{prop.description}</p>
            )}
          </div>
        );

      case 'credential': {
        const credentialType = descriptor.credentials[0]?.name as CredentialType | undefined;
        if (!credentialType) {
          return (
            <div key={prop.name} className="text-[11px] text-[var(--gray-8)]">
              Credential property declared but no credential type provided on descriptor.
            </div>
          );
        }
        return (
          <div key={prop.name}>
            <label className={labelClass}>
              {prop.displayName}
              {prop.required && <span className="text-[var(--st-text)] ml-0.5">*</span>}
            </label>
            <CredentialSelect
              credentialType={credentialType}
              value={typeof current === 'string' ? current : undefined}
              onChange={(credId) => setField(prop.name, credId)}
            />
          </div>
        );
      }

      case 'dateTime':
        return (
          <div key={prop.name}>
            <label htmlFor={id} className={labelClass}>
              {prop.displayName}
              {prop.required && <span className="text-[var(--st-text)] ml-0.5">*</span>}
            </label>
            <input
              id={id}
              type="datetime-local"
              value={typeof current === 'string' ? current : ''}
              onChange={(e) => setField(prop.name, e.target.value)}
              className={inputBase}
            />
            {prop.description && (
              <p className="mt-1 text-[10.5px] text-[var(--gray-8)]">{prop.description}</p>
            )}
          </div>
        );

      case 'color':
        return (
          <div key={prop.name}>
            <label htmlFor={id} className={labelClass}>
              {prop.displayName}
              {prop.required && <span className="text-[var(--st-text)] ml-0.5">*</span>}
            </label>
            <input
              id={id}
              type="color"
              value={typeof current === 'string' && current ? current : '#000000'}
              onChange={(e) => setField(prop.name, e.target.value)}
              className="h-9 w-16 cursor-pointer rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-1"
            />
          </div>
        );

      case 'collection':
        // Render child properties inline. A future revision can support
        // repeating collections; for now we render the schema once.
        return (
          <div
            key={prop.name}
            className="rounded-lg border border-[var(--gray-4)] bg-[var(--gray-2)]/40 p-3 space-y-3"
          >
            <div className="text-[11px] font-semibold text-[var(--gray-10)] uppercase tracking-wide">
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
        <div className="text-[13px] font-semibold text-[var(--gray-12)]">{descriptor.displayName}</div>
        {descriptor.description && (
          <p className="text-[11px] text-[var(--gray-8)] mt-0.5">{descriptor.description}</p>
        )}
      </div>

      {descriptor.stub && (() => {
        // Two presentations:
        //  • With fallback: this is a legacy descriptor whose modern
        //    SabFlow equivalent is ready. Show a friendly "Upgrade
        //    available" card with one-click swap as the primary action.
        //    Avoids the alarming "broken" language for the common case.
        //  • No fallback: rare. Surface the original warning so the user
        //    knows the descriptor is configurable but not executable.
        const fallback = getStubFallback(descriptor.name);
        if (fallback && onChangeBlockType) {
          return (
            <div className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2.5 text-[11.5px] dark:border-[var(--st-border)]/50 dark:bg-[var(--st-text)]/30">
              <div className="flex items-start gap-2">
                <LuSparkles
                  className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--st-text)] dark:text-[var(--st-text-secondary)]"
                  strokeWidth={2}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[var(--st-text)] dark:text-white">
                    Upgrade available — use{' '}
                    <span className="underline decoration-dotted underline-offset-2">
                      {fallback.label}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-[var(--st-text)]/85 dark:text-white/80">
                    {fallback.rationale}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => onChangeBlockType(fallback.forgeType)}
                  className="inline-flex items-center gap-1 rounded-md bg-[var(--st-text)] text-white px-2.5 py-1 text-[11px] font-semibold hover:bg-[var(--st-text)] transition-colors"
                >
                  Switch to {fallback.label}
                  <LuArrowRight className="h-3 w-3" strokeWidth={2.5} />
                </button>
              </div>
            </div>
          );
        }
        return (
          <div className="rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-[11.5px] text-[var(--st-text)] dark:border-[var(--st-border)]/50 dark:bg-[var(--st-text)]/30 dark:text-[var(--st-text-secondary)]">
            <div className="flex items-start gap-2">
              <LuTriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" strokeWidth={1.8} />
              <span>
                This descriptor is configurable but its executor is not yet
                shipped. The fields below test the schema only — the block
                will not run.
              </span>
            </div>
          </div>
        );
      })()}

      <div className="space-y-3">{descriptor.properties.map((p) => renderProperty(p))}</div>
    </div>
  );
}

export default NodeSettings;
