'use client';

import type { Variable } from '@/lib/sabflow/types';
import { selectClass } from './primitives';

type Props = {
  variables: Variable[];
  value?: string;
  onChange: (variableId: string | undefined) => void;
  placeholder?: string;
};

/**
 * A <select> that lists all flow-level variables.
 * The first option is a blank "— none —" option.
 */
export function VariableSelect({
  variables,
  value,
  onChange,
  placeholder = '— none —',
}: Props) {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={selectClass}
    >
      <option value="">{placeholder}</option>
      {variables.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </select>
  );
}
