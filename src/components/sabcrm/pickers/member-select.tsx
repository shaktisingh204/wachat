'use client';

/**
 * SabCRM — MemberSelect.
 *
 * A workspace-member picker backed by {@link listMembersAction} (the finite,
 * auto-seeded member roster — no typeahead round-trips). Commits the member's
 * stable `userId`, which is exactly the value the assignment subsystem keys on
 * (`data.assigneeId`; see ASSIGNEE_FIELD in assignment.server.ts). Reused for
 * Tasks `assignee` and Projects `owner`.
 *
 * Callers that write a record's assignee should persist the committed id to
 * BOTH the relation field (`assignee`) AND `assigneeId` so assignment
 * notifications fire.
 */

import * as React from 'react';

import { Combobox, type ComboboxOption } from '@/components/sabcrm/20ui/combobox';
import { listMembersAction } from '@/app/actions/sabcrm.actions';

export interface MemberSelectProps {
  /** Selected member `userId`, or null when unassigned. */
  value: string | null;
  /** Fired with the picked member's `userId` + label (or null when cleared). */
  onChange: (userId: string | null, label: string | null) => void;
  projectId?: string | null;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
  'aria-label'?: string;
}

export function MemberSelect({
  value,
  onChange,
  projectId,
  placeholder = 'Assign to…',
  disabled,
  invalid,
  id,
  'aria-label': ariaLabel,
}: MemberSelectProps): React.JSX.Element {
  const [options, setOptions] = React.useState<ComboboxOption[]>([]);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await listMembersAction(projectId ?? undefined);
      if (cancelled) return;
      if (!res.ok) {
        // eslint-disable-next-line no-console -- surface the failure instead of a silent empty roster.
        console.error('[MemberSelect] failed to load members', res.error);
        setLoadError(res.error);
        setOptions([]);
        return;
      }
      setLoadError(null);
      setOptions(
        res.data.map((m) => ({
          value: m.userId,
          label: m.name || m.email || m.userId,
          description: m.name ? m.email : undefined,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <Combobox
      id={id}
      value={value}
      options={options}
      onChange={(next, option) => onChange(next || null, option?.label ?? null)}
      placeholder={placeholder}
      emptyText={loadError ?? 'No members'}
      disabled={disabled}
      invalid={invalid}
      aria-label={ariaLabel}
    />
  );
}
