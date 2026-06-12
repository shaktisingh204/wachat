'use client';

/**
 * TagManagerDialog — create / rename / recolour / delete workspace tags from
 * the SabCRM list surface. 20ui only (`@/components/sabcrm/20ui`), plus the
 * sibling `tag-manager.css` for the dialog-local layout bits (`.stgm-*`,
 * scoped to the 20ui root).
 *
 * Tags are workspace-scoped label definitions ({@link SabcrmRustTag}); records
 * carry applied tag ids on `data.__tags`. This dialog is the CRUD surface the
 * user asked for, with the key rule that a tag still applied to any record
 * cannot be deleted — that guard lives server-side in `deleteTagTw`, and the
 * blocking message it returns is surfaced here.
 */

import * as React from 'react';
import { Plus, Trash2, Check } from 'lucide-react';

import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  Modal,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/sabcrm/20ui';
import {
  createTagTw,
  updateTagTw,
  deleteTagTw,
} from '@/app/actions/sabcrm-tags.actions';
import type { SabcrmRustTag } from '@/app/actions/sabcrm-tags.actions.types';

import './tag-manager.css';

interface TagManagerDialogProps {
  tags: SabcrmRustTag[];
  projectId: string | null;
  onClose: () => void;
  /** Called after any successful mutation so the parent reloads its tag list. */
  onChanged: () => void;
}

/**
 * Colour palette (hex values so `chipColor` paints them directly). Mirrors the
 * canonical Twenty tag palette in `dashboard/settings/crm/tags`.
 */
const COLOR_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '#3dab5a', label: 'Green' },
  { value: '#21b8a6', label: 'Turquoise' },
  { value: '#5db4e3', label: 'Sky' },
  { value: '#3b7ae4', label: 'Blue' },
  { value: '#9b51e0', label: 'Purple' },
  { value: '#e052b0', label: 'Pink' },
  { value: '#e0484e', label: 'Red' },
  { value: '#f0883e', label: 'Orange' },
  { value: '#e0c64a', label: 'Yellow' },
  { value: '#8c8c8c', label: 'Gray' },
];

const DEFAULT_COLOR = COLOR_OPTIONS[0]?.value ?? '#3dab5a';

/**
 * Normalise a stored tag colour (palette name / hex) to a paintable hex value
 * so it matches a swatch option where possible. Unknown values pass through
 * and render as a "Custom" swatch.
 */
function resolveColor(color?: string | null): string {
  if (!color) return DEFAULT_COLOR;
  if (color.startsWith('#') || color.startsWith('rgb')) return color;
  const match = COLOR_OPTIONS.find(
    (o) => o.label.toLowerCase() === color.toLowerCase(),
  );
  return match ? match.value : color;
}

interface ColorSelectProps {
  value: string;
  onChange: (color: string) => void;
  ariaLabel: string;
  disabled?: boolean;
}

/** Swatch dropdown — each option pairs a colour dot with its palette name. */
function ColorSelect({
  value,
  onChange,
  ariaLabel,
  disabled,
}: ColorSelectProps): React.JSX.Element {
  const known = COLOR_OPTIONS.some((o) => o.value === value);
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={ariaLabel}>
        <SelectValue placeholder="Colour" />
      </SelectTrigger>
      <SelectContent>
        {!known && value ? (
          <SelectItem value={value}>
            <span
              className="stgm-dot"
              style={{ background: value }}
              aria-hidden="true"
            />
            Custom
          </SelectItem>
        ) : null}
        {COLOR_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            <span
              className="stgm-dot"
              style={{ background: opt.value }}
              aria-hidden="true"
            />
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TagManagerDialog({
  tags,
  projectId,
  onClose,
  onChanged,
}: TagManagerDialogProps): React.JSX.Element {
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  // New-tag draft.
  const [newName, setNewName] = React.useState('');
  const [newColor, setNewColor] = React.useState(DEFAULT_COLOR);
  const [creating, setCreating] = React.useState(false);

  // Delete-confirm flow (AlertDialog): the tag pending confirmation.
  const [pendingDelete, setPendingDelete] =
    React.useState<SabcrmRustTag | null>(null);

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

  const handleConfirmDelete = async () => {
    const tag = pendingDelete;
    if (!tag) return;
    setPendingDelete(null);
    setBusyId(tag.id);
    setError(null);
    const res = await deleteTagTw(tag.id, pid);
    setBusyId(null);
    if (res.ok) onChanged();
    else setError(res.error); // e.g. "This tag is assigned to 3 records…"
  };

  return (
    <>
      <Modal open onClose={onClose} title="Manage tags" size="sm">
        {error ? (
          <Alert tone="danger" className="stg-mgr__error">
            {error}
          </Alert>
        ) : null}

        {/* Create row */}
        <div className="stg-mgr__create">
          <Input
            placeholder="New tag name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate();
            }}
          />
          <div className="stg-mgr__color">
            <ColorSelect
              value={newColor}
              onChange={setNewColor}
              ariaLabel="New tag colour"
            />
          </div>
          <Button
            variant="primary"
            iconLeft={Plus}
            onClick={() => void handleCreate()}
            disabled={!newName.trim() || creating}
            loading={creating}
          >
            Add
          </Button>
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
                onDelete={() => setPendingDelete(tag)}
              />
            ))
          )}
        </div>
      </Modal>

      {/* Delete confirm — Radix AlertDialog so the destructive action can't be
          lost to a stray overlay tap. */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{pendingDelete?.name ?? ''}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The tag will be removed from the workspace. Tags still applied to
              records cannot be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmDelete()}>
              Delete tag
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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
      <Input
        value={name}
        disabled={busy}
        aria-label={`Name for ${tag.name}`}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => dirty && onRename(name)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && dirty) onRename(name);
        }}
      />
      <div className="stg-mgr__color">
        <ColorSelect
          value={resolveColor(tag.color)}
          onChange={onRecolour}
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
