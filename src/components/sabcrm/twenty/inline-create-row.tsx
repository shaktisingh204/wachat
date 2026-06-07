'use client';

/**
 * SabCRM — Twenty-faithful inline "create record" table row.
 *
 * Renders as the last `<tr>` of the record-index table (mirroring Twenty's
 * `RecordTableNoRecordGroupAddNew` "+ Add record" affordance, but as an inline
 * editable row instead of a button-then-blank-row). The user types the new
 * record's NAME into the label column and presses Enter to commit:
 *
 *   - Enter (with a non-empty draft) → `onCommit(name)` is invoked, which the
 *     page wires to `createSabcrmRecordTw` (optimistic — the page inserts a
 *     placeholder row immediately and reconciles with the engine's record).
 *   - Enter on an EMPTY draft is a no-op (matches Twenty — no blank records).
 *   - Escape blurs / clears the draft.
 *   - The row keeps focus after a successful commit so the user can keep adding
 *     records rapidly (Twenty's "type, Enter, type, Enter" flow).
 *
 * This is pure presentation + local draft state — all persistence + optimism
 * lives in the page so it can roll back gracefully when the Rust engine is DOWN.
 * Uses ONLY the `.st-*` / `.stx-*` design language (NO Ui20).
 */

import * as React from 'react';
import { Plus, Loader2 } from 'lucide-react';

import './inline-create-row.css';

export interface InlineCreateRowProps {
  /**
   * Total number of leading data columns the typed cell + hint should span
   * across (the page passes the same `colSpan` the footer/group rows use:
   * selection + favorite + tags + every visible field column).
   */
  colSpan: number;
  /** Human label of the field the typed value seeds (e.g. "Name"). */
  labelFieldLabel: string;
  /** Singular object label, used for the placeholder + a11y ("New Company"). */
  objectLabelSingular: string;
  /**
   * Commit a new record from the typed name. Resolves to `true` when the create
   * succeeded (the row then clears its draft and re-focuses for the next entry)
   * and `false` when it failed (the draft is preserved so the user can retry).
   */
  onCommit: (name: string) => Promise<boolean>;
  /**
   * Bound ref so the page can focus the typed cell from the `c` keyboard
   * shortcut. Optional — the row is fully usable without it.
   */
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

/**
 * One inline create row. Mount it as the final `<tr>` inside the table `<tbody>`
 * (the parent owns the `<table>`, so this component returns a `<tr>`).
 */
export function InlineCreateRow({
  colSpan,
  labelFieldLabel,
  objectLabelSingular,
  onCommit,
  inputRef,
}: InlineCreateRowProps): React.JSX.Element {
  const [draft, setDraft] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const localRef = React.useRef<HTMLInputElement | null>(null);

  // Use the caller's ref when supplied (so the `c` shortcut can focus us),
  // otherwise fall back to a local one.
  const setRef = React.useCallback(
    (el: HTMLInputElement | null) => {
      localRef.current = el;
      if (inputRef) inputRef.current = el;
    },
    [inputRef],
  );

  const commit = React.useCallback(async () => {
    const name = draft.trim();
    if (!name || saving) return;
    setSaving(true);
    const ok = await onCommit(name);
    setSaving(false);
    if (ok) {
      setDraft('');
      // Keep focus so the user can keep adding records back-to-back.
      localRef.current?.focus();
    }
  }, [draft, saving, onCommit]);

  return (
    <tr
      className="stx-create-row"
      // Don't let this row participate in row-cursor parking / selection.
      onMouseDown={(e) => e.stopPropagation()}
    >
      <td className="stx-create-row__cell" colSpan={colSpan}>
        <span className="stx-create-row__inner">
          <span className="stx-create-row__icon" aria-hidden="true">
            {saving ? (
              <Loader2 size={14} className="stx-create-row__spin" />
            ) : (
              <Plus size={14} />
            )}
          </span>
          <input
            ref={setRef}
            className="stx-create-row__input"
            type="text"
            value={draft}
            disabled={saving}
            placeholder={`Add ${objectLabelSingular.toLowerCase()}…`}
            aria-label={`New ${objectLabelSingular} — type a ${labelFieldLabel.toLowerCase()} and press Enter`}
            // Typing here must never bubble into the table's keyboard nav.
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                void commit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setDraft('');
                (e.currentTarget as HTMLInputElement).blur();
              }
            }}
            onChange={(e) => setDraft(e.target.value)}
          />
          {draft.trim() && !saving && (
            <span className="stx-create-row__hint" aria-hidden="true">
              Press
              <span className="stx-kbd">↵</span>
              to create
            </span>
          )}
        </span>
      </td>
    </tr>
  );
}

export default InlineCreateRow;
