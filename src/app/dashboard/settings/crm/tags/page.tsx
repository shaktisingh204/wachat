'use client';

/**
 * SabCRM - Tags settings (`/dashboard/settings/crm/tags`).
 *
 * A single surface that lists the workspace's tags as coloured chips, each with
 * a name and a record-count. From here a user can:
 *
 *   - "New tag"      -> name + colour from the fixed palette -> createTagTw
 *   - edit a tag     -> rename / recolour in place           -> updateTagTw
 *   - delete a tag   -> confirm, then remove                 -> deleteTagTw
 *
 * Mutations go through the gated server actions in
 * `@/app/actions/sabcrm-tags.actions`, each of which independently re-runs the
 * session -> project -> RBAC -> plan pipeline server-side, so the page fails
 * closed. The CRM engine may be DOWN; every call returns an `ActionResult`, so
 * the page degrades to loading / empty / error states and never crashes.
 *
 * Auth / RBAC / project context are enforced by the parent `../../layout.tsx`;
 * the actions re-run the full gate. Pure 20ui design system throughout.
 */

import * as React from 'react';
import {
  Tag as TagIcon,
  Tags as TagsIcon,
  Plus,
  Check,
  Pencil,
  Trash2,
} from 'lucide-react';

import {
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
  Button,
  IconButton,
  Tag,
  Table,
  THead,
  TBody,
  Tr,
  Th,
  Td,
  Field,
  Input,
  Alert,
  EmptyState,
  Skeleton,
  Modal,
  Popover,
  PopoverTrigger,
  PopoverContent,
  useToast,
} from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listTagsTw,
  createTagTw,
  updateTagTw,
  deleteTagTw,
} from '@/app/actions/sabcrm-tags.actions';

// ---------------------------------------------------------------------------
// Tag wire shape
//
// Declared locally to keep this client page free of any `server-only` import.
// Mirrors the `{ id, name, color, createdAt }` payload documented in the
// `@/app/actions/sabcrm-tags.actions` contract.
// ---------------------------------------------------------------------------

interface CrmTag {
  id: string;
  name: string;
  color?: string;
  createdAt: string;
  /** Optional usage count if the engine reports one; placeholder otherwise. */
  recordCount?: number;
}

// ---------------------------------------------------------------------------
// Tag-colour palette
//
// `token` is what we persist (a `--st-*` style name, to stay consistent with
// the seeded schema) and `swatch` is the literal hex painted in the picker /
// chip - the chip dot uses a runtime-computed user-picked colour.
// ---------------------------------------------------------------------------

interface PaletteColor {
  name: string;
  token: string;
  swatch: string;
}

const TAG_PALETTE: ReadonlyArray<PaletteColor> = [
  { name: 'Green', token: '--tag-green', swatch: '#3dab5a' },
  { name: 'Turquoise', token: '--tag-turquoise', swatch: '#21b8a6' },
  { name: 'Sky', token: '--tag-sky', swatch: '#5db4e3' },
  { name: 'Blue', token: '--tag-blue', swatch: '#3b7ae4' },
  { name: 'Purple', token: '--tag-purple', swatch: '#9b51e0' },
  { name: 'Pink', token: '--tag-pink', swatch: '#e052b0' },
  { name: 'Red', token: '--tag-red', swatch: '#e0484e' },
  { name: 'Orange', token: '--tag-orange', swatch: '#f0883e' },
  { name: 'Yellow', token: '--tag-yellow', swatch: '#e0c64a' },
  { name: 'Gray', token: '--tag-gray', swatch: '#8c8c8c' },
];

const DEFAULT_TAG_COLOR = TAG_PALETTE[0].token;

/** Resolve a stored tag colour (token or hex) to a paintable swatch. */
function swatchFor(color: string | undefined): string {
  if (!color) return TAG_PALETTE[0].swatch;
  const match = TAG_PALETTE.find((c) => c.token === color);
  if (match) return match.swatch;
  // Already a hex / concrete colour -> paint as-is, else fall back.
  return /^#|^rgb|^hsl/.test(color) ? color : TAG_PALETTE[0].swatch;
}

/** Human label for a stored colour, for titles / a11y. */
function colorName(color: string | undefined): string {
  if (!color) return TAG_PALETTE[0].name;
  return TAG_PALETTE.find((c) => c.token === color)?.name ?? 'Custom';
}

// ---------------------------------------------------------------------------
// Colour-swatch picker - 20ui Popover
// ---------------------------------------------------------------------------

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (token: string) => void;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={`Pick tag colour (current: ${colorName(value)})`}
        >
          <span
            className="inline-block h-3.5 w-3.5 rounded-full"
            style={{ background: swatchFor(value) }}
            aria-hidden="true"
          />
          <span>{colorName(value)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-2"
        role="listbox"
        aria-label="Tag colours"
      >
        <div className="grid grid-cols-5 gap-1">
          {TAG_PALETTE.map((c) => (
            <Button
              key={c.token}
              variant="ghost"
              size="sm"
              role="option"
              aria-selected={c.token === value}
              aria-label={c.name}
              title={c.name}
              className="relative h-8 w-8 justify-center p-0"
              onClick={() => {
                onChange(c.token);
                setOpen(false);
              }}
            >
              <span
                className="inline-block h-5 w-5 rounded-full"
                style={{ background: c.swatch }}
                aria-hidden="true"
              />
              {c.token === value ? (
                <Check
                  size={12}
                  className="absolute text-[var(--st-text-inverted)]"
                  aria-hidden="true"
                />
              ) : null}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Tag dialog - create a new tag OR edit an existing one
// ---------------------------------------------------------------------------

interface TagDialogProps {
  projectId: string;
  /** When set, edit this tag; otherwise create a new one. */
  editing: CrmTag | null;
  existingNames: ReadonlySet<string>;
  onClose: () => void;
  onSaved: (tag: CrmTag) => void;
}

function TagDialog({
  projectId,
  editing,
  existingNames,
  onClose,
  onSaved,
}: TagDialogProps): React.JSX.Element {
  const [name, setName] = React.useState(editing?.name ?? '');
  const [color, setColor] = React.useState(editing?.color ?? DEFAULT_TAG_COLOR);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const trimmed = name.trim();
  const nameTaken =
    trimmed.length > 0 &&
    trimmed.toLowerCase() !== (editing?.name ?? '').trim().toLowerCase() &&
    existingNames.has(trimmed.toLowerCase());
  const canSubmit = trimmed.length > 0 && !nameTaken && !saving;

  const handleSubmit = React.useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (!canSubmit) return;
      setSaving(true);
      setError(null);
      try {
        const res = editing
          ? await updateTagTw(editing.id, { name: trimmed, color }, projectId)
          : await createTagTw({ name: trimmed, color }, projectId);
        if (res.ok) {
          onSaved(res.data as CrmTag);
        } else {
          setError(res.error);
        }
      } catch {
        setError('Failed to save the tag. The service may be unavailable.');
      } finally {
        setSaving(false);
      }
    },
    [canSubmit, editing, trimmed, color, projectId, onSaved],
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={editing ? 'Edit tag' : 'New tag'}
      description={
        editing
          ? 'Rename or recolour this tag. Changes apply everywhere it is used.'
          : 'Name the tag and pick a colour from the palette.'
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="tag-dialog-form"
            variant="primary"
            loading={saving}
            disabled={!canSubmit}
          >
            {editing ? 'Save changes' : 'Create tag'}
          </Button>
        </>
      }
    >
      <form id="tag-dialog-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label="Name"
          required
          error={nameTaken ? 'A tag with this name already exists.' : undefined}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Lead"
            autoComplete="off"
            autoFocus
          />
        </Field>

        <Field label="Colour">
          <ColorPicker value={color} onChange={setColor} />
        </Field>

        <Field label="Preview">
          <Tag color={swatchFor(color)}>{trimmed || 'Tag name'}</Tag>
        </Field>

        {error ? (
          <Alert tone="danger" title="Could not save">
            {error}
          </Alert>
        ) : null}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation
// ---------------------------------------------------------------------------

interface DeleteTagDialogProps {
  tag: CrmTag;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteTagDialog({
  tag,
  busy,
  onCancel,
  onConfirm,
}: DeleteTagDialogProps): React.JSX.Element {
  return (
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title="Delete tag"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" loading={busy} onClick={onConfirm}>
            Delete tag
          </Button>
        </>
      }
    >
      <p className="m-0 flex flex-wrap items-center gap-1.5 text-[var(--st-text-secondary)]">
        <span>Delete the tag</span>
        <Tag color={swatchFor(tag.color)}>{tag.name}</Tag>
        <span>
          ? It will be removed from every record it is applied to. This cannot be
          undone.
        </span>
      </p>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tag row
// ---------------------------------------------------------------------------

function TagRow({
  tag,
  busy,
  onEdit,
  onDelete,
}: {
  tag: CrmTag;
  busy: boolean;
  onEdit: (tag: CrmTag) => void;
  onDelete: (tag: CrmTag) => void;
}): React.JSX.Element {
  const count = typeof tag.recordCount === 'number' ? tag.recordCount : 0;
  return (
    <Tr>
      <Td>
        <Tag color={swatchFor(tag.color)}>{tag.name}</Tag>
      </Td>
      <Td className="text-[var(--st-text-secondary)]">
        {count} {count === 1 ? 'record' : 'records'}
      </Td>
      <Td align="right">
        <div className="flex items-center justify-end gap-1">
          <IconButton
            label={`Edit tag ${tag.name}`}
            icon={Pencil}
            size="sm"
            disabled={busy}
            onClick={() => onEdit(tag)}
          />
          <IconButton
            label={`Delete tag ${tag.name}`}
            icon={Trash2}
            size="sm"
            variant="danger"
            loading={busy}
            disabled={busy}
            onClick={() => onDelete(tag)}
          />
        </div>
      </Td>
    </Tr>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmTagsSettingsPage(): React.JSX.Element {
  const { activeProjectId, isLoadingProject } = useProject();
  const { toast } = useToast();

  const [tags, setTags] = React.useState<CrmTag[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Dialog / row state
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CrmTag | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<CrmTag | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const loadTags = React.useCallback(async (projectId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await listTagsTw(projectId);
      if (res.ok) {
        setTags(res.data as CrmTag[]);
      } else {
        setError(res.error);
      }
    } catch {
      setError('Tags could not be loaded. The service may be unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isLoadingProject) return;
    if (!activeProjectId) {
      setLoading(false);
      return;
    }
    void loadTags(activeProjectId);
  }, [activeProjectId, isLoadingProject, loadTags]);

  // ----- Derived -----

  const sortedTags = React.useMemo(
    () =>
      [...tags].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    [tags],
  );

  const existingNames = React.useMemo(
    () => new Set(tags.map((t) => t.name.trim().toLowerCase())),
    [tags],
  );

  // ----- Mutations -----

  const handleSaved = React.useCallback(
    (tag: CrmTag) => {
      setTags((prev) => {
        const exists = prev.some((t) => t.id === tag.id);
        return exists
          ? prev.map((t) => (t.id === tag.id ? { ...t, ...tag } : t))
          : [...prev, tag];
      });
      setDialogOpen(false);
      setEditing(null);
      toast.success('Tag saved');
    },
    [toast],
  );

  const confirmDelete = React.useCallback(async () => {
    if (!deleteTarget || !activeProjectId) return;
    setDeleting(true);
    try {
      const res = await deleteTagTw(deleteTarget.id, activeProjectId);
      if (res.ok) {
        setTags((prev) => prev.filter((t) => t.id !== deleteTarget.id));
        setDeleteTarget(null);
        toast.success('Tag deleted');
      } else {
        setDeleteTarget(null);
        toast.error(res.error);
      }
    } catch {
      setDeleteTarget(null);
      toast.error('Failed to delete the tag. The service may be unavailable.');
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, activeProjectId, toast]);

  const openCreate = React.useCallback(() => {
    setEditing(null);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((tag: CrmTag) => {
    setEditing(tag);
    setDialogOpen(true);
  }, []);

  // ----- Render -----

  return (
    <div className="ui20">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-[var(--st-space-6,1.5rem)]">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Tags</PageTitle>
            <PageDescription>
              Tags label and group records across SabCRM. Create a tag, pick a
              colour from the palette, then apply it to any record. Renaming or
              recolouring a tag updates it everywhere it&apos;s used.
            </PageDescription>
          </PageHeaderHeading>
          {activeProjectId ? (
            <PageActions>
              <Button
                variant="primary"
                iconLeft={Plus}
                onClick={openCreate}
                disabled={loading || !!error}
              >
                New tag
              </Button>
            </PageActions>
          ) : null}
        </PageHeader>

        {isLoadingProject || loading ? (
          <div className="flex flex-col gap-2 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} height={40} radius={6} />
            ))}
          </div>
        ) : !activeProjectId ? (
          <EmptyState
            icon={TagsIcon}
            title="No project selected"
            description="Select a project to manage its tags."
          />
        ) : error ? (
          <Alert tone="danger" title="Could not load tags">
            {error}
          </Alert>
        ) : sortedTags.length === 0 ? (
          <EmptyState
            icon={TagIcon}
            title="No tags yet"
            description="Create your first tag to start labelling and grouping records."
            action={
              <Button variant="primary" iconLeft={Plus} onClick={openCreate}>
                New tag
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)]">
              <Table>
                <THead>
                  <Tr>
                    <Th>Tag</Th>
                    <Th>Usage</Th>
                    <Th align="right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {sortedTags.map((tag) => (
                    <TagRow
                      key={tag.id}
                      tag={tag}
                      busy={deleting && deleteTarget?.id === tag.id}
                      onEdit={openEdit}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </TBody>
              </Table>
            </div>
            <p className="m-0 text-sm text-[var(--st-text-tertiary)]">
              {sortedTags.length} tag{sortedTags.length !== 1 ? 's' : ''}
            </p>
          </>
        )}
      </div>

      {dialogOpen && activeProjectId ? (
        <TagDialog
          projectId={activeProjectId}
          editing={editing}
          existingNames={existingNames}
          onClose={() => {
            setDialogOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteTagDialog
          tag={deleteTarget}
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
