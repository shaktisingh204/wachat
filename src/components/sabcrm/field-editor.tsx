'use client';

/**
 * SabCRM — field editor dialog.
 *
 * A single controlled dialog for both creating (add) and editing custom fields
 * on any SabCRM object. Covers every {@link FieldType}:
 *
 *   - name / key (add only — immutable once persisted)
 *   - label (always editable)
 *   - type (add only — type is immutable; update path patches label/flags/options)
 *   - options list (SELECT / MULTI_SELECT)
 *   - required / isLabel / inTable flags
 *   - RELATION target + cardinality
 *
 * On save it calls {@link addFieldAction} (create) or
 * {@link updateFieldAction} (edit). Both actions are admin-gated on the
 * server; the dialog surfaces any server error inline.
 *
 * Hosts pass the object's current field list so the dialog can warn on
 * duplicate keys and isLabel conflicts before hitting the server.
 */

import * as React from 'react';
import { Loader2, Plus, Trash2, GripVertical } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
  Input,
  Switch,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Separator,
  cn,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  addFieldAction,
  updateFieldAction,
} from '@/app/actions/sabcrm.actions';
import type {
  FieldMetadata,
  FieldType,
  FieldOption,
  FieldRelation,
  ObjectMetadata,
} from '@/lib/sabcrm/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Every supported field type with a human-readable label. */
const FIELD_TYPES: ReadonlyArray<{ value: FieldType; label: string }> = [
  { value: 'TEXT', label: 'Text' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'CURRENCY', label: 'Currency' },
  { value: 'BOOLEAN', label: 'Boolean (Yes/No)' },
  { value: 'DATE', label: 'Date' },
  { value: 'DATE_TIME', label: 'Date & Time' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'LINK', label: 'Link (URL)' },
  { value: 'SELECT', label: 'Select (single)' },
  { value: 'MULTI_SELECT', label: 'Multi-select' },
  { value: 'RATING', label: 'Rating' },
  { value: 'RELATION', label: 'Relation' },
  { value: 'FILE', label: 'File' },
] as const;

const RELATION_KINDS: ReadonlyArray<{
  value: FieldRelation['kind'];
  label: string;
}> = [
  { value: 'MANY_TO_ONE', label: 'Many-to-one (this record belongs to one)' },
  { value: 'ONE_TO_MANY', label: 'One-to-many (this record has many)' },
] as const;

/** Converts a user-supplied label into a camelCase field key suggestion. */
function labelToKey(label: string): string {
  const words = label
    .trim()
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  return (
    words[0].charAt(0).toLowerCase() +
    words[0].slice(1) +
    words
      .slice(1)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('')
  );
}

/** Returns true for field types that require an options list. */
function needsOptions(type: FieldType): boolean {
  return type === 'SELECT' || type === 'MULTI_SELECT';
}

// ---------------------------------------------------------------------------
// Option list editor (inline sub-component for SELECT / MULTI_SELECT)
// ---------------------------------------------------------------------------

interface OptionListEditorProps {
  options: FieldOption[];
  onChange: (options: FieldOption[]) => void;
  disabled?: boolean;
}

function OptionListEditor({
  options,
  onChange,
  disabled = false,
}: OptionListEditorProps): React.ReactElement {
  const addOption = React.useCallback(() => {
    onChange([...options, { value: '', label: '' }]);
  }, [options, onChange]);

  const removeOption = React.useCallback(
    (idx: number) => {
      onChange(options.filter((_, i) => i !== idx));
    },
    [options, onChange],
  );

  const updateOption = React.useCallback(
    (idx: number, key: keyof FieldOption, raw: string) => {
      onChange(
        options.map((opt, i) =>
          i === idx ? { ...opt, [key]: raw } : opt,
        ),
      );
    },
    [options, onChange],
  );

  return (
    <div className="flex flex-col gap-2">
      {options.map((opt, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <GripVertical
            className="h-4 w-4 shrink-0 text-zoru-ink-muted/40"
            aria-hidden
          />
          <Input
            aria-label={`Option ${idx + 1} value`}
            placeholder="value (no spaces)"
            value={opt.value}
            disabled={disabled}
            className="h-8 flex-1 font-mono text-xs"
            onChange={(e) => updateOption(idx, 'value', e.target.value.replace(/\s/g, '_'))}
          />
          <Input
            aria-label={`Option ${idx + 1} label`}
            placeholder="Label"
            value={opt.label}
            disabled={disabled}
            className="h-8 flex-1 text-xs"
            onChange={(e) => {
              const label = e.target.value;
              onChange(
                options.map((o, i) =>
                  i === idx
                    ? {
                        ...o,
                        label,
                        value: o.value || label.toLowerCase().replace(/\s+/g, '_'),
                      }
                    : o,
                ),
              );
            }}
          />
          <button
            type="button"
            aria-label={`Remove option ${idx + 1}`}
            disabled={disabled}
            onClick={() => removeOption(idx)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--zoru-radius-sm)] text-zoru-ink-muted transition-colors hover:bg-zoru-danger/10 hover:text-zoru-danger disabled:pointer-events-none disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={addOption}
        className="self-start text-xs"
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add option
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draft state
// ---------------------------------------------------------------------------

interface FieldDraft {
  /** camelCase identifier. Set once on create; shown read-only on edit. */
  key: string;
  label: string;
  type: FieldType;
  description: string;
  required: boolean;
  inTable: boolean;
  isLabel: boolean;
  /** SELECT / MULTI_SELECT options. */
  options: FieldOption[];
  /** RELATION target object slug. */
  relationTarget: string;
  /** RELATION cardinality. */
  relationKind: FieldRelation['kind'];
  /** Whether the key field was manually edited (prevents auto-overwrite). */
  keyEdited: boolean;
}

const INITIAL_DRAFT: FieldDraft = {
  key: '',
  label: '',
  type: 'TEXT',
  description: '',
  required: false,
  inTable: false,
  isLabel: false,
  options: [{ value: 'option_1', label: 'Option 1' }],
  relationTarget: '',
  relationKind: 'MANY_TO_ONE',
  keyEdited: false,
};

function buildDraftFromField(field: FieldMetadata): FieldDraft {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    description: field.description ?? '',
    required: field.required ?? false,
    inTable: field.inTable ?? false,
    isLabel: field.isLabel ?? false,
    options:
      field.options && field.options.length > 0
        ? field.options
        : [{ value: 'option_1', label: 'Option 1' }],
    relationTarget: field.relation?.targetObject ?? '',
    relationKind: field.relation?.kind ?? 'MANY_TO_ONE',
    keyEdited: true, // treat existing key as already locked
  };
}

// ---------------------------------------------------------------------------
// Field-level validation (client-side, mirrors server guards)
// ---------------------------------------------------------------------------

const FIELD_KEY_RE = /^[a-z][a-zA-Z0-9_]*$/;
const RESERVED_KEYS = new Set([
  '_id',
  'id',
  'object',
  'userId',
  'createdAt',
  'updatedAt',
]);

interface ValidationErrors {
  key?: string;
  label?: string;
  options?: string;
  relationTarget?: string;
}

function validateDraft(
  draft: FieldDraft,
  isEditing: boolean,
  existingFields: FieldMetadata[],
  hasExistingLabel: boolean,
): ValidationErrors {
  const errs: ValidationErrors = {};

  if (!isEditing) {
    if (!draft.key) {
      errs.key = 'A field key is required.';
    } else if (!FIELD_KEY_RE.test(draft.key)) {
      errs.key =
        'Use camelCase starting with a lowercase letter (e.g. "myField").';
    } else if (RESERVED_KEYS.has(draft.key)) {
      errs.key = `"${draft.key}" is a reserved key.`;
    } else if (existingFields.some((f) => f.key === draft.key)) {
      errs.key = `A field with key "${draft.key}" already exists on this object.`;
    }
  }

  if (!draft.label.trim()) {
    errs.label = 'A label is required.';
  }

  if (needsOptions(draft.type)) {
    const valid = draft.options.every(
      (o) => o.value.trim() && o.label.trim(),
    );
    if (draft.options.length === 0) {
      errs.options = 'At least one option is required.';
    } else if (!valid) {
      errs.options = 'Each option must have both a value and a label.';
    }
  }

  if (draft.type === 'RELATION') {
    if (!draft.relationTarget.trim()) {
      errs.relationTarget = 'A target object is required.';
    }
  }

  return errs;
}

// ---------------------------------------------------------------------------
// Public props
// ---------------------------------------------------------------------------

export interface FieldEditorDialogProps {
  /** The object whose fields are being managed. */
  object: ObjectMetadata;
  /**
   * All objects available in the project — used to populate the RELATION
   * target picker. Pass the result of `listObjectsAction` from the host.
   */
  allObjects: ObjectMetadata[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Existing field when editing; omit or null to create a new field.
   * When provided, key and type are rendered read-only (they are immutable
   * once a field is persisted).
   */
  field?: FieldMetadata | null;
  /** Active project forwarded to the server action. */
  projectId?: string;
  /**
   * Called with the updated {@link ObjectMetadata} after a successful save so
   * the host can refresh its field list without a full page reload.
   */
  onSaved?: (updatedObject: ObjectMetadata) => void;
}

// ---------------------------------------------------------------------------
// Dialog component
// ---------------------------------------------------------------------------

/** Add / edit a SabCRM field within a ZoruUI dialog. */
export function FieldEditorDialog({
  object,
  allObjects,
  open,
  onOpenChange,
  field,
  projectId,
  onSaved,
}: FieldEditorDialogProps): React.ReactElement {
  const { toast } = useZoruToast();
  const isEditing = !!field;

  // ---------------------------------------------------------------------------
  // Draft state
  // ---------------------------------------------------------------------------

  const [draft, setDraft] = React.useState<FieldDraft>(() =>
    field ? buildDraftFromField(field) : { ...INITIAL_DRAFT },
  );
  const [errors, setErrors] = React.useState<ValidationErrors>({});
  const [saving, setSaving] = React.useState(false);

  // Reset when the dialog opens or the target field changes.
  React.useEffect(() => {
    if (!open) return;
    setDraft(field ? buildDraftFromField(field) : { ...INITIAL_DRAFT });
    setErrors({});
    setSaving(false);
  }, [open, field]);

  // ---------------------------------------------------------------------------
  // Derived helpers
  // ---------------------------------------------------------------------------

  /** All fields currently on the object (to check for key collisions). */
  const existingFields = object.fields;

  /** True when this object already has a label field (and it's not the one being edited). */
  const hasExistingLabel = React.useMemo(
    () =>
      existingFields.some(
        (f) => f.isLabel && (!isEditing || f.key !== field?.key),
      ),
    [existingFields, isEditing, field?.key],
  );

  /**
   * Objects available as RELATION targets (exclude self to avoid trivial
   * self-relations, though the server does not block them).
   */
  const relationTargetObjects = React.useMemo(
    () => allObjects.filter((o) => o.slug !== object.slug),
    [allObjects, object.slug],
  );

  // ---------------------------------------------------------------------------
  // Draft setters
  // ---------------------------------------------------------------------------

  const set = React.useCallback(
    <K extends keyof FieldDraft>(key: K, value: FieldDraft[K]) => {
      setDraft((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        const { [key as keyof ValidationErrors]: _, ...rest } = prev;
        return rest as ValidationErrors;
      });
    },
    [],
  );

  const onLabelChange = React.useCallback(
    (label: string) => {
      setDraft((prev) => ({
        ...prev,
        label,
        // Auto-fill key from label until the user explicitly edits the key.
        key: prev.keyEdited ? prev.key : labelToKey(label),
      }));
      setErrors((prev) => {
        const { label: _l, key: _k, ...rest } = prev;
        return rest as ValidationErrors;
      });
    },
    [],
  );

  const onKeyChange = React.useCallback((raw: string) => {
    const key = raw.replace(/[^a-zA-Z0-9_]/g, '');
    setDraft((prev) => ({ ...prev, key, keyEdited: true }));
    setErrors((prev) => {
      const { key: _, ...rest } = prev;
      return rest as ValidationErrors;
    });
  }, []);

  const onTypeChange = React.useCallback((type: FieldType) => {
    setDraft((prev) => ({
      ...prev,
      type,
      // Reset options when switching into a SELECT type.
      options:
        needsOptions(type) && prev.options.length === 0
          ? [{ value: 'option_1', label: 'Option 1' }]
          : prev.options,
    }));
    setErrors((prev) => {
      const { options: _, relationTarget: __, ...rest } = prev;
      return rest as ValidationErrors;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const onSubmit = React.useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (saving) return;

      const errs = validateDraft(
        draft,
        isEditing,
        existingFields,
        hasExistingLabel,
      );
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        toast({
          title: 'Validation error',
          description: Object.values(errs)[0],
          variant: 'destructive',
        });
        return;
      }

      setSaving(true);

      let res: Awaited<
        ReturnType<typeof addFieldAction | typeof updateFieldAction>
      >;

      if (isEditing) {
        // Build only the mutable patch (key + type are immutable).
        res = await updateFieldAction(
          object.slug,
          field!.key,
          {
            label: draft.label.trim(),
            description: draft.description.trim() || null,
            required: draft.required,
            inTable: draft.inTable,
            isLabel: draft.isLabel,
            ...(needsOptions(draft.type) ? { options: draft.options } : {}),
            ...(draft.type === 'RELATION'
              ? {
                  relation: {
                    targetObject: draft.relationTarget.trim(),
                    kind: draft.relationKind,
                  },
                }
              : {}),
          },
          projectId,
        );
      } else {
        // Build the full FieldMetadata for create.
        const newField: FieldMetadata = {
          key: draft.key.trim(),
          label: draft.label.trim(),
          type: draft.type,
          description: draft.description.trim() || undefined,
          required: draft.required,
          inTable: draft.inTable,
          isLabel: draft.isLabel,
          system: false,
          ...(needsOptions(draft.type) ? { options: draft.options } : {}),
          ...(draft.type === 'RELATION'
            ? {
                relation: {
                  targetObject: draft.relationTarget.trim(),
                  kind: draft.relationKind,
                },
              }
            : {}),
        };
        res = await addFieldAction(object.slug, newField, projectId);
      }

      setSaving(false);

      if (!res.ok) {
        toast({
          title: isEditing ? 'Update failed' : 'Add field failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: isEditing
          ? `Field "${draft.label}" updated.`
          : `Field "${draft.label}" added.`,
      });
      onSaved?.(res.data);
      onOpenChange(false);
    },
    [
      saving,
      draft,
      isEditing,
      field,
      existingFields,
      hasExistingLabel,
      object.slug,
      projectId,
      onSaved,
      onOpenChange,
      toast,
    ],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-zoru-line p-5">
          <DialogTitle>
            {isEditing ? `Edit field — ${field!.label}` : 'Add custom field'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the editable attributes of this field. Key and type are immutable.'
              : `Add a new custom field to ${object.labelSingular}.`}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5">
            {/* ── Name / Label row ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {/* Label */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fe-label">
                  Label
                  <span className="text-zoru-danger ml-0.5" aria-hidden>
                    *
                  </span>
                </Label>
                <Input
                  id="fe-label"
                  placeholder="e.g. Deal size"
                  value={draft.label}
                  disabled={saving}
                  aria-invalid={!!errors.label}
                  onChange={(e) => onLabelChange(e.target.value)}
                  className={cn(errors.label && 'border-zoru-danger')}
                />
                {errors.label && (
                  <p className="text-xs text-zoru-danger">{errors.label}</p>
                )}
              </div>

              {/* Key (editable on create, read-only on edit) */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fe-key">
                  Field key
                  {!isEditing && (
                    <span className="text-zoru-danger ml-0.5" aria-hidden>
                      *
                    </span>
                  )}
                </Label>
                {isEditing ? (
                  <div
                    id="fe-key"
                    className="flex h-9 w-full items-center rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 font-mono text-sm text-zoru-ink-muted"
                    aria-readonly="true"
                  >
                    {field!.key}
                  </div>
                ) : (
                  <Input
                    id="fe-key"
                    placeholder="dealSize"
                    value={draft.key}
                    disabled={saving}
                    aria-invalid={!!errors.key}
                    onChange={(e) => onKeyChange(e.target.value)}
                    className={cn('font-mono', errors.key && 'border-zoru-danger')}
                  />
                )}
                {errors.key && (
                  <p className="text-xs text-zoru-danger">{errors.key}</p>
                )}
                {!isEditing && !errors.key && (
                  <p className="text-[11px] text-zoru-ink-subtle">
                    camelCase, starting with a lowercase letter. Immutable after
                    save.
                  </p>
                )}
              </div>
            </div>

            {/* ── Field type ───────────────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fe-type">
                Type
                {!isEditing && (
                  <span className="text-zoru-danger ml-0.5" aria-hidden>
                    *
                  </span>
                )}
              </Label>
              {isEditing ? (
                <div
                  id="fe-type"
                  className="flex h-9 w-full items-center rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 text-sm text-zoru-ink-muted"
                  aria-readonly="true"
                >
                  {FIELD_TYPES.find((t) => t.value === field!.type)?.label ??
                    field!.type}
                </div>
              ) : (
                <Select
                  value={draft.type}
                  disabled={saving}
                  onValueChange={(v) => onTypeChange(v as FieldType)}
                >
                  <SelectTrigger id="fe-type">
                    <SelectValue placeholder="Select type…" />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {isEditing && (
                <p className="text-[11px] text-zoru-ink-subtle">
                  Type is immutable. To change it, remove this field and add a
                  new one.
                </p>
              )}
            </div>

            {/* ── Description ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fe-desc">Description (optional)</Label>
              <Input
                id="fe-desc"
                placeholder="What does this field represent?"
                value={draft.description}
                disabled={saving}
                onChange={(e) => set('description', e.target.value)}
              />
            </div>

            {/* ── SELECT / MULTI_SELECT options ────────────────────────── */}
            {needsOptions(draft.type) && (
              <div className="flex flex-col gap-2">
                <Separator />
                <Label>
                  Options
                  <span className="text-zoru-danger ml-0.5" aria-hidden>
                    *
                  </span>
                </Label>
                {errors.options && (
                  <p className="text-xs text-zoru-danger">{errors.options}</p>
                )}
                <OptionListEditor
                  options={draft.options}
                  onChange={(opts) => set('options', opts)}
                  disabled={saving}
                />
              </div>
            )}

            {/* ── RELATION config ──────────────────────────────────────── */}
            {draft.type === 'RELATION' && (
              <div className="flex flex-col gap-3">
                <Separator />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fe-rel-target">
                    Target object
                    <span className="text-zoru-danger ml-0.5" aria-hidden>
                      *
                    </span>
                  </Label>
                  {isEditing ? (
                    /* On edit, the target is mutable only if the server allows it (it does via updateField). */
                    <Select
                      value={draft.relationTarget}
                      disabled={saving}
                      onValueChange={(v) => set('relationTarget', v)}
                    >
                      <SelectTrigger
                        id="fe-rel-target"
                        className={cn(
                          errors.relationTarget && 'border-zoru-danger',
                        )}
                      >
                        <SelectValue placeholder="Select target object…" />
                      </SelectTrigger>
                      <SelectContent>
                        {relationTargetObjects.map((o) => (
                          <SelectItem key={o.slug} value={o.slug}>
                            {o.labelPlural}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={draft.relationTarget}
                      disabled={saving}
                      onValueChange={(v) => {
                        set('relationTarget', v);
                        setErrors((prev) => {
                          const { relationTarget: _, ...rest } = prev;
                          return rest as ValidationErrors;
                        });
                      }}
                    >
                      <SelectTrigger
                        id="fe-rel-target"
                        className={cn(
                          errors.relationTarget && 'border-zoru-danger',
                        )}
                      >
                        <SelectValue placeholder="Select target object…" />
                      </SelectTrigger>
                      <SelectContent>
                        {relationTargetObjects.map((o) => (
                          <SelectItem key={o.slug} value={o.slug}>
                            {o.labelPlural}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {errors.relationTarget && (
                    <p className="text-xs text-zoru-danger">
                      {errors.relationTarget}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="fe-rel-kind">Cardinality</Label>
                  <Select
                    value={draft.relationKind}
                    disabled={saving}
                    onValueChange={(v) =>
                      set('relationKind', v as FieldRelation['kind'])
                    }
                  >
                    <SelectTrigger id="fe-rel-kind">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATION_KINDS.map((k) => (
                        <SelectItem key={k.value} value={k.value}>
                          {k.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* ── Flags ────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-3">
              <Separator />
              <p className="text-xs font-medium uppercase tracking-wider text-zoru-ink-muted">
                Field behaviour
              </p>

              {/* required */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zoru-ink">Required</p>
                  <p className="text-xs text-zoru-ink-muted">
                    Records cannot be saved without a value for this field.
                  </p>
                </div>
                <Switch
                  checked={draft.required}
                  disabled={saving}
                  onCheckedChange={(v) => set('required', v)}
                  aria-label="Required"
                />
              </div>

              {/* inTable */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zoru-ink">
                    Show in table
                  </p>
                  <p className="text-xs text-zoru-ink-muted">
                    Displayed as a column in the default table view.
                  </p>
                </div>
                <Switch
                  checked={draft.inTable}
                  disabled={saving}
                  onCheckedChange={(v) => set('inTable', v)}
                  aria-label="Show in table"
                />
              </div>

              {/* isLabel */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p
                    className={cn(
                      'text-sm font-medium',
                      hasExistingLabel && !draft.isLabel
                        ? 'text-zoru-ink-muted'
                        : 'text-zoru-ink',
                    )}
                  >
                    Record title (isLabel)
                  </p>
                  <p className="text-xs text-zoru-ink-muted">
                    {hasExistingLabel && !draft.isLabel
                      ? 'Another field is already the record title. Remove that designation first.'
                      : 'Used as the human-readable title everywhere this record appears.'}
                  </p>
                </div>
                <Switch
                  checked={draft.isLabel}
                  disabled={saving || (hasExistingLabel && !draft.isLabel)}
                  onCheckedChange={(v) => set('isLabel', v)}
                  aria-label="Record title (isLabel)"
                />
              </div>
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <DialogFooter className="border-t border-zoru-line bg-zoru-surface/40 p-4">
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className={cn('animate-spin')} />}
              {isEditing ? 'Save changes' : 'Add field'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
