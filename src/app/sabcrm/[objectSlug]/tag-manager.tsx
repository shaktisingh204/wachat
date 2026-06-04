'use client';

/**
 * TagManagerDialog — create / rename / recolour / delete workspace tags from
 * the SabCRM list surface.
 *
 * Tags are workspace-scoped label definitions ({@link SabcrmRustTag}); records
 * carry applied tag ids on `data.__tags`. This dialog is the CRUD surface the
 * user asked for, with the key rule that a tag still applied to any record
 * cannot be deleted — that guard lives server-side in `deleteTagTw`, and the
 * blocking message it returns is surfaced here.
 */

import * as React from 'react';
import { X, Plus, Trash2, Check } from 'lucide-react';

import { TwentyButton } from '@/components/sabcrm/twenty';
import { StSelect, type StSelectOption } from '@/components/sabcrm/twenty/st-select';
import { TWENTY_PALETTE } from '@/components/sabcrm/twenty/twenty-palette';
import { useStConfirm } from '@/components/sabcrm/twenty/st-modals';
import {
  createTagTw,
  updateTagTw,
  deleteTagTw,
} from '@/app/actions/sabcrm-tags.actions';
import type { SabcrmRustTag } from '@/app/actions/sabcrm-tags.actions.types';

interface TagManagerDialogProps {
  tags: SabcrmRustTag[];
  projectId: string | null;
  onClose: () => void;
  /** Called after any successful mutation so the parent reloads its tag list. */
  onChanged: () => void;
}

/** Colour palette options (hex values so `chipColor` paints them directly). */
const COLOR_OPTIONS: StSelectOption[] = Array.from(
  new Map(Object.entries(TWENTY_PALETTE).map(([name, hex]) => [hex, name])).entries(),
).map(([hex, name]) => ({
  value: hex,
  label: name.charAt(0).toUpperCase() + name.slice(1),
  color: hex,
}));

const DEFAULT_COLOR = COLOR_OPTIONS[0]?.value ?? '#3dab5a';

export function TagManagerDialog({
  tags,
  projectId,
  onClose,
  onChanged,
}: TagManagerDialogProps): React.JSX.Element {
  const { confirm, dialog } = useStConfirm();
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // New-tag draft.
  const [newName, setNewName] = React.useState('');
  const [newColor, setNewColor] = React.useState(DEFAULT_COLOR);
  const [creating, setCreating] = React.useState(false);

  const pid = projectId ?? undefined;

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    setError(null);
    const res = await createTagTw({ name, color: newColor }, pid);
    setCreating(false);
    if (res.ok) {
      setNewName('');
      setNewColor(DEFAULT_COLOR);
      onChanged();
    } else {
      setError(res.error);
    }
  };

  const handleRename = async (tag: SabcrmRustTag, name: string) => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === tag.name) return;
    setBusyId(tag.id);
    setError(null);
    const res = await updateTagTw(tag.id, { name: trimmed }, pid);
    setBusyId(null);
    if (res.ok) onChanged();
    else setError(res.error);
  };

  const handleRecolour = async (tag: SabcrmRustTag, color: string) => {
    if (!color || color === tag.color) return;
    setBusyId(tag.id);
    setError(null);
    const res = await updateTagTw(tag.id, { color }, pid);
    setBusyId(null);
    if (res.ok) onChanged();
    else setError(res.error);
  };

  const handleDelete = async (tag: SabcrmRustTag) => {
    const ok = await confirm({
      title: `Delete "${tag.name}"?`,
      message:
        'The tag will be removed from the workspace. Tags still applied to records cannot be deleted.',
      destructive: true,
      confirmLabel: 'Delete tag',
    });
    if (!ok) return;
    setBusyId(tag.id);
    setError(null);
    const res = await deleteTagTw(tag.id, pid);
    setBusyId(null);
    if (res.ok) onChanged();
    else setError(res.error); // e.g. "This tag is assigned to 3 records…"
  };

  return (
    <div className="st-dialog-overlay" onClick={onClose} role="presentation">
      <div
        className="st-dialog st-dialog--sm"
        role="dialog"
        aria-modal="true"
        aria-label="Manage tags"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Manage tags</h2>
          <button
            type="button"
            className="st-dialog__close"
            aria-label="Close"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        <div className="st-dialog__body">
        {error ? <div className="st-banner">{error}</div> : null}

        {/* Create row */}
        <div className="stg-mgr__create">
          <input
            className="st-input"
            placeholder="New tag name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate();
            }}
          />
          <div className="stg-mgr__color">
            <StSelect
              value={newColor}
              onChange={setNewColor}
              options={COLOR_OPTIONS}
              ariaLabel="New tag colour"
            />
          </div>
          <TwentyButton
            variant="primary"
            icon={Plus}
            onClick={() => void handleCreate()}
            disabled={!newName.trim() || creating}
          >
            Add
          </TwentyButton>
        </div>

        {/* Existing tags */}
        <div className="stg-mgr__list">
          {tags.length === 0 ? (
            <div className="stg-pop__empty">No tags yet — add one above.</div>
          ) : (
            tags.map((tag) => (
              <TagRow
                key={tag.id}
                tag={tag}
                busy={busyId === tag.id}
                onRename={(name) => void handleRename(tag, name)}
                onRecolour={(color) => void handleRecolour(tag, color)}
                onDelete={() => void handleDelete(tag)}
              />
            ))
          )}
        </div>
        </div>
      </div>
      {dialog}
    </div>
  );
}

interface TagRowProps {
  tag: SabcrmRustTag;
  busy: boolean;
  onRename: (name: string) => void;
  onRecolour: (color: string) => void;
  onDelete: () => void;
}

function TagRow({ tag, busy, onRename, onRecolour, onDelete }: TagRowProps): React.JSX.Element {
  const [name, setName] = React.useState(tag.name);
  React.useEffect(() => setName(tag.name), [tag.name]);
  const dirty = name.trim() !== tag.name && name.trim().length > 0;

  return (
    <div className="stg-mgr__row">
      <input
        className="st-input"
        value={name}
        disabled={busy}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => dirty && onRename(name)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && dirty) onRename(name);
        }}
      />
      <div className="stg-mgr__color">
        <StSelect
          value={tag.color}
          onChange={onRecolour}
          options={COLOR_OPTIONS}
          ariaLabel={`Colour for ${tag.name}`}
          disabled={busy}
        />
      </div>
      {dirty ? (
        <button
          type="button"
          className="stg-mgr__save"
          aria-label="Save name"
          onClick={() => onRename(name)}
          disabled={busy}
        >
          <Check size={15} />
        </button>
      ) : null}
      <button
        type="button"
        className="stg-mgr__del"
        aria-label={`Delete ${tag.name}`}
        onClick={onDelete}
        disabled={busy}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export default TagManagerDialog;
