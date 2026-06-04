'use client';

/**
 * SabCRM — Twenty-style floating selection / bulk-action bar.
 *
 * Surfaces once one or more records are checked in the table. It mirrors
 * Twenty's bottom action bar (`object-record/record-index` action menu): a
 * "{n} selected" count followed by the canonical record bulk actions —
 *
 *   - Delete (with an inline confirm step)
 *   - Set {field}  — bulk-set the object's first SELECT field
 *   - Move to {stage} — bulk-set the board group-by / stage SELECT field
 *   - Add tag — apply one workspace tag to every selected record
 *   - Export — download the selected records as a CSV (client-side, no backend)
 *
 * This component is presentational + state-light: it owns its local popovers,
 * "busy" flags, and confirm toggle, but the actual mutations live in the parent
 * page (which holds the optimistic record list and persists through the gated
 * `bulkUpdateRecordsTw` / `bulkDeleteRecordsTw` actions). All `.st-*` look, no
 * ZoruUI.
 */

import * as React from 'react';
import {
  Trash2,
  X,
  Loader2,
  Pencil,
  Tag as TagIcon,
  Download,
  GitBranch,
} from 'lucide-react';

import { TwentyButton } from '@/components/sabcrm/twenty';
import type { FieldMetadata } from '@/lib/sabcrm/types';
import type { SabcrmRustTag } from '@/app/actions/sabcrm-tags.actions.types';

export interface SabcrmBulkBarProps {
  /** Number of currently-selected records. */
  count: number;
  /** SELECT field offered for the generic bulk-edit, or `undefined` if none. */
  editField: FieldMetadata | undefined;
  /**
   * The board group-by / stage SELECT field, offered as a dedicated "Move to
   * stage" action. Often the same as {@link editField}; when it is, only the
   * stage control is rendered (we don't duplicate the same SELECT twice).
   */
  stageField?: FieldMetadata;
  /** Workspace tag definitions for the "Add tag" picker. */
  tags: SabcrmRustTag[];
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
  /** Set `stageField` to `value` on all selected records (move stage). */
  onMoveStage?: (value: string) => void;
  /** Add tag `tagId` to every selected record (merged into each `__tags`). */
  onAddTag?: (tagId: string) => void;
  /** Export the currently-selected records (client-side CSV download). */
  onExport?: () => void;
}

/** A small dropdown of SELECT options shared by the "Set" + "Move stage" pickers. */
interface FieldPickerProps {
  field: FieldMetadata;
  label: React.ReactNode;
  disabled: boolean;
  pendingLabel: string;
  onPick: (value: string) => void;
}

function FieldPicker({ field, label, disabled, pendingLabel, onPick }: FieldPickerProps) {
  return (
    <label className="st-selbar__field">
      <span className="st-selbar__field-label">{label}</span>
      <select
        className="st-selbar__select"
        defaultValue=""
        disabled={disabled}
        aria-label={typeof label === 'string' ? label : 'Set field'}
        onChange={(e) => {
          const v = e.target.value;
          // Reset the control so the same value can be re-applied later.
          e.target.value = '';
          if (v !== '') onPick(v);
        }}
      >
        <option value="" disabled>
          {disabled ? pendingLabel : 'Choose…'}
        </option>
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** A "+" button that opens a checklist popover of workspace tags to apply. */
interface TagPickerProps {
  tags: SabcrmRustTag[];
  disabled: boolean;
  onPick: (tagId: string) => void;
}

function chipColor(color?: string): string | undefined {
  if (!color) return undefined;
  if (color.startsWith('#') || color.startsWith('rgb')) return color;
  if (color.startsWith('--')) return `var(${color})`;
  return undefined;
}

function TagPicker({ tags, disabled, onPick }: TagPickerProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="st-selbar__anchor" ref={ref}>
      <TwentyButton
        variant="ghost"
        icon={TagIcon}
        disabled={disabled}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Add tag
      </TwentyButton>
      {open && (
        <div className="st-selbar__pop st-selbar__pop--up" role="menu" aria-label="Add tag">
          <p className="st-selbar__pop-title">Add tag to selected</p>
          {tags.length === 0 ? (
            <div className="st-selbar__pop-empty">No tags defined yet.</div>
          ) : (
            <div className="st-selbar__pop-list">
              {tags.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  role="menuitem"
                  className="st-selbar__opt"
                  onClick={() => {
                    onPick(t.id);
                    setOpen(false);
                  }}
                >
                  <span
                    className="st-selbar__opt-dot"
                    style={
                      chipColor(t.color) ? { background: chipColor(t.color) } : undefined
                    }
                    aria-hidden="true"
                  />
                  <span className="st-selbar__opt-label">{t.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SabcrmBulkBar({
  count,
  editField,
  stageField,
  tags,
  deleting,
  updating,
  onClear,
  onDelete,
  onBulkSet,
  onMoveStage,
  onAddTag,
  onExport,
}: SabcrmBulkBarProps): React.JSX.Element | null {
  const [confirming, setConfirming] = React.useState(false);
  const busy = deleting || updating;

  // Drop the pending confirm if the selection is cleared/changes away.
  React.useEffect(() => {
    if (count === 0) setConfirming(false);
  }, [count]);

  if (count === 0) return null;

  // Don't render the generic "Set" picker when it would duplicate the dedicated
  // "Move to stage" picker (same underlying SELECT field).
  const showGenericSet =
    !!editField && (!stageField || editField.key !== stageField.key);
  const showMoveStage = !!stageField && !!onMoveStage;

  return (
    <div className="st-selbar" role="region" aria-label="Bulk actions">
      <span className="st-selbar__count">
        {count} <em>selected</em>
      </span>

      <span className="st-selbar__sep" aria-hidden="true" />

      <div className="st-selbar__actions">
        {showGenericSet && editField ? (
          <FieldPicker
            field={editField}
            label={
              <>
                <Pencil size={12} aria-hidden="true" /> Set {editField.label}
              </>
            }
            disabled={busy}
            pendingLabel={updating ? 'Updating…' : 'Choose…'}
            onPick={onBulkSet}
          />
        ) : null}

        {showMoveStage && stageField ? (
          <FieldPicker
            field={stageField}
            label={
              <>
                <GitBranch size={12} aria-hidden="true" /> Move to {stageField.label}
              </>
            }
            disabled={busy}
            pendingLabel={updating ? 'Moving…' : 'Choose…'}
            onPick={(v) => onMoveStage?.(v)}
          />
        ) : null}

        {onAddTag ? (
          <TagPicker tags={tags} disabled={busy} onPick={onAddTag} />
        ) : null}

        {onExport ? (
          <TwentyButton variant="ghost" icon={Download} disabled={busy} onClick={onExport}>
            Export
          </TwentyButton>
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
