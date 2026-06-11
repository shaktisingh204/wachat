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

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type {
  ForgeField,
  ForgeFieldMode,
  ForgeSelectOption,
  ResourceLocatorValue,
} from '@/lib/sabflow/forge/types';
import { isResourceLocatorValue } from '@/lib/sabflow/forge/extractValue';
import {
  Button,
  Input,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type SegmentedItem,
} from '@/components/sabcrm/20ui';
import { useLoadOptions } from './useLoadOptions';

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
  // Typeahead text, forwarded to the resolver as `ctx.filter`. Empty
  // string means "no filter applied". The hook debounces internally
  // (250ms) so each keystroke does not hit the network.
  const [search, setSearch] = useState('');
  const { items: remote, loading, error, hasMore, loadMore } = useLoadOptions({
    blockId,
    actionId,
    field,
    options,
    credentialId,
    filter: isListMode ? search : undefined,
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

  const switchMode = (nextName: string) => {
    // Switching modes clears the value, n8n behaviour. Stops a URL pasted
    // in URL mode from leaking into ID mode and producing a bogus id.
    if (nextName === current.mode) return;
    onChange({ mode: nextName as typeof current.mode, value: '' });
  };

  if (modes.length === 0) {
    // Defensive: a field declared as resourceLocator with no modes shouldn't
    // ship, but if it does, fall back to a plain text input so the editor
    // doesn't crash.
    return (
      <Input
        type="text"
        value={current.value}
        onChange={(e) => onChange({ mode: 'id', value: e.target.value })}
        aria-label={field.label}
      />
    );
  }

  const modeItems: SegmentedItem[] = modes.map((m) => ({
    value: m.name,
    label: m.displayName,
  }));

  const listOptions = remote ?? field.options ?? [];

  return (
    <div className="flex flex-col gap-1.5">
      {modes.length > 1 && (
        <SegmentedControl
          size="sm"
          items={modeItems}
          value={current.mode}
          onChange={switchMode}
          aria-label={`${field.label} input mode`}
        />
      )}

      {isListMode ? (
        <div className="flex flex-col gap-1.5">
          <Input
            type="text"
            inputSize="sm"
            iconLeft={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              field.placeholder
                ? `Search ${field.placeholder.toLowerCase()}...`
                : 'Search...'
            }
            spellCheck={false}
            aria-label={`Search ${field.label}`}
          />
          <Select
            value={current.value || undefined}
            onValueChange={(v) => onChange({ mode: current.mode, value: v })}
            disabled={loading && listOptions.length === 0}
            required={field.required}
          >
            <SelectTrigger aria-label={field.label}>
              <SelectValue
                placeholder={loading ? 'Loading...' : field.placeholder ?? 'Select...'}
              />
            </SelectTrigger>
            <SelectContent>
              {listOptions.map((opt: ForgeSelectOption) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={loadMore}
              loading={loading}
              className="self-start"
            >
              {loading ? 'Loading...' : 'Load more'}
            </Button>
          )}
        </div>
      ) : (
        <Input
          type="text"
          inputSize="sm"
          value={current.value}
          onChange={(e) => onChange({ mode: current.mode, value: e.target.value })}
          placeholder={activeMode?.placeholder ?? field.placeholder}
          required={field.required}
          invalid={Boolean(validationError)}
          spellCheck={false}
          aria-label={field.label}
        />
      )}

      {error && (
        <p className="text-[11px] leading-snug text-[var(--st-danger)]">{error}</p>
      )}
      {validationError && (
        <p className="text-[11px] leading-snug text-[var(--st-warn)]">
          {validationError}
        </p>
      )}
    </div>
  );
}
