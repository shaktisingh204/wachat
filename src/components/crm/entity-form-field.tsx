'use client';

/**
 * <EntityFormField> — controlled <EntityPicker> wrapper meant for direct
 * use inside any FormData-driven form (server-action or otherwise).
 *
 * Renders the picker plus two hidden inputs so the form's FormData
 * carries both the entity id (under `name`) and, when `dualWriteName`
 * is provided, the picker's primary label (under that name). The
 * dual-write hidden input keeps legacy `*Name` columns populated during
 * the ID-migration window so the backend can switch over gradually.
 *
 * `EntityPicker` is itself controlled — this wrapper just owns the
 * single-string state and surfaces it to the surrounding form.
 */

import * as React from 'react';
import { EntityPicker } from './entity-picker';
import type { EntityKey, LookupItem } from '@/lib/lookup-registry';

export interface EntityFormFieldProps {
  /** Lookup entity key — passed straight through to <EntityPicker>. */
  entity: EntityKey;
  /** Form field name for the id hidden input. */
  name: string;
  /** Optional sibling field name to mirror the picker's primary label. */
  dualWriteName?: string;
  /** Initial id (used both for hydration and as defaultValue). */
  initialId?: string | null;
  /** Initial label shown if hydration is slow. Optional. */
  initialLabel?: string;
  /** Static filter passed to the lookup query. */
  filter?: Record<string, unknown>;
  /** Show "Create new" item. Auto-on for reference entities. */
  allowCreate?: boolean;
  /** Disable inline-create for reference entities. */
  inlineCreate?: boolean;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Fires whenever the user picks/clears a value. */
  onChange?: (id: string | null, hydrated?: LookupItem) => void;
}

export function EntityFormField({
  entity,
  name,
  dualWriteName,
  initialId,
  initialLabel,
  filter,
  allowCreate,
  inlineCreate,
  required,
  disabled,
  placeholder,
  onChange,
}: EntityFormFieldProps) {
  const [id, setId] = React.useState<string | null>(initialId ?? null);
  const [label, setLabel] = React.useState<string>(initialLabel ?? '');

  React.useEffect(() => {
    setId(initialId ?? null);
    if (!initialId) setLabel(initialLabel ?? '');
  }, [initialId, initialLabel]);

  return (
    <>
      <EntityPicker
        entity={entity}
        value={id}
        onChange={(next, hydrated) => {
          const nextId = (next as string | null) ?? null;
          setId(nextId);
          const h = Array.isArray(hydrated)
            ? hydrated[0]
            : (hydrated as LookupItem | undefined);
          const nextLabel = h?.chip.primary ?? (typeof next === 'string' ? next : '');
          setLabel(nextLabel);
          onChange?.(nextId, h);
        }}
        filter={filter}
        allowCreate={allowCreate}
        inlineCreate={inlineCreate}
        required={required}
        disabled={disabled}
        placeholder={placeholder}
      />
      <input type="hidden" name={name} value={id ?? ''} />
      {dualWriteName ? (
        <input type="hidden" name={dualWriteName} value={label} />
      ) : null}
    </>
  );
}

export default EntityFormField;
