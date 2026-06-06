'use client';

/**
 * SabCRM - Data Model admin (client interactivity).
 *
 * The runtime metadata-engine console. Lets an admin:
 *   - browse every object the active project can see (standard + custom),
 *   - create a fully-custom object (slug + labels + icon + description),
 *   - open an object to manage its fields (add / edit / remove / reorder),
 *   - define a relation field between two objects (with reciprocal).
 *
 * All mutations go through the gated server actions in
 * `@/app/actions/sabcrm.actions` (session, project, RBAC, plan). The server
 * returns the resolved {@link ObjectMetadata}, which we hold in local state so
 * the UI reflects each change without a full reload; `router.refresh()` keeps
 * the rest of the app (object nav, record tables) consistent.
 *
 * Standard objects are immutable except for *adding* fields. The engine
 * rejects edits to their identity and standard/system fields, and this UI
 * mirrors those guards so disabled controls never hit a server error.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Link2,
  Lock,
  X,
} from 'lucide-react';

import {
  Button,
  IconButton,
  Input,
  Textarea,
  Label,
  Field,
  Switch,
  Badge,
  Separator,
  EmptyState,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  IconPicker,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  createCustomObjectAction,
  addFieldAction,
  updateFieldAction,
  removeFieldAction,
  reorderFieldsAction,
  createRelationAction,
} from '@/app/actions/sabcrm.actions';
import type {
  ObjectMetadata,
  FieldMetadata,
  FieldType,
  FieldOption,
  FieldRelation,
} from '@/lib/sabcrm/types';

/* -------------------------------------------------------------------------- */
/*  Static field-type catalogue                                               */
/* -------------------------------------------------------------------------- */

/** Field types a user can pick when adding a field, with friendly labels. */
const FIELD_TYPE_OPTIONS: ReadonlyArray<{ value: FieldType; label: string }> = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'CURRENCY', label: 'Currency' },
  { value: 'BOOLEAN', label: 'Boolean' },
  { value: 'DATE', label: 'Date' },
  { value: 'DATE_TIME', label: 'Date and time' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'LINK', label: 'Link' },
  { value: 'SELECT', label: 'Select (single)' },
  { value: 'MULTI_SELECT', label: 'Select (multiple)' },
  { value: 'RATING', label: 'Rating' },
  { value: 'FILE', label: 'File' },
  // RELATION is created through the dedicated "Add relation" flow.
];

const OPTION_TYPES: ReadonlySet<FieldType> = new Set(['SELECT', 'MULTI_SELECT']);

function fieldTypeLabel(type: FieldType): string {
  return FIELD_TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type;
}

/** Slugify a label into a kebab-case object slug suggestion. */
function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** camelCase-ify a label into a field-key suggestion. */
function camelKey(input: string): string {
  const cleaned = input.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (!cleaned) return '';
  const parts = cleaned.split(/\s+/);
  return (
    parts[0] +
    parts
      .slice(1)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('')
  );
}

/* -------------------------------------------------------------------------- */
/*  Component props                                                            */
/* -------------------------------------------------------------------------- */

export interface DataModelClientProps {
  /** Initial object catalogue, resolved server-side. */
  initialObjects: ObjectMetadata[];
  /**
   * Code-declared standard field keys per standard object slug. Standard
   * fields are immutable (the engine rejects edits/removal/reorder on them);
   * the client uses this to lock those rows in the UI. Custom objects are
   * absent from this map (every field is editable).
   */
  standardFieldKeys: Record<string, string[]>;
  /** Active project override forwarded to every server action. */
  projectId?: string;
}

/* -------------------------------------------------------------------------- */
/*  Root component                                                            */
/* -------------------------------------------------------------------------- */

export function DataModelClient({
  initialObjects,
  standardFieldKeys,
  projectId,
}: DataModelClientProps): React.JSX.Element {
  const router = useRouter();
  const { toast } = useToast();

  const [objects, setObjects] = React.useState<ObjectMetadata[]>(initialObjects);
  const [openSlug, setOpenSlug] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);

  // Keep state aligned if the server component re-renders with fresh data.
  React.useEffect(() => {
    setObjects(initialObjects);
  }, [initialObjects]);

  const activeObject = React.useMemo(
    () => objects.find((o) => o.slug === openSlug) ?? null,
    [objects, openSlug],
  );

  /** Replace one object in the catalogue with its updated metadata. */
  const upsertObject = React.useCallback((next: ObjectMetadata) => {
    setObjects((prev) => {
      const exists = prev.some((o) => o.slug === next.slug);
      if (exists) {
        return prev.map((o) => (o.slug === next.slug ? next : o));
      }
      return [...prev, next];
    });
  }, []);

  /** Apply both objects returned from a relation definition. */
  const applyObjects = React.useCallback(
    (updated: ObjectMetadata[]) => {
      setObjects((prev) => {
        const bySlug = new Map(prev.map((o) => [o.slug, o]));
        for (const o of updated) bySlug.set(o.slug, o);
        return Array.from(bySlug.values());
      });
    },
    [],
  );

  const standardObjects = objects.filter((o) => o.standard);
  const customObjects = objects.filter((o) => !o.standard);

  return (
    <div className="space-y-8">
      {/* Custom objects ------------------------------------------------- */}
      <section aria-labelledby="dm-custom-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2
              id="dm-custom-heading"
              className="text-sm font-semibold text-[var(--st-text)]"
            >
              Custom objects
            </h2>
            <p className="text-xs text-[var(--st-text-secondary)]">
              Objects you defined for this project. Fully editable.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="primary"
            iconLeft={Plus}
            onClick={() => setCreateOpen(true)}
            className="shrink-0"
          >
            New object
          </Button>
        </div>

        {customObjects.length === 0 ? (
          <EmptyState
            title="No custom objects yet"
            description="Create an object to model data that the standard CRM objects do not cover."
          />
        ) : (
          <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-0">
            {customObjects.map((object) => (
              <li key={object.slug} className="flex">
                <ObjectSummaryCard
                  object={object}
                  onOpen={() => setOpenSlug(object.slug)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Separator />

      {/* Standard objects ----------------------------------------------- */}
      <section aria-labelledby="dm-standard-heading">
        <div className="mb-4">
          <h2
            id="dm-standard-heading"
            className="text-sm font-semibold text-[var(--st-text)]"
          >
            Standard objects
          </h2>
          <p className="text-xs text-[var(--st-text-secondary)]">
            Built-in objects. You can add custom fields, but their identity and
            standard fields are fixed.
          </p>
        </div>

        <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-0">
          {standardObjects.map((object) => (
            <li key={object.slug} className="flex">
              <ObjectSummaryCard
                object={object}
                onOpen={() => setOpenSlug(object.slug)}
              />
            </li>
          ))}
        </ul>
      </section>

      {/* Create-object dialog ------------------------------------------- */}
      <CreateObjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingSlugs={objects.map((o) => o.slug)}
        projectId={projectId}
        onCreated={(created) => {
          upsertObject(created);
          setCreateOpen(false);
          setOpenSlug(created.slug);
          router.refresh();
          toast.success({
            title: 'Object created',
            description: `"${created.labelPlural}" is ready.`,
          });
        }}
      />

      {/* Field-manager dialog ------------------------------------------- */}
      {activeObject ? (
        <ManageObjectDialog
          object={activeObject}
          allObjects={objects}
          standardKeys={standardFieldKeys[activeObject.slug] ?? []}
          projectId={projectId}
          open={openSlug !== null}
          onOpenChange={(open) => {
            if (!open) setOpenSlug(null);
          }}
          onObjectChanged={(next) => {
            upsertObject(next);
            router.refresh();
          }}
          onObjectsChanged={(next) => {
            applyObjects(next);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Object summary card                                                       */
/* -------------------------------------------------------------------------- */

function ObjectSummaryCard({
  object,
  onOpen,
}: {
  object: ObjectMetadata;
  onOpen: () => void;
}): React.JSX.Element {
  const fieldCount = object.fields.length;
  return (
    <Card className="flex w-full flex-col">
      <CardHeader className="gap-1">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{object.labelPlural}</CardTitle>
          {object.standard ? (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              Standard
            </Badge>
          ) : (
            <Badge tone="accent" className="shrink-0 text-[10px]">
              Custom
            </Badge>
          )}
        </div>
        <CardDescription className="font-mono text-[11px]">
          {object.slug}
        </CardDescription>
      </CardHeader>
      <CardBody className="mt-auto flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--st-text-secondary)]">
          {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
        </span>
        <Button type="button" size="sm" variant="outline" onClick={onOpen}>
          Manage
        </Button>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Create-object dialog                                                      */
/* -------------------------------------------------------------------------- */

function CreateObjectDialog({
  open,
  onOpenChange,
  existingSlugs,
  projectId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingSlugs: string[];
  projectId?: string;
  onCreated: (object: ObjectMetadata) => void;
}): React.JSX.Element {
  const { toast } = useToast();
  const [labelSingular, setLabelSingular] = React.useState('');
  const [labelPlural, setLabelPlural] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [icon, setIcon] = React.useState('box');
  const [description, setDescription] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset on close so each open starts clean.
  React.useEffect(() => {
    if (!open) {
      setLabelSingular('');
      setLabelPlural('');
      setSlug('');
      setSlugTouched(false);
      setIcon('box');
      setDescription('');
      setError(null);
      setSaving(false);
    }
  }, [open]);

  // Auto-suggest slug from the plural label until the user edits the slug.
  const onPluralChange = (value: string) => {
    setLabelPlural(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const slugTaken = existingSlugs.includes(slug);
  const canSubmit =
    labelSingular.trim().length > 0 &&
    labelPlural.trim().length > 0 &&
    slug.trim().length > 0 &&
    !slugTaken &&
    !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await createCustomObjectAction(
        {
          slug: slug.trim(),
          labelSingular: labelSingular.trim(),
          labelPlural: labelPlural.trim(),
          icon: icon.trim() || 'box',
          description: description.trim() || undefined,
        },
        projectId,
      );
      if (res.ok) {
        onCreated(res.data);
      } else {
        setError(res.error);
        toast.error({
          title: 'Could not create object',
          description: res.error,
        });
      }
    } catch {
      const msg = 'Something went wrong creating the object.';
      setError(msg);
      toast.error({ title: 'Error', description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New custom object</DialogTitle>
            <DialogDescription>
              A "Name" text field is added automatically as the record title.
              You can add more fields after creating the object.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Singular label">
                <Input
                  value={labelSingular}
                  onChange={(e) => setLabelSingular(e.target.value)}
                  placeholder="Ticket"
                  autoComplete="off"
                />
              </Field>
              <Field label="Plural label">
                <Input
                  value={labelPlural}
                  onChange={(e) => onPluralChange(e.target.value)}
                  placeholder="Tickets"
                  autoComplete="off"
                />
              </Field>
            </div>

            <Field
              label="Slug"
              help="Lowercase kebab-case. Used in URLs and storage; cannot be changed later."
              error={
                slugTaken ? 'An object with this slug already exists.' : undefined
              }
            >
              <Input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="support-tickets"
                className="font-mono"
                autoComplete="off"
              />
            </Field>

            <div className="grid gap-1.5">
              <Label>Icon</Label>
              <IconPicker value={icon} onChange={setIcon} />
            </div>

            <Field label="Description (optional)">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this object represent?"
                rows={2}
              />
            </Field>

            {error ? (
              <p className="text-xs text-[var(--st-danger)]">{error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={!canSubmit}
            >
              Create object
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Manage-object (field manager) dialog                                      */
/* -------------------------------------------------------------------------- */

/** Working copy of a field's editable attributes used by the field form. */
interface FieldDraft {
  key: string;
  label: string;
  type: FieldType;
  icon: string;
  description: string;
  required: boolean;
  inTable: boolean;
  isLabel: boolean;
  options: FieldOption[];
}

function emptyDraft(): FieldDraft {
  return {
    key: '',
    label: '',
    type: 'TEXT',
    icon: '',
    description: '',
    required: false,
    inTable: true,
    isLabel: false,
    options: [],
  };
}

function draftFromField(field: FieldMetadata): FieldDraft {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    icon: field.icon ?? '',
    description: field.description ?? '',
    required: field.required ?? false,
    inTable: field.inTable ?? false,
    isLabel: field.isLabel ?? false,
    options: field.options ? field.options.map((o) => ({ ...o })) : [],
  };
}

function ManageObjectDialog({
  object,
  allObjects,
  standardKeys,
  projectId,
  open,
  onOpenChange,
  onObjectChanged,
  onObjectsChanged,
}: {
  object: ObjectMetadata;
  allObjects: ObjectMetadata[];
  /** Code-declared standard field keys for this object (empty for customs). */
  standardKeys: string[];
  projectId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onObjectChanged: (next: ObjectMetadata) => void;
  onObjectsChanged: (next: ObjectMetadata[]) => void;
}): React.JSX.Element {
  const { toast } = useToast();

  // Which inline editor is showing: none | a new field | editing a field key |
  // the relation builder.
  type Mode =
    | { kind: 'list' }
    | { kind: 'add' }
    | { kind: 'edit'; fieldKey: string }
    | { kind: 'relation' };
  const [mode, setMode] = React.useState<Mode>({ kind: 'list' });
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  // Reset the inline editor whenever the dialog (re)opens or the object swaps.
  React.useEffect(() => {
    if (open) setMode({ kind: 'list' });
  }, [open, object.slug]);

  const isStandardObject = object.standard === true;

  const standardKeySet = React.useMemo(
    () => new Set(standardKeys),
    [standardKeys],
  );

  /** A field is editable only if it is neither a system nor a standard field. */
  const isCustomField = React.useCallback(
    (field: FieldMetadata): boolean =>
      field.system !== true && !standardKeySet.has(field.key),
    [standardKeySet],
  );

  // Custom-field keys (in current order). The exact set/order the engine's
  // `reorderFields` permutes. Standard fields always render first in code order.
  const customFieldKeys = object.fields
    .filter((f) => isCustomField(f))
    .map((f) => f.key);

  const handleRemove = async (fieldKey: string) => {
    setBusyKey(fieldKey);
    try {
      const res = await removeFieldAction(object.slug, fieldKey, projectId);
      if (res.ok) {
        onObjectChanged(res.data);
        toast.success({ title: 'Field removed' });
      } else {
        toast.error({
          title: 'Could not remove field',
          description: res.error,
        });
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleReorder = async (fieldKey: string, dir: -1 | 1) => {
    // Reorder operates over the custom-field subsequence only.
    const order = [...customFieldKeys];
    const idx = order.indexOf(fieldKey);
    if (idx < 0) return;
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= order.length) return;
    [order[idx], order[swapWith]] = [order[swapWith], order[idx]];

    setBusyKey(fieldKey);
    try {
      const res = await reorderFieldsAction(object.slug, order, projectId);
      if (res.ok) {
        onObjectChanged(res.data);
      } else {
        toast.error({
          title: 'Could not reorder',
          description: res.error,
        });
      }
    } finally {
      setBusyKey(null);
    }
  };

  const editingField =
    mode.kind === 'edit'
      ? object.fields.find((f) => f.key === mode.fieldKey) ?? null
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>{object.labelPlural}</DialogTitle>
            {isStandardObject ? (
              <Badge variant="outline" className="text-[10px]">
                Standard
              </Badge>
            ) : null}
          </div>
          <DialogDescription>
            <span className="font-mono">{object.slug}</span>
            {' . '}
            Manage the fields and relations for this object.
          </DialogDescription>
        </DialogHeader>

        {mode.kind === 'list' ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="primary"
                iconLeft={Plus}
                onClick={() => setMode({ kind: 'add' })}
              >
                Add field
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                iconLeft={Link2}
                onClick={() => setMode({ kind: 'relation' })}
                disabled={allObjects.length < 1}
              >
                Add relation
              </Button>
            </div>

            <div className="mt-3 max-h-[55vh] overflow-y-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
              <ul className="list-none divide-y divide-[var(--st-border)] p-0">
                {object.fields.map((field) => {
                  const isCustom = isCustomField(field);
                  const customIdx = customFieldKeys.indexOf(field.key);
                  const busy = busyKey === field.key;
                  return (
                    <li
                      key={field.key}
                      className="flex items-center gap-3 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-[var(--st-text)]">
                            {field.label}
                          </span>
                          {field.isLabel ? (
                            <Badge variant="outline" className="text-[10px]">
                              Title
                            </Badge>
                          ) : null}
                          {field.required ? (
                            <Badge variant="outline" className="text-[10px]">
                              Required
                            </Badge>
                          ) : null}
                          {field.system ? (
                            <Lock
                              className="h-3 w-3 text-[var(--st-text-secondary)]"
                              aria-hidden="true"
                            />
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[var(--st-text-secondary)]">
                          <span className="font-mono">{field.key}</span>
                          <span aria-hidden="true">.</span>
                          <span>{fieldTypeLabel(field.type)}</span>
                          {field.type === 'RELATION' && field.relation ? (
                            <>
                              <span aria-hidden="true">to</span>
                              <span className="font-mono">
                                {field.relation.targetObject}
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        {isCustom ? (
                          <>
                            <IconButton
                              type="button"
                              icon={ArrowUp}
                              label={`Move ${field.label} up`}
                              variant="ghost"
                              size="sm"
                              disabled={customIdx <= 0 || busy}
                              onClick={() => handleReorder(field.key, -1)}
                            />
                            <IconButton
                              type="button"
                              icon={ArrowDown}
                              label={`Move ${field.label} down`}
                              variant="ghost"
                              size="sm"
                              disabled={
                                customIdx < 0 ||
                                customIdx >= customFieldKeys.length - 1 ||
                                busy
                              }
                              onClick={() => handleReorder(field.key, 1)}
                            />
                            <IconButton
                              type="button"
                              icon={Pencil}
                              label={`Edit ${field.label}`}
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              onClick={() =>
                                setMode({ kind: 'edit', fieldKey: field.key })
                              }
                            />
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label={`Remove ${field.label}`}
                              disabled={busy}
                              onClick={() => handleRemove(field.key)}
                            >
                              {busy ? (
                                <Loader2
                                  className="h-4 w-4 animate-spin"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              )}
                            </Button>
                          </>
                        ) : (
                          <span className="px-2 text-[10px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                            {field.system ? 'System' : 'Standard'}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        ) : null}

        {mode.kind === 'add' ? (
          <FieldForm
            object={object}
            initial={emptyDraft()}
            projectId={projectId}
            onCancel={() => setMode({ kind: 'list' })}
            onSaved={(next) => {
              onObjectChanged(next);
              setMode({ kind: 'list' });
              toast.success({ title: 'Field added' });
            }}
          />
        ) : null}

        {mode.kind === 'edit' && editingField ? (
          <FieldForm
            object={object}
            initial={draftFromField(editingField)}
            editing
            projectId={projectId}
            onCancel={() => setMode({ kind: 'list' })}
            onSaved={(next) => {
              onObjectChanged(next);
              setMode({ kind: 'list' });
              toast.success({ title: 'Field updated' });
            }}
          />
        ) : null}

        {mode.kind === 'relation' ? (
          <RelationForm
            object={object}
            allObjects={allObjects}
            projectId={projectId}
            onCancel={() => setMode({ kind: 'list' })}
            onSaved={(updated) => {
              onObjectsChanged(updated);
              setMode({ kind: 'list' });
              toast.success({ title: 'Relation created' });
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  Field add / edit form                                                     */
/* -------------------------------------------------------------------------- */

function FieldForm({
  object,
  initial,
  editing = false,
  projectId,
  onCancel,
  onSaved,
}: {
  object: ObjectMetadata;
  initial: FieldDraft;
  editing?: boolean;
  projectId?: string;
  onCancel: () => void;
  onSaved: (next: ObjectMetadata) => void;
}): React.JSX.Element {
  const { toast } = useToast();
  const [draft, setDraft] = React.useState<FieldDraft>(initial);
  const [keyTouched, setKeyTouched] = React.useState(editing);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const existingKeys = React.useMemo(
    () => new Set(object.fields.map((f) => f.key)),
    [object.fields],
  );

  const set = <K extends keyof FieldDraft>(key: K, value: FieldDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const onLabelChange = (value: string) => {
    set('label', value);
    if (!editing && !keyTouched) set('key', camelKey(value));
  };

  const needsOptions = OPTION_TYPES.has(draft.type);
  const keyConflict =
    !editing && draft.key.trim().length > 0 && existingKeys.has(draft.key.trim());

  const canSubmit =
    draft.label.trim().length > 0 &&
    draft.key.trim().length > 0 &&
    !keyConflict &&
    (!needsOptions || draft.options.length > 0) &&
    !saving;

  const addOption = () =>
    set('options', [...draft.options, { value: '', label: '' }]);

  const updateOption = (index: number, patch: Partial<FieldOption>) =>
    set(
      'options',
      draft.options.map((o, i) => (i === index ? { ...o, ...patch } : o)),
    );

  const removeOption = (index: number) =>
    set(
      'options',
      draft.options.filter((_, i) => i !== index),
    );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    // Normalise SELECT options: a blank value falls back to the label.
    const options: FieldOption[] | undefined = needsOptions
      ? draft.options
          .map((o) => ({
            value: (o.value || o.label).trim(),
            label: (o.label || o.value).trim(),
            ...(o.color ? { color: o.color } : {}),
          }))
          .filter((o) => o.value)
      : undefined;

    try {
      if (editing) {
        const res = await updateFieldAction(
          object.slug,
          draft.key.trim(),
          {
            label: draft.label.trim(),
            icon: draft.icon.trim() || null,
            description: draft.description.trim() || null,
            required: draft.required,
            inTable: draft.inTable,
            isLabel: draft.isLabel,
            ...(needsOptions ? { options } : {}),
          },
          projectId,
        );
        if (res.ok) {
          onSaved(res.data);
        } else {
          setError(res.error);
          toast.error({
            title: 'Could not update field',
            description: res.error,
          });
        }
      } else {
        const field: FieldMetadata = {
          key: draft.key.trim(),
          label: draft.label.trim(),
          type: draft.type,
          icon: draft.icon.trim() || undefined,
          description: draft.description.trim() || undefined,
          required: draft.required,
          inTable: draft.inTable,
          isLabel: draft.isLabel,
          ...(options ? { options } : {}),
        };
        const res = await addFieldAction(object.slug, field, projectId);
        if (res.ok) {
          onSaved(res.data);
        } else {
          setError(res.error);
          toast.error({
            title: 'Could not add field',
            description: res.error,
          });
        }
      }
    } catch {
      const msg = 'Something went wrong saving the field.';
      setError(msg);
      toast.error({ title: 'Error', description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Label">
          <Input
            value={draft.label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="Priority"
            autoComplete="off"
          />
        </Field>
        <Field
          label="Key"
          help={
            editing ? 'The key is immutable once a field exists.' : undefined
          }
          error={
            keyConflict ? 'A field with this key already exists.' : undefined
          }
        >
          <Input
            value={draft.key}
            onChange={(e) => {
              setKeyTouched(true);
              set('key', e.target.value);
            }}
            placeholder="priority"
            className="font-mono"
            autoComplete="off"
            disabled={editing}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Type"
          help={
            editing
              ? 'Type cannot change. Remove and re-add to switch types.'
              : undefined
          }
        >
          <Select
            value={draft.type}
            onValueChange={(value) => set('type', value as FieldType)}
            disabled={editing}
          >
            <SelectTrigger aria-label="Field type">
              <SelectValue placeholder="Choose a type" />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <div className="grid gap-1.5">
          <Label>Icon (optional)</Label>
          <IconPicker
            value={draft.icon}
            onChange={(next) => set('icon', next)}
          />
        </div>
      </div>

      <Field label="Description (optional)">
        <Textarea
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
          rows={2}
        />
      </Field>

      {needsOptions ? (
        <div className="grid gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
          <div className="flex items-center justify-between">
            <Label>Options</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              iconLeft={Plus}
              onClick={addOption}
            >
              Add option
            </Button>
          </div>
          {draft.options.length === 0 ? (
            <p className="text-[11px] text-[var(--st-text-secondary)]">
              Add at least one option for a select field.
            </p>
          ) : (
            <ul className="list-none space-y-2 p-0">
              {draft.options.map((opt, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Input
                    value={opt.label}
                    onChange={(e) =>
                      updateOption(index, { label: e.target.value })
                    }
                    placeholder="Label"
                    aria-label={`Option ${index + 1} label`}
                    className="flex-1"
                    autoComplete="off"
                  />
                  <Input
                    value={opt.value}
                    onChange={(e) =>
                      updateOption(index, { value: e.target.value })
                    }
                    placeholder="value"
                    aria-label={`Option ${index + 1} value`}
                    className="flex-1 font-mono"
                    autoComplete="off"
                  />
                  <IconButton
                    type="button"
                    icon={X}
                    label={`Remove option ${index + 1}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => removeOption(index)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        <Switch
          checked={draft.required}
          onCheckedChange={(checked) => set('required', checked)}
          label="Required"
        />
        <Switch
          checked={draft.inTable}
          onCheckedChange={(checked) => set('inTable', checked)}
          label="In table"
        />
        <Switch
          checked={draft.isLabel}
          onCheckedChange={(checked) => set('isLabel', checked)}
          label="Title field"
        />
      </div>

      {error ? (
        <p className="text-xs text-[var(--st-danger)]">{error}</p>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          disabled={!canSubmit}
        >
          {editing ? 'Save changes' : 'Add field'}
        </Button>
      </DialogFooter>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Relation builder                                                          */
/* -------------------------------------------------------------------------- */

function RelationForm({
  object,
  allObjects,
  projectId,
  onCancel,
  onSaved,
}: {
  object: ObjectMetadata;
  allObjects: ObjectMetadata[];
  projectId?: string;
  onCancel: () => void;
  onSaved: (updated: ObjectMetadata[]) => void;
}): React.JSX.Element {
  const { toast } = useToast();
  const [targetObject, setTargetObject] = React.useState('');
  const [kind, setKind] =
    React.useState<FieldRelation['kind']>('MANY_TO_ONE');
  const [fieldKey, setFieldKey] = React.useState('');
  const [keyTouched, setKeyTouched] = React.useState(false);
  const [forwardLabel, setForwardLabel] = React.useState('');
  const [makeInverse, setMakeInverse] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const target = allObjects.find((o) => o.slug === targetObject) ?? null;

  const onTargetChange = (slug: string) => {
    setTargetObject(slug);
    const t = allObjects.find((o) => o.slug === slug);
    if (t && !keyTouched) {
      // MANY_TO_ONE => one target ("company"); ONE_TO_MANY => many ("tickets").
      setFieldKey(
        camelKey(kind === 'MANY_TO_ONE' ? t.labelSingular : t.labelPlural),
      );
      if (!forwardLabel) {
        setForwardLabel(
          kind === 'MANY_TO_ONE' ? t.labelSingular : t.labelPlural,
        );
      }
    }
  };

  const onKindChange = (next: FieldRelation['kind']) => {
    setKind(next);
    if (target && !keyTouched) {
      setFieldKey(
        camelKey(next === 'MANY_TO_ONE' ? target.labelSingular : target.labelPlural),
      );
    }
  };

  const keyConflict =
    fieldKey.trim().length > 0 &&
    object.fields.some((f) => f.key === fieldKey.trim());

  const canSubmit =
    targetObject.length > 0 &&
    fieldKey.trim().length > 0 &&
    !keyConflict &&
    !saving;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await createRelationAction(
        {
          fromSlug: object.slug,
          fieldKey: fieldKey.trim(),
          relation: { targetObject, kind },
          forwardLabel: forwardLabel.trim() || undefined,
          inverse: makeInverse,
        },
        projectId,
      );
      if (res.ok) {
        const updated = [res.data.from, res.data.to];
        onSaved(updated);
      } else {
        setError(res.error);
        toast.error({
          title: 'Could not create relation',
          description: res.error,
        });
      }
    } catch {
      const msg = 'Something went wrong creating the relation.';
      setError(msg);
      toast.error({ title: 'Error', description: msg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-[var(--st-text-secondary)]">
        Link <span className="font-medium">{object.labelSingular}</span> records
        to another object. A reciprocal field is created on the target unless you
        turn it off.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Target object">
          <Select value={targetObject} onValueChange={onTargetChange}>
            <SelectTrigger aria-label="Target object">
              <SelectValue placeholder="Choose object" />
            </SelectTrigger>
            <SelectContent>
              {allObjects.map((o) => (
                <SelectItem key={o.slug} value={o.slug}>
                  {o.labelPlural}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Cardinality">
          <Select
            value={kind}
            onValueChange={(value) => onKindChange(value as FieldRelation['kind'])}
          >
            <SelectTrigger aria-label="Cardinality">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MANY_TO_ONE">
                Many {object.labelPlural.toLowerCase()} to one
              </SelectItem>
              <SelectItem value="ONE_TO_MANY">
                One {object.labelSingular.toLowerCase()} to many
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Field key"
          error={
            keyConflict
              ? 'A field with this key already exists on this object.'
              : undefined
          }
        >
          <Input
            value={fieldKey}
            onChange={(e) => {
              setKeyTouched(true);
              setFieldKey(e.target.value);
            }}
            placeholder="company"
            className="font-mono"
            autoComplete="off"
          />
        </Field>
        <Field label="Field label">
          <Input
            value={forwardLabel}
            onChange={(e) => setForwardLabel(e.target.value)}
            placeholder={target?.labelSingular ?? 'Related'}
            autoComplete="off"
          />
        </Field>
      </div>

      <Switch
        checked={makeInverse}
        onCheckedChange={setMakeInverse}
        disabled={targetObject === object.slug}
        label={`Create a reciprocal field on ${
          target ? target.labelPlural : 'the target'
        }`}
      />

      {error ? (
        <p className="text-xs text-[var(--st-danger)]">{error}</p>
      ) : null}

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={saving}
          disabled={!canSubmit}
        >
          Create relation
        </Button>
      </DialogFooter>
    </form>
  );
}
