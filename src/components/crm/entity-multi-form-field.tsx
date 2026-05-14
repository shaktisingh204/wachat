'use client';

/**
 * <EntityMultiFormField> — multi-select sibling of <EntityFormField>.
 *
 * Wraps <EntityPicker multi> and emits a single hidden input under
 * `name` whose value is a JSON-encoded array of selected ids. Optional
 * `dualWriteName` mirrors the picker's primary labels as a comma-joined
 * string for legacy callers still reading `*Names` columns.
 */

import * as React from 'react';
import { EntityPicker } from './entity-picker';
import type { EntityKey, LookupItem } from '@/lib/lookup-registry';

export interface EntityMultiFormFieldProps {
  entity: EntityKey;
  /** Form field name. Emits a single hidden input with JSON array body. */
  name: string;
  /** Initial ids. */
  initialIds?: string[];
  /** Initial labels for hydration display. */
  initialLabels?: string[];
  /** Optional sibling field name receiving comma-joined labels for legacy callers. */
  dualWriteName?: string;
  filter?: Record<string, unknown>;
  allowCreate?: boolean;
  inlineCreate?: boolean;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /**
   * Optional callback fired whenever the user picks/removes ids.
   * Mirrors the hidden-input value so consumers needing live updates
   * (e.g. apply buttons gated on a non-empty selection) can wire in
   * without DOM observation hacks.
   */
  onChange?: (ids: string[], hydrated?: LookupItem[]) => void;
}

export function EntityMultiFormField(props: EntityMultiFormFieldProps) {
  const [ids, setIds] = React.useState<string[]>(props.initialIds ?? []);
  const [labels, setLabels] = React.useState<string[]>(props.initialLabels ?? []);
  React.useEffect(() => {
    setIds(props.initialIds ?? []);
    if (!props.initialIds || props.initialIds.length === 0) setLabels(props.initialLabels ?? []);
  }, [props.initialIds, props.initialLabels]);

  return (
    <>
      <EntityPicker
        entity={props.entity}
        multi
        value={ids}
        onChange={(next, hydrated) => {
          const nextIds = Array.isArray(next) ? next : next ? [next as string] : [];
          setIds(nextIds);
          const hydratedArr = Array.isArray(hydrated)
            ? hydrated
            : hydrated
            ? [hydrated as LookupItem]
            : [];
          const labelsMap = new Map<string, string>();
          hydratedArr.forEach((h) => h && labelsMap.set(h.id, h.chip.primary));
          setLabels((prev) => nextIds.map((id, i) => labelsMap.get(id) ?? prev[i] ?? id));
          props.onChange?.(nextIds, hydratedArr);
        }}
        filter={props.filter}
        allowCreate={props.allowCreate}
        inlineCreate={props.inlineCreate}
        required={props.required}
        disabled={props.disabled}
        placeholder={props.placeholder}
      />
      <input type="hidden" name={props.name} value={JSON.stringify(ids)} />
      {props.dualWriteName ? (
        <input type="hidden" name={props.dualWriteName} value={labels.join(', ')} />
      ) : null}
    </>
  );
}

export default EntityMultiFormField;
