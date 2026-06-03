'use client';

/**
 * SabCRM — Twenty-style floating selection bar.
 *
 * Surfaces once one or more records are checked in the table. It mirrors
 * Twenty's bottom action bar: a "{n} selected" count, a Delete action (with a
 * confirm step), and — when the object exposes a SELECT field — an inline
 * "Set {field}" dropdown that bulk-edits every picked record.
 *
 * This component is presentational + state-light: it owns its local "busy"
 * flags and confirm toggle, but the actual mutations live in the parent page
 * (which holds the optimistic record list). All `.st-*` look, no ZoruUI.
 */

import * as React from 'react';
import { Trash2, X, Loader2, Pencil } from 'lucide-react';

import { TwentyButton } from '@/components/sabcrm/twenty';
import type { FieldMetadata } from '@/lib/sabcrm/types';

export interface SabcrmBulkBarProps {
  /** Number of currently-selected records. */
  count: number;
  /** SELECT field offered for bulk-edit, or `undefined` if none applies. */
  editField: FieldMetadata | undefined;
  /** True while a delete request is in flight. */
  deleting: boolean;
  /** True while a bulk-update request is in flight. */
  updating: boolean;
  /** Clear the current selection. */
  onClear: () => void;
  /** Confirmed delete of all selected records. */
  onDelete: () => void;
  /** Set `editField` to `value` on all selected records. */
  onBulkSet: (value: string) => void;
}

export function SabcrmBulkBar({
  count,
  editField,
  deleting,
  updating,
  onClear,
  onDelete,
  onBulkSet,
}: SabcrmBulkBarProps): React.JSX.Element | null {
  const [confirming, setConfirming] = React.useState(false);
  const busy = deleting || updating;

  // Drop the pending confirm if the selection is cleared/changes away.
  React.useEffect(() => {
    if (count === 0) setConfirming(false);
  }, [count]);

  if (count === 0) return null;

  return (
    <div className="st-selbar" role="region" aria-label="Bulk actions">
      <span className="st-selbar__count">
        {count} <em>selected</em>
      </span>

      <span className="st-selbar__sep" aria-hidden="true" />

      <div className="st-selbar__actions">
        {editField ? (
          <label className="st-selbar__field">
            <span className="st-selbar__field-label">
              <Pencil size={12} aria-hidden="true" /> Set {editField.label}
            </span>
            <select
              className="st-selbar__select"
              defaultValue=""
              disabled={busy}
              aria-label={`Set ${editField.label} on ${count} selected`}
              onChange={(e) => {
                const v = e.target.value;
                // Reset the control so the same value can be re-applied later.
                e.target.value = '';
                if (v !== '') onBulkSet(v);
              }}
            >
              <option value="" disabled>
                {updating ? 'Updating…' : 'Choose…'}
              </option>
              {(editField.options ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {confirming ? (
          <>
            <span className="st-selbar__field-label">Delete {count}?</span>
            <button
              type="button"
              className="st-btn st-btn--danger"
              disabled={busy}
              onClick={() => onDelete()}
            >
              {deleting ? <Loader2 size={14} className="st-spin" /> : <Trash2 size={14} />}
              Confirm
            </button>
            <TwentyButton
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </TwentyButton>
          </>
        ) : (
          <TwentyButton
            variant="ghost"
            icon={Trash2}
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            Delete
          </TwentyButton>
        )}
      </div>

      <button
        type="button"
        className="st-selbar__close"
        aria-label="Clear selection"
        title="Clear selection"
        disabled={busy}
        onClick={() => onClear()}
      >
        <X size={15} />
      </button>
    </div>
  );
}

export default SabcrmBulkBar;
