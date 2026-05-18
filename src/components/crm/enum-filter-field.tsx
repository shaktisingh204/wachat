'use client';

/**
 * <EnumFilterField> — filter-bar variant of <EnumFormField> that adds an
 * `id="all"` row at the top so list pages can use the picker as a single
 * source of selection for "all status / open / paid / overdue …" style
 * filter chips.
 *
 * Migration target: the many filter-bar `<ZoruSelect>` widgets that
 * carry an `'all'` sentinel — those don't fit `<EnumFormField>` cleanly
 * because `'all'` isn't a real catalogued enum value. The sweep agents
 * have been leaving `// TODO 1E.sweep: filter-with-all` comments on
 * these; this component is what those TODOs should switch to.
 *
 * Usage:
 *
 *   <EnumFilterField
 *     enumName="invoiceStatus"
 *     value={status}
 *     onChange={setStatus}
 *     allLabel="All statuses"
 *   />
 *
 * The picker emits `'all'` when the user clears or picks the All row;
 * consumers should treat `'all'` as "no filter applied". Inline-create
 * is intentionally OFF here — filter values must match the catalogued
 * set or the sentinel.
 */

import * as React from 'react';
import { EntityPicker } from './entity-picker';
import type { LookupItem } from '@/lib/lookup-registry';
import type { CrmEnumName } from '@/data/reference/crm-enums';

export interface EnumFilterFieldProps {
  enumName: CrmEnumName;
  /** Current value. `'all'` means "no filter". `null`/`undefined` also treated as all. */
  value?: string | null;
  onChange?: (value: string) => void;
  /** Label for the "All" sentinel row. Defaults to "All". */
  allLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Optional FormData name — only set when the picker is inside a `<form>` */
  name?: string;
}

const ALL_SENTINEL_ID = 'all';

export function EnumFilterField({
  enumName,
  value,
  onChange,
  allLabel = 'All',
  placeholder,
  disabled,
  name,
}: EnumFilterFieldProps) {
  const filter = React.useMemo(() => ({ enumName }), [enumName]);
  const internalValue = !value || value === ALL_SENTINEL_ID ? null : value;

  const handleChange = React.useCallback(
    (next: string | string[] | null, hydrated?: LookupItem | LookupItem[]) => {
      // Suppress unused-var lint for hydrated — caller doesn't need it here.
      void hydrated;
      const nextId = typeof next === 'string' ? next : null;
      onChange?.(nextId ?? ALL_SENTINEL_ID);
    },
    [onChange],
  );

  return (
    <>
      <EntityPicker
        entity="enum"
        value={internalValue}
        onChange={handleChange}
        filter={filter}
        allowCreate={false}
        inlineCreate={false}
        disabled={disabled}
        placeholder={placeholder ?? allLabel}
      />
      {name ? <input type="hidden" name={name} value={value ?? ALL_SENTINEL_ID} /> : null}
    </>
  );
}

export default EnumFilterField;
