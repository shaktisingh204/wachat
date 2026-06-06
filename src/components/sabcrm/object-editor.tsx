'use client';

/**
 * SabCRM — Object editor panel.
 *
 * A single self-contained client component that provides:
 *   - Create / edit a custom CRM object (slug, singular/plural labels, icon,
 *     description, views, board group-by field).
 *   - Field list with drag-and-drop reorder, inline add, inline edit, and
 *     remove — standard / system fields are shown read-only.
 *   - A dedicated "Add relation" sub-form that picks a target object, sets
 *     cardinality (MANY_TO_ONE / ONE_TO_MANY), and optionally creates the
 *     reciprocal back-reference on the target object.
 *
 * All mutations are optimistic: the component tracks the latest resolved
 * {@link ObjectMetadata} returned by each action and re-renders in place.
 * On failure the previous state is restored and an inline error is shown.
 *
 * Pure ZoruUI (black-and-white). Standard / system fields are visually
 * distinguished and their remove/edit controls are disabled. File inputs
 * in record forms use SabFiles; there are no free-text URL inputs here.
 *
 * Usage:
 *   <ObjectEditor                          // create mode
 *     allObjects={projectObjects}
 *   />
 *   <ObjectEditor                          // edit mode
 *     object={existingObject}
 *     allObjects={projectObjects}
 *     projectId="..."
 *   />
 */

import * as React from 'react';
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
  Link2,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';

import { Button, Input, Label, Textarea, Separator, Badge, Switch, cn, useToast, IconPicker, ICONS, AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, Select, SelectTrigger, SelectContent, SelectItem, SelectValue, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, ScrollArea, Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/sabcrm/20ui';

import {
  createCustomObjectAction,
  updateObjectAction,
  deleteCustomObjectAction,
  addFieldAction,
  updateFieldAction,
  removeFieldAction,
  reorderFieldsAction,
  createRelationAction,
  listObjectsAction,
} from '@/app/actions/sabcrm.actions';
import type { CreateRelationActionInput } from '@/app/actions/sabcrm.actions.types';

import type {
  ObjectMetadata,
  FieldMetadata,
  FieldType,
  FieldOption,
  FieldRelation,
  BoardConfig,
} from '@/lib/sabcrm/types';

/* -------------------------------------------------------------------------- */
/*  Client-side mirrors of server-only input types                           */
/*  (objects.server.ts is server-only; we redeclare the minimal shapes here) */
/* -------------------------------------------------------------------------- */

interface CreateCustomObjectInput {
  slug: string;
  labelSingular: string;
  labelPlural: string;
  icon: string;
  description?: string;
  fields?: FieldMetadata[];
  views?: Array<'table' | 'board'>;
  board?: BoardConfig;
}

interface UpdateObjectPatch {
  labelSingular?: string;
  labelPlural?: string;
  icon?: string;
  description?: string | null;
  views?: Array<'table' | 'board'>;
  board?: BoardConfig | null;
}

interface UpdateFieldPatch {
  label?: string;
  icon?: string | null;
  description?: string | null;
  required?: boolean;
  inTable?: boolean;
  isLabel?: boolean;
  options?: FieldOption[];
  defaultValue?: unknown;
  relation?: FieldRelation;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const FIELD_TYPES: Array<{ value: FieldType; label: string }> = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'CURRENCY', label: 'Currency' },
  { value: 'BOOLEAN', label: 'Boolean' },
  { value: 'DATE', label: 'Date' },
  { value: 'DATE_TIME', label: 'Date & Time' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'LINK', label: 'Link (URL)' },
  { value: 'SELECT', label: 'Select' },
  { value: 'MULTI_SELECT', label: 'Multi-select' },
  { value: 'RATING', label: 'Rating' },
  { value: 'FILE', label: 'File' },
];

/** A slug validator mirroring isValidFieldKey in objects.server.ts (client-side preview). */
const FIELD_KEY_RE = /^[a-z][a-zA-Z0-9_]*$/;
const RESERVED_FIELD_KEYS = new Set([
  '_id', 'id', 'object', 'userId', 'createdAt', 'updatedAt',
]);
function isValidFieldKey(key: string): boolean {
  return FIELD_KEY_RE.test(key) && !RESERVED_FIELD_KEYS.has(key);
}

/** Slug validator mirroring isValidObjectSlug in objects.server.ts. */
const SLUG_RE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
function isValidObjectSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/* -------------------------------------------------------------------------- */
/*  Sub-types                                                                 */
/* -------------------------------------------------------------------------- */

/** A draggable item in the field list. */
interface FieldRow {
  field: FieldMetadata;
  /** Whether this field is immutable (standard or system field). */
  readonly: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Internal helpers                                                          */
/* -------------------------------------------------------------------------- */

/** Derive FieldRows from ObjectMetadata for the list. */
function buildFieldRows(object: ObjectMetadata): FieldRow[] {
  return object.fields.map((field) => ({
    field,
    readonly: !!(field.system || (object.standard && isStandardField(object))),
  }));
}

/**
 * Returns true when a field on this object is considered read-only for UI
 * purposes. For standard objects every field is treated as readonly here —
 * the server enforces the precise distinction (standard vs. custom-appended
 * fields), but showing them all as immutable keeps the editor consistent.
 */
function isStandardField(object: ObjectMetadata): boolean {
  return !!(object.standard);
}

/** Returns the icon component for a key, or null. */
function IconFor({ name, className }: { name?: string; className?: string }) {
  if (!name) return null;
  const Comp = ICONS[name];
  if (!Comp) return null;
  return <Comp className={className ?? 'h-4 w-4'} />;
}

/** Auto-derive a camelCase field key from a human label. */
function labelToKey(label: string): string {
  const words = label
    .trim()
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '';
  const [first, ...rest] = words;
  return (
    first.charAt(0).toLowerCase() +
    first.slice(1).toLowerCase() +
    rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
  );
}

/* -------------------------------------------------------------------------- */
/*  FieldOptionsEditor                                                        */
/* -------------------------------------------------------------------------- */

interface FieldOptionsEditorProps {
  options: FieldOption[];
  onChange: (next: FieldOption[]) => void;
  disabled?: boolean;
}

function FieldOptionsEditor({ options, onChange, disabled }: FieldOptionsEditorProps) {
  const [newLabel, setNewLabel] = React.useState('');

  function addOption() {
    const label = newLabel.trim();
    if (!label) return;
    const value = label.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    onChange([...options, { value, label }]);
    setNewLabel('');
  }

  function removeOption(idx: number) {
    onChange(options.filter((_, i) => i !== idx));
  }

  function updateLabel(idx: number, label: string) {
    onChange(options.map((o, i) => (i === idx ? { ...o, label } : o)));
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-[var(--st-text-secondary)]">Options</p>
      <div className="flex flex-col gap-1">
        {options.map((opt, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <Input
              value={opt.label}
              onChange={(e) => updateLabel(idx, e.target.value)}
              disabled={disabled}
              className="h-7 flex-1 text-xs"
              placeholder="Option label"
            />
            <span className="font-mono text-[10px] text-[var(--st-text-secondary)] min-w-[56px]">
              {opt.value}
            </span>
            <button
              type="button"
              onClick={() => removeOption(idx)}
              disabled={disabled}
              className="text-[var(--st-text-secondary)] hover:text-[var(--st-danger)] disabled:cursor-not-allowed"
              aria-label={`Remove option ${opt.label}`}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addOption(); }
          }}
          disabled={disabled}
          className="h-7 flex-1 text-xs"
          placeholder="New option label…"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addOption}
          disabled={disabled || !newLabel.trim()}
          className="h-7 px-2"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  FieldEditorDialog                                                         */
/* -------------------------------------------------------------------------- */

interface FieldEditorDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Present when editing an existing field; absent when adding. */
  field?: FieldMetadata;
  objectSlug: string;
  allObjects: ObjectMetadata[];
  projectId?: string;
  onSaved: (updated: ObjectMetadata) => void;
}

function FieldEditorDialog({
  open,
  onOpenChange,
  field,
  objectSlug,
  allObjects,
  projectId,
  onSaved,
}: FieldEditorDialogProps) {
  const { toast } = useToast();
  const isEdit = !!field;

  /* form state */
  const [key, setKey] = React.useState(field?.key ?? '');
  const [label, setLabel] = React.useState(field?.label ?? '');
  const [type, setType] = React.useState<FieldType>(field?.type ?? 'TEXT');
  const [icon, setIcon] = React.useState(field?.icon ?? '');
  const [description, setDescription] = React.useState(field?.description ?? '');
  const [required, setRequired] = React.useState(field?.required ?? false);
  const [inTable, setInTable] = React.useState(field?.inTable ?? false);
  const [isLabel, setIsLabel] = React.useState(field?.isLabel ?? false);
  const [options, setOptions] = React.useState<FieldOption[]>(field?.options ?? []);
  const [relationTarget, setRelationTarget] = React.useState(
    field?.relation?.targetObject ?? '',
  );
  const [relationKind, setRelationKind] = React.useState<FieldRelation['kind']>(
    field?.relation?.kind ?? 'MANY_TO_ONE',
  );
  const [saving, setSaving] = React.useState(false);
  const [keyTouched, setKeyTouched] = React.useState(false);

  /* auto-derive key from label (only in add mode before user touches key). */
  React.useEffect(() => {
    if (!isEdit && !keyTouched) {
      setKey(labelToKey(label));
    }
  }, [label, isEdit, keyTouched]);

  /* reset when dialog opens. */
  React.useEffect(() => {
    if (!open) return;
    setKey(field?.key ?? '');
    setLabel(field?.label ?? '');
    setType(field?.type ?? 'TEXT');
    setIcon(field?.icon ?? '');
    setDescription(field?.description ?? '');
    setRequired(field?.required ?? false);
    setInTable(field?.inTable ?? false);
    setIsLabel(field?.isLabel ?? false);
    setOptions(field?.options ?? []);
    setRelationTarget(field?.relation?.targetObject ?? '');
    setRelationKind(field?.relation?.kind ?? 'MANY_TO_ONE');
    setKeyTouched(false);
    setSaving(false);
  }, [open, field]);

  const needsOptions = type === 'SELECT' || type === 'MULTI_SELECT';
  const needsRelation = type === 'RELATION';

  const keyError = key && !isValidFieldKey(key)
    ? 'Must start with a lowercase letter, contain only letters/digits/underscores, and not be a reserved key.'
    : '';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (!label.trim()) {
      toast({ title: 'Label is required', variant: 'destructive' });
      return;
    }
    if (!key || !isValidFieldKey(key)) {
      toast({ title: 'Invalid field key', description: keyError || 'Fix the key to continue.', variant: 'destructive' });
      return;
    }
    if (needsOptions && options.length === 0) {
      toast({ title: 'Add at least one option', variant: 'destructive' });
      return;
    }
    if (needsRelation && !relationTarget) {
      toast({ title: 'Select a target object', variant: 'destructive' });
      return;
    }

    setSaving(true);
    let result;

    if (isEdit) {
      const patch: UpdateFieldPatch = {
        label: label.trim(),
        icon: icon || null,
        description: description.trim() || null,
        required,
        inTable,
        isLabel,
        ...(needsOptions ? { options } : {}),
        ...(needsRelation
          ? { relation: { targetObject: relationTarget, kind: relationKind } }
          : {}),
      };
      result = await updateFieldAction(objectSlug, field!.key, patch, projectId);
    } else {
      const newField: FieldMetadata = {
        key: key.trim(),
        label: label.trim(),
        type,
        icon: icon || undefined,
        description: description.trim() || undefined,
        required,
        inTable,
        isLabel,
        ...(needsOptions ? { options } : {}),
        ...(needsRelation
          ? { relation: { targetObject: relationTarget, kind: relationKind } }
          : {}),
      };
      result = await addFieldAction(objectSlug, newField, projectId);
    }

    setSaving(false);

    if (!result.ok) {
      toast({ title: isEdit ? 'Update failed' : 'Add failed', description: result.error, variant: 'destructive' });
      return;
    }

    toast({ title: isEdit ? 'Field updated.' : 'Field added.' });
    onSaved(result.data);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit field — ${field!.key}` : 'Add field'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'The key and type are immutable; update any other attribute below.'
              : 'New field will be appended to this object.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 pt-1">
          {/* Label */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fe-label">Label <span className="text-[var(--st-danger)]" aria-hidden>*</span></Label>
            <Input
              id="fe-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              disabled={saving}
              placeholder="e.g. Deal Stage"
            />
          </div>

          {/* Key (read-only in edit mode) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fe-key">
              Field key
              {!isEdit && (
                <span className="ml-1 text-xs text-[var(--st-text-secondary)]">(auto-derived, editable)</span>
              )}
            </Label>
            <Input
              id="fe-key"
              value={key}
              onChange={(e) => { setKey(e.target.value); setKeyTouched(true); }}
              disabled={saving || isEdit}
              placeholder="dealStage"
              className={cn('font-mono text-xs', keyError && 'border-[var(--st-danger)]')}
            />
            {keyError && (
              <p className="text-[11px] text-[var(--st-danger)]">{keyError}</p>
            )}
          </div>

          {/* Type (read-only in edit mode) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fe-type">Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as FieldType)}
              disabled={saving || isEdit}
            >
              <SelectTrigger id="fe-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((ft) => (
                  <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEdit && (
              <p className="text-[11px] text-[var(--st-text-secondary)]">
                Type is immutable — remove and re-add the field to change it.
              </p>
            )}
          </div>

          {/* SELECT/MULTI_SELECT options */}
          {needsOptions && (
            <FieldOptionsEditor
              options={options}
              onChange={setOptions}
              disabled={saving}
            />
          )}

          {/* RELATION config */}
          {needsRelation && (
            <div className="flex flex-col gap-3 rounded-[var(--st-radius)] border border-[var(--st-border)] p-3">
              <p className="text-xs font-medium">Relation settings</p>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fe-rtarget">Target object</Label>
                <Select
                  value={relationTarget}
                  onValueChange={setRelationTarget}
                  disabled={saving || isEdit}
                >
                  <SelectTrigger id="fe-rtarget">
                    <SelectValue placeholder="Pick target object" />
                  </SelectTrigger>
                  <SelectContent>
                    {allObjects.map((o) => (
                      <SelectItem key={o.slug} value={o.slug}>
                        {o.labelPlural}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fe-rkind">Cardinality</Label>
                <Select
                  value={relationKind}
                  onValueChange={(v) => setRelationKind(v as FieldRelation['kind'])}
                  disabled={saving || isEdit}
                >
                  <SelectTrigger id="fe-rkind">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MANY_TO_ONE">Many-to-one (belongs to one {relationTarget || 'record'})</SelectItem>
                    <SelectItem value="ONE_TO_MANY">One-to-many (has many {relationTarget || 'records'})</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Icon */}
          <div className="flex flex-col gap-1.5">
            <Label>Icon</Label>
            <IconPicker value={icon} onChange={setIcon} disabled={saving} />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fe-desc">Description</Label>
            <Input
              id="fe-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={saving}
              placeholder="Short description shown in column headers"
            />
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-2">
            <ToggleRow
              label="Required"
              description="Record save will fail if this field is empty."
              checked={required}
              onCheckedChange={setRequired}
              disabled={saving}
            />
            <ToggleRow
              label="Show in table"
              description="Column appears by default in the record table."
              checked={inTable}
              onCheckedChange={setInTable}
              disabled={saving}
            />
            <ToggleRow
              label="Label field"
              description="Used as the record's display title (one per object)."
              checked={isLabel}
              onCheckedChange={setIsLabel}
              disabled={saving}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              {isEdit ? 'Save changes' : 'Add field'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  RelationBuilderDialog                                                     */
/* -------------------------------------------------------------------------- */

interface RelationBuilderDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  objectSlug: string;
  allObjects: ObjectMetadata[];
  projectId?: string;
  onSaved: (updated: ObjectMetadata) => void;
}

function RelationBuilderDialog({
  open,
  onOpenChange,
  objectSlug,
  allObjects,
  projectId,
  onSaved,
}: RelationBuilderDialogProps) {
  const { toast } = useToast();

  const [targetSlug, setTargetSlug] = React.useState('');
  const [kind, setKind] = React.useState<FieldRelation['kind']>('MANY_TO_ONE');
  const [fieldKey, setFieldKey] = React.useState('');
  const [fieldKeyTouched, setFieldKeyTouched] = React.useState(false);
  const [withInverse, setWithInverse] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  /* Auto-derive field key from target slug + kind. */
  React.useEffect(() => {
    if (fieldKeyTouched || !targetSlug) return;
    const target = allObjects.find((o) => o.slug === targetSlug);
    if (!target) return;
    const base = target.labelSingular.replace(/[^a-zA-Z0-9]/g, '') || targetSlug.replace(/-/g, '');
    const derived =
      kind === 'ONE_TO_MANY'
        ? base.charAt(0).toLowerCase() + base.slice(1) + 'Records'
        : base.charAt(0).toLowerCase() + base.slice(1);
    setFieldKey(derived);
  }, [targetSlug, kind, allObjects, fieldKeyTouched]);

  React.useEffect(() => {
    if (!open) return;
    setTargetSlug('');
    setKind('MANY_TO_ONE');
    setFieldKey('');
    setFieldKeyTouched(false);
    setWithInverse(true);
    setSaving(false);
  }, [open]);

  const keyError = fieldKey && !isValidFieldKey(fieldKey)
    ? 'Must be camelCase starting with a lowercase letter.'
    : '';

  const otherObjects = allObjects.filter((o) => o.slug !== objectSlug);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!targetSlug) {
      toast({ title: 'Select a target object', variant: 'destructive' });
      return;
    }
    if (!fieldKey || !isValidFieldKey(fieldKey)) {
      toast({ title: 'Invalid field key', description: keyError || 'Fix the key.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const input: CreateRelationActionInput = {
      fromSlug: objectSlug,
      fieldKey: fieldKey.trim(),
      relation: { targetObject: targetSlug, kind },
      inverse: withInverse,
    };
    const result = await createRelationAction(input, projectId);
    setSaving(false);

    if (!result.ok) {
      toast({ title: 'Relation failed', description: result.error, variant: 'destructive' });
      return;
    }

    toast({ title: 'Relation created.' });
    onSaved(result.data.from);
    onOpenChange(false);
  }

  const targetObject = allObjects.find((o) => o.slug === targetSlug);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add relation</DialogTitle>
          <DialogDescription>
            Link this object to another by adding a RELATION field. A reciprocal
            back-reference field is created on the target by default.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 pt-1">
          {/* Target */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rb-target">Target object <span className="text-[var(--st-danger)]" aria-hidden>*</span></Label>
            <Select value={targetSlug} onValueChange={(v) => { setTargetSlug(v); setFieldKeyTouched(false); }} disabled={saving}>
              <SelectTrigger id="rb-target">
                <SelectValue placeholder="Pick an object" />
              </SelectTrigger>
              <SelectContent>
                {otherObjects.map((o) => (
                  <SelectItem key={o.slug} value={o.slug}>
                    <span className="flex items-center gap-2">
                      <IconFor name={o.icon} className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
                      {o.labelPlural}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Kind */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rb-kind">Cardinality</Label>
            <Select value={kind} onValueChange={(v) => { setKind(v as FieldRelation['kind']); setFieldKeyTouched(false); }} disabled={saving}>
              <SelectTrigger id="rb-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANY_TO_ONE">
                  Many-to-one — each record belongs to one {targetObject?.labelSingular ?? 'target'}
                </SelectItem>
                <SelectItem value="ONE_TO_MANY">
                  One-to-many — each record has many {targetObject?.labelPlural ?? 'targets'}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Field key */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rb-key">Field key on this object</Label>
            <Input
              id="rb-key"
              value={fieldKey}
              onChange={(e) => { setFieldKey(e.target.value); setFieldKeyTouched(true); }}
              disabled={saving}
              className={cn('font-mono text-xs', keyError && 'border-[var(--st-danger)]')}
              placeholder="companyId"
            />
            {keyError && <p className="text-[11px] text-[var(--st-danger)]">{keyError}</p>}
          </div>

          {/* With inverse */}
          <ToggleRow
            label="Create reciprocal field on target"
            description={`Adds a back-reference field on ${targetObject?.labelPlural ?? 'the target'} pointing back here.`}
            checked={withInverse}
            onCheckedChange={setWithInverse}
            disabled={saving}
          />

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Create relation
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*  ToggleRow                                                                 */
/* -------------------------------------------------------------------------- */

interface ToggleRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleRow({ label, description, checked, onCheckedChange, disabled }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-[var(--st-text)]">{label}</span>
        {description && <span className="text-xs text-[var(--st-text-secondary)]">{description}</span>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  FieldListRow                                                              */
/* -------------------------------------------------------------------------- */

interface FieldListRowProps {
  row: FieldRow;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onEdit: () => void;
  onRemove: () => void;
}

function FieldListRow({
  row,
  dragging,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onEdit,
  onRemove,
}: FieldListRowProps) {
  const { field, readonly } = row;
  return (
    <div
      draggable={!readonly}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      className={cn(
        'group flex items-center gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2 transition-opacity',
        dragging && 'opacity-40',
        !readonly && 'cursor-grab active:cursor-grabbing',
        readonly && 'bg-[var(--st-bg-secondary)]/50',
      )}
    >
      {/* Drag handle */}
      <span
        className={cn(
          'shrink-0 text-[var(--st-text-secondary)]',
          readonly ? 'invisible' : 'invisible group-hover:visible',
        )}
        aria-hidden
      >
        <GripVertical className="h-4 w-4" />
      </span>

      {/* Icon */}
      <span className="shrink-0 text-[var(--st-text-secondary)]">
        {field.icon
          ? <IconFor name={field.icon} className="h-4 w-4" />
          : <span className="h-4 w-4 inline-block" />}
      </span>

      {/* Label + key */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm font-medium text-[var(--st-text)]">
          {field.label}
          {field.isLabel && (
            <Badge variant="outline" className="ml-2 py-0 text-[10px]">label</Badge>
          )}
          {field.required && (
            <span className="ml-1 text-[var(--st-danger)] text-xs" aria-label="required">*</span>
          )}
        </span>
        <span className="font-mono text-[10px] text-[var(--st-text-secondary)]">
          {field.key} · {field.type}
          {field.type === 'RELATION' && field.relation && (
            <> → {field.relation.targetObject} ({field.relation.kind})</>
          )}
        </span>
      </div>

      {/* Badges */}
      <div className="flex shrink-0 items-center gap-1">
        {field.inTable && (
          <Badge variant="outline" className="py-0 text-[10px]">table</Badge>
        )}
        {(field.system || readonly) && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Badge variant="secondary" className="py-0 text-[10px]">
                    {field.system ? 'system' : 'standard'}
                  </Badge>
                </span>
              </TooltipTrigger>
              <TooltipContent>This field is managed by SabCRM and cannot be edited or removed.</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Actions */}
      {!readonly && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onEdit}
            className="rounded p-1 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-text)]"
            aria-label={`Edit ${field.label}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)] hover:text-[var(--st-danger)]"
            aria-label={`Remove ${field.label}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ObjectIdentityForm                                                        */
/* -------------------------------------------------------------------------- */

interface ObjectIdentityFormProps {
  slug: string;
  onSlugChange: (v: string) => void;
  slugLocked: boolean;
  labelSingular: string;
  onLabelSingularChange: (v: string) => void;
  labelPlural: string;
  onLabelPluralChange: (v: string) => void;
  icon: string;
  onIconChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  views: Array<'table' | 'board'>;
  onViewsChange: (v: Array<'table' | 'board'>) => void;
  groupByField: string;
  onGroupByFieldChange: (v: string) => void;
  selectableFields: FieldMetadata[];
  disabled: boolean;
  slugError: string;
}

function ObjectIdentityForm({
  slug,
  onSlugChange,
  slugLocked,
  labelSingular,
  onLabelSingularChange,
  labelPlural,
  onLabelPluralChange,
  icon,
  onIconChange,
  description,
  onDescriptionChange,
  views,
  onViewsChange,
  groupByField,
  onGroupByFieldChange,
  selectableFields,
  disabled,
  slugError,
}: ObjectIdentityFormProps) {
  const hasBoard = views.includes('board');

  function toggleBoard(checked: boolean) {
    onViewsChange(
      checked
        ? [...views.filter((v) => v !== 'board'), 'board']
        : views.filter((v) => v !== 'board'),
    );
  }

  const selectFields = selectableFields.filter((f) => f.type === 'SELECT');

  return (
    <div className="flex flex-col gap-4">
      {/* Labels row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="oe-singular">
            Singular label <span className="text-[var(--st-danger)]" aria-hidden>*</span>
          </Label>
          <Input
            id="oe-singular"
            value={labelSingular}
            onChange={(e) => onLabelSingularChange(e.target.value)}
            disabled={disabled}
            placeholder="Ticket"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="oe-plural">
            Plural label <span className="text-[var(--st-danger)]" aria-hidden>*</span>
          </Label>
          <Input
            id="oe-plural"
            value={labelPlural}
            onChange={(e) => onLabelPluralChange(e.target.value)}
            disabled={disabled}
            placeholder="Tickets"
          />
        </div>
      </div>

      {/* Slug */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="oe-slug">
          Slug
          {slugLocked && (
            <span className="ml-1 text-xs text-[var(--st-text-secondary)]">(locked after creation)</span>
          )}
        </Label>
        <Input
          id="oe-slug"
          value={slug}
          onChange={(e) => onSlugChange(e.target.value.toLowerCase())}
          disabled={disabled || slugLocked}
          placeholder="support-tickets"
          className={cn('font-mono text-xs', slugError && 'border-[var(--st-danger)]')}
        />
        {slugError && <p className="text-[11px] text-[var(--st-danger)]">{slugError}</p>}
        {!slugLocked && (
          <p className="text-[11px] text-[var(--st-text-secondary)]">
            Lowercase kebab-case. Used in URLs and as the collection key — cannot be changed after creation.
          </p>
        )}
      </div>

      {/* Icon */}
      <div className="flex flex-col gap-1.5">
        <Label>Icon <span className="text-[var(--st-danger)]" aria-hidden>*</span></Label>
        <IconPicker value={icon} onChange={onIconChange} disabled={disabled} />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="oe-desc">Description</Label>
        <Textarea
          id="oe-desc"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          disabled={disabled}
          placeholder="What records does this object store?"
          rows={2}
          className="resize-none text-sm"
        />
      </div>

      {/* Board view */}
      <ToggleRow
        label="Enable board view"
        description="Kanban view grouped by a SELECT field."
        checked={hasBoard}
        onCheckedChange={toggleBoard}
        disabled={disabled}
      />

      {hasBoard && (
        <div className="flex flex-col gap-1.5 pl-4 border-l-2 border-[var(--st-border)]">
          <Label htmlFor="oe-groupby">Group by field</Label>
          <Select value={groupByField} onValueChange={onGroupByFieldChange} disabled={disabled}>
            <SelectTrigger id="oe-groupby">
              <SelectValue placeholder="Pick a SELECT field" />
            </SelectTrigger>
            <SelectContent>
              {selectFields.map((f) => (
                <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectFields.length === 0 && (
            <p className="text-[11px] text-[var(--st-text-secondary)]">
              Add a SELECT field first to enable the board view.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main ObjectEditor                                                         */
/* -------------------------------------------------------------------------- */

export interface ObjectEditorProps {
  /** Present in edit mode; omit for create mode. */
  object?: ObjectMetadata;
  /** Full list of objects in the project (for the relation builder). */
  allObjects: ObjectMetadata[];
  /** Active project override forwarded to every action. */
  projectId?: string;
  /**
   * Called after any successful mutation (object create/update or field
   * create/update/remove/reorder). The parent can use this to re-fetch or
   * navigate.
   */
  onChanged?: (updated: ObjectMetadata) => void;
  /**
   * Called after a successful object deletion. Only relevant in edit mode.
   */
  onDeleted?: (slug: string) => void;
}

/**
 * Unified create / edit panel for a CRM object.
 *
 * - Create mode (`object` is undefined): shows the identity form + saves a new
 *   custom object.
 * - Edit mode (`object` is provided): shows the identity form (standard objects
 *   are read-only) + the full field list with add / edit / reorder / remove.
 */
export function ObjectEditor({
  object,
  allObjects: initialAllObjects,
  projectId,
  onChanged,
  onDeleted,
}: ObjectEditorProps) {
  const { toast } = useToast();
  const isEdit = !!object;
  const isStandard = object?.standard ?? false;

  /* ---------------------------------------------------------------------- */
  /*  Identity state                                                         */
  /* ---------------------------------------------------------------------- */

  const [slug, setSlug] = React.useState(object?.slug ?? '');
  const [labelSingular, setLabelSingular] = React.useState(object?.labelSingular ?? '');
  const [labelPlural, setLabelPlural] = React.useState(object?.labelPlural ?? '');
  const [icon, setIcon] = React.useState(object?.icon ?? '');
  const [description, setDescription] = React.useState(object?.description ?? '');
  const [views, setViews] = React.useState<Array<'table' | 'board'>>(object?.views ?? ['table']);
  const [groupByField, setGroupByField] = React.useState(object?.board?.groupByField ?? '');
  const [slugTouched, setSlugTouched] = React.useState(false);

  /* ---------------------------------------------------------------------- */
  /*  Live object metadata (updated after mutations in edit mode)            */
  /* ---------------------------------------------------------------------- */

  const [liveObject, setLiveObject] = React.useState<ObjectMetadata | undefined>(object);
  const [allObjects, setAllObjects] = React.useState<ObjectMetadata[]>(initialAllObjects);

  /* Keep all-objects list in sync after relation creation (target also changes). */
  const refreshAllObjects = React.useCallback(async () => {
    const res = await listObjectsAction(projectId);
    if (res.ok) setAllObjects(res.data);
  }, [projectId]);

  /* ---------------------------------------------------------------------- */
  /*  Field list + drag-and-drop state                                       */
  /* ---------------------------------------------------------------------- */

  const fieldRows = React.useMemo(
    () => (liveObject ? buildFieldRows(liveObject) : []),
    [liveObject],
  );
  const customFieldRows = React.useMemo(
    () => fieldRows.filter((r) => !r.readonly),
    [fieldRows],
  );

  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);
  const [reordering, setReordering] = React.useState(false);

  /** Compute display order with the dragged item speculatively repositioned. */
  const displayRows = React.useMemo<FieldRow[]>(() => {
    if (dragIndex === null || overIndex === null) return fieldRows;
    const next = [...fieldRows];
    // Only reorder within the custom range.
    const startGlobal = fieldRows.length - customFieldRows.length;
    const dragGlobal = startGlobal + dragIndex;
    const overGlobal = startGlobal + overIndex;
    if (dragGlobal < 0 || overGlobal < 0) return next;
    const [item] = next.splice(dragGlobal, 1);
    next.splice(overGlobal, 0, item);
    return next;
  }, [fieldRows, customFieldRows.length, dragIndex, overIndex]);

  /* ---------------------------------------------------------------------- */
  /*  Dialog state                                                           */
  /* ---------------------------------------------------------------------- */

  const [addFieldOpen, setAddFieldOpen] = React.useState(false);
  const [editField, setEditField] = React.useState<FieldMetadata | undefined>();
  const [editFieldOpen, setEditFieldOpen] = React.useState(false);
  const [relationOpen, setRelationOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  /* ---------------------------------------------------------------------- */
  /*  Saving state (identity save)                                           */
  /* ---------------------------------------------------------------------- */

  const [saving, setSaving] = React.useState(false);

  /* ---------------------------------------------------------------------- */
  /*  Auto-derive slug from singular label (create mode only)               */
  /* ---------------------------------------------------------------------- */

  React.useEffect(() => {
    if (isEdit || slugTouched) return;
    const derived = labelSingular
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    // Pluralise naively (append s) to produce a reasonable default slug.
    const plural = derived ? derived + 's' : '';
    setSlug(plural);
  }, [labelSingular, isEdit, slugTouched]);

  /* ---------------------------------------------------------------------- */
  /*  Identity save handler                                                  */
  /* ---------------------------------------------------------------------- */

  const slugError =
    slug && !isValidObjectSlug(slug)
      ? 'Use lowercase kebab-case, e.g. "support-tickets".'
      : '';

  async function onSaveIdentity(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;

    if (!labelSingular.trim() || !labelPlural.trim()) {
      toast({ title: 'Labels are required', variant: 'destructive' });
      return;
    }
    if (!icon.trim()) {
      toast({ title: 'An icon is required', variant: 'destructive' });
      return;
    }
    if (!isEdit && (!slug || !isValidObjectSlug(slug))) {
      toast({ title: 'Invalid slug', description: slugError || 'Fix the slug.', variant: 'destructive' });
      return;
    }

    setSaving(true);

    if (isEdit && !isStandard) {
      const patch: UpdateObjectPatch = {
        labelSingular: labelSingular.trim(),
        labelPlural: labelPlural.trim(),
        icon: icon.trim(),
        description: description.trim() || null,
        views,
        board: views.includes('board') && groupByField ? { groupByField } : null,
      };
      const res = await updateObjectAction(object!.slug, patch, projectId);
      setSaving(false);
      if (!res.ok) {
        toast({ title: 'Update failed', description: res.error, variant: 'destructive' });
        return;
      }
      setLiveObject(res.data);
      toast({ title: `${res.data.labelSingular} updated.` });
      onChanged?.(res.data);
      return;
    }

    if (!isEdit) {
      const input: CreateCustomObjectInput = {
        slug: slug.trim(),
        labelSingular: labelSingular.trim(),
        labelPlural: labelPlural.trim(),
        icon: icon.trim(),
        description: description.trim() || undefined,
        views,
        board: views.includes('board') && groupByField ? { groupByField } : undefined,
      };
      const res = await createCustomObjectAction(input, projectId);
      setSaving(false);
      if (!res.ok) {
        toast({ title: 'Create failed', description: res.error, variant: 'destructive' });
        return;
      }
      setLiveObject(res.data);
      toast({ title: `${res.data.labelSingular} created.` });
      onChanged?.(res.data);
      return;
    }

    // Standard objects: identity is immutable, nothing to save.
    setSaving(false);
  }

  /* ---------------------------------------------------------------------- */
  /*  Field remove handler                                                   */
  /* ---------------------------------------------------------------------- */

  const [removingField, setRemovingField] = React.useState<string | null>(null);
  const [fieldToRemove, setFieldToRemove] = React.useState<FieldMetadata | null>(null);

  async function confirmRemoveField() {
    if (!fieldToRemove || !liveObject) return;
    setRemovingField(fieldToRemove.key);
    const res = await removeFieldAction(liveObject.slug, fieldToRemove.key, projectId);
    setRemovingField(null);
    setFieldToRemove(null);
    if (!res.ok) {
      toast({ title: 'Remove failed', description: res.error, variant: 'destructive' });
      return;
    }
    setLiveObject(res.data);
    toast({ title: `Field "${fieldToRemove.label}" removed.` });
    onChanged?.(res.data);
  }

  /* ---------------------------------------------------------------------- */
  /*  Field reorder handler                                                  */
  /* ---------------------------------------------------------------------- */

  async function commitReorder() {
    if (!liveObject || dragIndex === null || overIndex === null || dragIndex === overIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }

    // Build the new custom-key order from the speculative display.
    const startGlobal = fieldRows.length - customFieldRows.length;
    const newCustomKeys = displayRows
      .slice(startGlobal)
      .map((r) => r.field.key);

    setDragIndex(null);
    setOverIndex(null);
    setReordering(true);
    const res = await reorderFieldsAction(liveObject.slug, newCustomKeys, projectId);
    setReordering(false);
    if (!res.ok) {
      toast({ title: 'Reorder failed', description: res.error, variant: 'destructive' });
      return;
    }
    setLiveObject(res.data);
    onChanged?.(res.data);
  }

  /* ---------------------------------------------------------------------- */
  /*  Object delete handler                                                  */
  /* ---------------------------------------------------------------------- */

  const [deleting, setDeleting] = React.useState(false);

  async function confirmDelete() {
    if (!liveObject || isStandard) return;
    setDeleting(true);
    const res = await deleteCustomObjectAction(liveObject.slug, {}, projectId);
    setDeleting(false);
    if (!res.ok) {
      // If there are records, ask the user to force.
      toast({
        title: 'Delete failed',
        description: res.error,
        variant: 'destructive',
      });
      setDeleteOpen(false);
      return;
    }
    toast({ title: `${liveObject.labelSingular} deleted.` });
    onDeleted?.(liveObject.slug);
    setDeleteOpen(false);
  }

  /* ---------------------------------------------------------------------- */
  /*  Field save callback (shared between add + edit dialogs)                */
  /* ---------------------------------------------------------------------- */

  function onFieldSaved(updated: ObjectMetadata) {
    setLiveObject(updated);
    onChanged?.(updated);
  }

  /* ---------------------------------------------------------------------- */
  /*  Render helpers                                                         */
  /* ---------------------------------------------------------------------- */

  const currentSlug = liveObject?.slug ?? '';
  const selectableFieldsForBoard = liveObject?.fields ?? [];

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                 */
  /* ---------------------------------------------------------------------- */

  return (
    <div className="zoruui flex flex-col gap-6">
      {/* ── Identity section ───────────────────────────────────────────── */}
      <section aria-labelledby="oe-identity-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 id="oe-identity-heading" className="text-base font-semibold text-[var(--st-text)]">
              {isEdit ? 'Object settings' : 'New object'}
            </h2>
            <p className="text-xs text-[var(--st-text-secondary)]">
              {isEdit
                ? isStandard
                  ? 'Standard objects are read-only. You can add custom fields below.'
                  : 'Edit the labels, icon, and description.'
                : 'Define the new custom object for this project.'}
            </p>
          </div>
          {isEdit && !isStandard && (
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-[var(--st-text-secondary)] hover:text-[var(--st-danger)]"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete object
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {liveObject?.labelSingular}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the object definition. If there are existing records,
                    deletion will be refused — use the force-delete option in the API if needed.
                    Inbound relation fields on other objects will be detached automatically.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={confirmDelete}
                    disabled={deleting}
                    className="bg-[var(--st-danger)] text-white hover:bg-[var(--st-danger)]/90"
                  >
                    {deleting && <Loader2 className="animate-spin" />}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {isStandard ? (
          /* Standard objects: read-only identity display */
          <div className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]/50 p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)]">
                <IconFor name={object?.icon} className="h-5 w-5 text-[var(--st-text)]" />
              </span>
              <div>
                <p className="font-semibold text-[var(--st-text)]">{object?.labelPlural}</p>
                {object?.description && (
                  <p className="text-xs text-[var(--st-text-secondary)]">{object.description}</p>
                )}
              </div>
              <Badge variant="secondary" className="ml-auto text-[10px]">standard</Badge>
            </div>
          </div>
        ) : (
          /* Editable identity form */
          <form onSubmit={onSaveIdentity} className="flex flex-col gap-4">
            <ObjectIdentityForm
              slug={slug}
              onSlugChange={(v) => { setSlug(v); setSlugTouched(true); }}
              slugLocked={isEdit}
              labelSingular={labelSingular}
              onLabelSingularChange={setLabelSingular}
              labelPlural={labelPlural}
              onLabelPluralChange={setLabelPlural}
              icon={icon}
              onIconChange={setIcon}
              description={description}
              onDescriptionChange={setDescription}
              views={views}
              onViewsChange={setViews}
              groupByField={groupByField}
              onGroupByFieldChange={setGroupByField}
              selectableFields={selectableFieldsForBoard}
              disabled={saving}
              slugError={slugError}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                {isEdit ? 'Save changes' : 'Create object'}
              </Button>
            </div>
          </form>
        )}
      </section>

      {/* Only show field management once we have a persisted object. */}
      {liveObject && (
        <>
          <Separator />

          {/* ── Fields section ─────────────────────────────────────────── */}
          <section aria-labelledby="oe-fields-heading" className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 id="oe-fields-heading" className="text-base font-semibold text-[var(--st-text)]">
                  Fields
                  <Badge variant="outline" className="ml-2 text-xs">
                    {liveObject.fields.length}
                  </Badge>
                  {reordering && (
                    <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-[var(--st-text-secondary)]" />
                  )}
                </h2>
                <p className="text-xs text-[var(--st-text-secondary)]">
                  Drag custom fields to reorder. Standard and system fields always appear first and are immutable.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRelationOpen(true)}
                  className="gap-1.5"
                >
                  <Link2 className="h-4 w-4" />
                  Add relation
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setAddFieldOpen(true)}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Add field
                </Button>
              </div>
            </div>

            {/* Field list */}
            <ScrollArea className="max-h-[480px] pr-2">
              <div
                className="flex flex-col gap-1.5"
                onDragOver={(e) => e.preventDefault()}
              >
                {displayRows.map((row, globalIdx) => {
                  const startGlobal = fieldRows.length - customFieldRows.length;
                  const customIdx = globalIdx - startGlobal;
                  const isCustom = customIdx >= 0;
                  return (
                    <FieldListRow
                      key={row.field.key}
                      row={row}
                      dragging={isCustom && dragIndex === customIdx}
                      onDragStart={() => { if (isCustom) setDragIndex(customIdx); }}
                      onDragEnter={() => { if (isCustom) setOverIndex(customIdx); }}
                      onDragEnd={commitReorder}
                      onEdit={() => {
                        setEditField(row.field);
                        setEditFieldOpen(true);
                      }}
                      onRemove={() => setFieldToRemove(row.field)}
                    />
                  );
                })}

                {liveObject.fields.length === 0 && (
                  <p className="py-6 text-center text-sm text-[var(--st-text-secondary)]">
                    No fields yet. Add your first field above.
                  </p>
                )}
              </div>
            </ScrollArea>
          </section>
        </>
      )}

      {/* ── Dialogs ──────────────────────────────────────────────────────── */}

      {/* Add field */}
      {liveObject && (
        <FieldEditorDialog
          open={addFieldOpen}
          onOpenChange={setAddFieldOpen}
          objectSlug={liveObject.slug}
          allObjects={allObjects}
          projectId={projectId}
          onSaved={onFieldSaved}
        />
      )}

      {/* Edit field */}
      {liveObject && editField && (
        <FieldEditorDialog
          open={editFieldOpen}
          onOpenChange={(v) => {
            setEditFieldOpen(v);
            if (!v) setEditField(undefined);
          }}
          field={editField}
          objectSlug={liveObject.slug}
          allObjects={allObjects}
          projectId={projectId}
          onSaved={onFieldSaved}
        />
      )}

      {/* Relation builder */}
      {liveObject && (
        <RelationBuilderDialog
          open={relationOpen}
          onOpenChange={setRelationOpen}
          objectSlug={liveObject.slug}
          allObjects={allObjects}
          projectId={projectId}
          onSaved={async (updated) => {
            setLiveObject(updated);
            onChanged?.(updated);
            await refreshAllObjects();
          }}
        />
      )}

      {/* Remove field confirmation */}
      <AlertDialog
        open={!!fieldToRemove}
        onOpenChange={(v) => { if (!v) setFieldToRemove(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove field "{fieldToRemove?.label}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The field will be removed from the schema. Existing record data stored
              under this key will be orphaned but not immediately deleted from the
              database — data for this key will no longer appear in the UI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!removingField}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRemoveField}
              disabled={!!removingField}
              className="bg-[var(--st-danger)] text-white hover:bg-[var(--st-danger)]/90"
            >
              {removingField && <Loader2 className="animate-spin" />}
              Remove field
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
