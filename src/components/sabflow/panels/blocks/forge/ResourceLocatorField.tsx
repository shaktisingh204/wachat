/**
 * Renderer for `type: 'resourceLocator'` fields.
 *
 * Shows a tab strip per declared mode (list / id / url) and swaps the input
 * shape accordingly. The persisted value is `{ mode, value }` so the editor
 * remembers which tab the user picked. The runtime executor + load-options
 * route both normalise this into a plain string id via `extractValue`, so
 * action authors keep reading `ctx.options.<field> as string`.
 *
 * Mirrors the n8n editor's resourceLocator picker.
 */
'use client';

import { useMemo } from 'react';
import type {
  ForgeField,
  ForgeFieldMode,
  ForgeSelectOption,
  ResourceLocatorValue,
} from '@/lib/sabflow/forge/types';
import { isResourceLocatorValue } from '@/lib/sabflow/forge/extractValue';
import { inputClass, selectClass } from '../shared/primitives';
import { useLoadOptions } from './useLoadOptions';
import { cn } from '@/lib/utils';

type Props = {
  field: ForgeField;
  value: unknown;
  onChange: (value: ResourceLocatorValue) => void;
  blockId: string;
  actionId?: string;
  credentialId?: string;
  options: Record<string, unknown>;
};

/** Normalise the persisted value into a usable {mode, value} envelope. */
function rehydrate(
  v: unknown,
  modes: ForgeFieldMode[],
): ResourceLocatorValue {
  if (isResourceLocatorValue(v)) return v;
  const fallbackMode = modes[0]?.name ?? 'id';
  return {
    mode: fallbackMode,
    value: typeof v === 'string' ? v : '',
  };
}

export function ResourceLocatorField({
  field,
  value,
  onChange,
  blockId,
  actionId,
  credentialId,
  options,
}: Props) {
  const modes = field.modes ?? [];
  const current = rehydrate(value, modes);
  const activeMode = modes.find((m) => m.name === current.mode) ?? modes[0];

  // Only fetch options when the active tab is the list mode AND the field
  // declares a loadOptions resolver. Avoids unnecessary network round-trips
  // while the user is typing in url/id mode.
  const isListMode = activeMode?.type === 'list';
  const { items: remote, loading, error } = useLoadOptions({
    blockId,
    actionId,
    field,
    options,
    credentialId,
  });

  // Validation only applies to string modes that declared a regex.
  const validationError = useMemo(() => {
    if (activeMode?.type !== 'string' || !activeMode.validation) return null;
    if (!current.value) return null;
    try {
      return new RegExp(activeMode.validation.regex).test(current.value)
        ? null
        : activeMode.validation.errorMessage;
    } catch {
      return null;
    }
  }, [activeMode, current.value]);

  const switchMode = (next: ForgeFieldMode) => {
    // Switching modes clears the value — n8n behaviour. Stops a URL pasted
    // in URL mode from leaking into ID mode and producing a bogus id.
    if (next.name === current.mode) return;
    onChange({ mode: next.name, value: '' });
  };

  if (modes.length === 0) {
    // Defensive: a field declared as resourceLocator with no modes shouldn't
    // ship, but if it does, fall back to a plain text input so the editor
    // doesn't crash.
    return (
      <input
        type="text"
        className={inputClass}
        value={current.value}
        onChange={(e) => onChange({ mode: 'id', value: e.target.value })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {modes.length > 1 && (
        <div
          role="tablist"
          aria-label={`${field.label} input mode`}
          className="inline-flex items-center gap-1 self-start rounded bg-[var(--gray-3)] p-0.5"
        >
          {modes.map((m) => {
            const active = m.name === current.mode;
            return (
              <button
                key={m.name}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchMode(m)}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                  active
                    ? 'bg-[var(--gray-1)] text-[var(--gray-12)] shadow-sm'
                    : 'text-[var(--gray-10)] hover:text-[var(--gray-12)]',
                )}
              >
                {m.displayName}
              </button>
            );
          })}
        </div>
      )}

      {isListMode ? (
        <div className="relative">
          <select
            className={selectClass}
            value={current.value}
            onChange={(e) => onChange({ mode: current.mode, value: e.target.value })}
            disabled={loading && (!remote || remote.length === 0)}
            required={field.required}
          >
            <option value="">
              {loading ? 'Loading…' : field.placeholder ?? 'Select…'}
            </option>
            {(remote ?? field.options ?? []).map((opt: ForgeSelectOption) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input
          type="text"
          className={inputClass}
          value={current.value}
          onChange={(e) => onChange({ mode: current.mode, value: e.target.value })}
          placeholder={activeMode?.placeholder ?? field.placeholder}
          required={field.required}
          spellCheck={false}
        />
      )}

      {error && (
        <p className="text-[11px] text-[var(--red-10)] leading-snug">{error}</p>
      )}
      {validationError && (
        <p className="text-[11px] text-[var(--amber-10)] leading-snug">
          {validationError}
        </p>
      )}
    </div>
  );
}
