'use client';

/**
 * SabCRM — create / edit record dialog.
 *
 * A metadata-driven form rendered inside a ZoruUI dialog. It builds one
 * {@link FieldInput} per non-system field, performs client-side required
 * validation, and persists through {@link createRecordAction} /
 * {@link updateRecordAction}. File fields use SabFiles (via the field
 * renderer) so no free-text URLs ever enter the form.
 *
 * The dialog is controlled (`open` / `onOpenChange`). On a successful
 * save it invokes `onSaved` with the resulting record so the host can
 * refresh its table / detail view.
 */

import * as React from 'react';
import { Loader2 } from 'lucide-react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  createRecordAction,
  updateRecordAction,
} from '@/app/actions/sabcrm.actions';
import type {
  ObjectMetadata,
  FieldMetadata,
  CrmRecord,
  CrmRecordWithLabel,
} from '@/lib/sabcrm/types';
import { FieldInput, type RelationOption } from './field-renderer';

export interface RecordFormDialogProps {
  object: ObjectMetadata;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing record when editing; omit / null to create a new one. */
  record?: CrmRecordWithLabel | null;
  /** Active project override forwarded to the server action. */
  projectId?: string;
  /** Called with the saved record after a successful create / update. */
  onSaved?: (record: CrmRecord) => void;
  /**
   * RELATION candidate options keyed by target-object slug. The host
   * fetches related records once and passes their {id,label} pairs here.
   */
  relationOptionsByObject?: Record<string, RelationOption[]>;
}

type FormValues = Record<string, unknown>;

/** Builds the initial form state from a record (edit) or defaults (create). */
function buildInitialValues(
  fields: FieldMetadata[],
  record?: CrmRecordWithLabel | null,
): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    if (record) {
      values[field.key] = record.data[field.key] ?? defaultFor(field);
    } else {
      values[field.key] = defaultFor(field);
    }
  }
  return values;
}

function defaultFor(field: FieldMetadata): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue;
  switch (field.type) {
    case 'BOOLEAN':
      return false;
    case 'MULTI_SELECT':
    case 'RELATION':
      return [];
    default:
      return '';
  }
}

/** Returns true when a value should be treated as empty for required checks. */
function isEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Create / edit dialog driven entirely off object metadata. */
export function RecordFormDialog({
  object,
  open,
  onOpenChange,
  record,
  projectId,
  onSaved,
  relationOptionsByObject = {},
}: RecordFormDialogProps): React.ReactElement {
  const { toast } = useZoruToast();
  const isEditing = !!record;

  // Editable fields exclude system fields (read-only, runtime-managed).
  const editableFields = React.useMemo<FieldMetadata[]>(
    () => object.fields.filter((f) => !f.system),
    [object.fields],
  );

  const [values, setValues] = React.useState<FormValues>(() =>
    buildInitialValues(editableFields, record),
  );
  const [errors, setErrors] = React.useState<Record<string, boolean>>({});
  const [saving, setSaving] = React.useState(false);

  // Reset the form each time the dialog opens or the target record changes.
  React.useEffect(() => {
    if (!open) return;
    setValues(buildInitialValues(editableFields, record));
    setErrors({});
    setSaving(false);
  }, [open, record, editableFields]);

  const setFieldValue = React.useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: false } : prev));
  }, []);

  const validate = React.useCallback((): boolean => {
    const next: Record<string, boolean> = {};
    for (const field of editableFields) {
      if (field.required && isEmpty(values[field.key])) {
        next[field.key] = true;
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [editableFields, values]);

  const onSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (saving) return;
      if (!validate()) {
        toast({
          title: 'Missing required fields',
          description: 'Please fill in the highlighted fields.',
          variant: 'destructive',
        });
        return;
      }

      setSaving(true);
      const res = isEditing
        ? await updateRecordAction(record!._id, values, projectId)
        : await createRecordAction(object.slug, values, projectId);
      setSaving(false);

      if (!res.ok) {
        toast({
          title: isEditing ? 'Update failed' : 'Create failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: isEditing
          ? `${object.labelSingular} updated.`
          : `${object.labelSingular} created.`,
      });
      onSaved?.(res.data);
      onOpenChange(false);
    },
    [
      saving,
      validate,
      isEditing,
      record,
      values,
      projectId,
      object.slug,
      object.labelSingular,
      onSaved,
      onOpenChange,
      toast,
    ],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-zoru-line p-5">
          <DialogTitle>
            {isEditing
              ? `Edit ${object.labelSingular.toLowerCase()}`
              : `New ${object.labelSingular.toLowerCase()}`}
          </DialogTitle>
          {object.description && (
            <DialogDescription>{object.description}</DialogDescription>
          )}
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
            {editableFields.map((field) => {
              const fieldId = `sabcrm-field-${field.key}`;
              const relationOptions = field.relation
                ? relationOptionsByObject[field.relation.targetObject] ?? []
                : undefined;
              return (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <Label htmlFor={fieldId} className="flex items-center gap-1">
                    {field.label}
                    {field.required && (
                      <span className="text-zoru-danger" aria-hidden>
                        *
                      </span>
                    )}
                  </Label>
                  {field.description && field.type !== 'TEXT' && (
                    <p className="text-xs text-zoru-ink-muted">
                      {field.description}
                    </p>
                  )}
                  <FieldInput
                    id={fieldId}
                    field={field}
                    value={values[field.key]}
                    invalid={!!errors[field.key]}
                    disabled={saving}
                    relationOptions={relationOptions}
                    onChange={(value) => setFieldValue(field.key, value)}
                  />
                  {errors[field.key] && (
                    <p className="text-xs text-zoru-danger">
                      {field.label} is required.
                    </p>
                  )}
                </div>
              );
            })}
            {editableFields.length === 0 && (
              <p className="text-sm text-zoru-ink-muted">
                This object has no editable fields.
              </p>
            )}
          </div>

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
              {isEditing ? 'Save changes' : `Create ${object.labelSingular.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
