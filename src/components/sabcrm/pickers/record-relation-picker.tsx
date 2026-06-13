'use client';

/**
 * SabCRM — RecordRelationPicker.
 *
 * A reusable async picker over any SabCRM object (people / companies / leads /
 * workspaceMembers …), backed by the Rust records engine through
 * {@link searchSabcrmRecordOptionsTw}. Labels are computed server-side so a raw
 * record id never renders. Wraps the doc-surface {@link EntityPicker} (which
 * caches picked labels) so a committed value always shows a name, never an id.
 *
 * Use this for every relationship field on the metadata-driven CRM objects
 * (Tasks / Notes / Projects). For workspace-member assignment prefer
 * {@link MemberSelect}, which loads the finite member roster.
 */

import * as React from 'react';

import { EntityPicker } from '@/app/sabcrm/finance/_components/doc-surface/entity-picker';
import type { DocEntityOption } from '@/app/sabcrm/finance/_components/doc-surface/types';
import { searchSabcrmRecordOptionsTw } from '@/app/actions/sabcrm-twenty.actions';

export interface RecordRelationPickerProps {
  /** Target object slug (e.g. `'people'`, `'companies'`, `'leads'`). */
  object: string;
  /** Selected record id, or null. */
  value: string | null;
  /** Display label for `value` (edit mode) so the closed input shows a name. */
  valueLabel?: string | null;
  /** Fired with the picked option (or null when cleared). */
  onChange: (option: DocEntityOption | null) => void;
  /** Active project scope. */
  projectId?: string | null;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  'aria-label'?: string;
}

export function RecordRelationPicker({
  object,
  value,
  valueLabel,
  onChange,
  projectId,
  placeholder = 'Search records…',
  disabled,
  invalid,
  id,
  'aria-label': ariaLabel,
}: RecordRelationPickerProps): React.JSX.Element {
  // Stable fetcher so the underlying Combobox effect doesn't re-fire on every
  // parent render. Errors propagate; EntityPicker surfaces + logs them.
  const search = React.useCallback(
    async (q: string): Promise<DocEntityOption[]> => {
      const res = await searchSabcrmRecordOptionsTw(
        object,
        q,
        20,
        projectId ?? undefined,
      );
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    [object, projectId],
  );

  return (
    <EntityPicker
      value={value}
      valueLabel={valueLabel}
      onChange={onChange}
      search={search}
      placeholder={placeholder}
      disabled={disabled}
      invalid={invalid}
      id={id}
      aria-label={ariaLabel}
    />
  );
}
