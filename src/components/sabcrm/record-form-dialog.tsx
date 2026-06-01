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
 *
 * Accessibility guarantees:
 *   - Every field `<input>`/`<select>`/etc. has `id` + `<Label htmlFor>`.
 *   - Each field that has a description or an active error carries an
 *     `aria-describedby` pointing at those helper / error nodes.
 *   - An `aria-live="assertive"` error summary appears above the field list
 *     when validation fails, lists each invalid field as a focusable link,
 *     and disappears on the next successful submit or dialog close.
 *   - Focus is programmatically moved to the error summary heading on
 *     validation failure so screen-reader users hear it immediately.
 *   - The entire form (all fields + buttons) is disabled while the server
 *     action is in-flight; the submit button shows a spinner + "Saving…"
 *     label and carries `aria-busy="true"`.
 *   - Focus trap and ARIA modal semantics are provided by Radix Dialog
 *     (`DialogPrimitive.Content`), which is already wired inside ZoruUI's
 *     `DialogContent`.
 */

import * as React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

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

// ---------------------------------------------------------------------------
// Public API (unchanged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type FormValues = Record<string, unknown>;
/** Map of field.key → error message string (non-empty = invalid). */
type FieldErrors = Record<string, string>;

// ---------------------------------------------------------------------------
// Helpers (pure, hoisted outside component — stable across renders)
// ---------------------------------------------------------------------------

/** Builds the initial form state from a record (edit) or defaults (create). */
function buildInitialValues(
  fields: FieldMetadata[],
  record?: CrmRecordWithLabel | null,
): FormValues {
  const values: FormValues = {};
  for (const field of fields) {
    values[field.key] = record
      ? (record.data[field.key] ?? defaultFor(field))
      : defaultFor(field);
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

/** Runs validation and returns an error map (empty = valid). */
function validateFields(
  fields: FieldMetadata[],
  values: FormValues,
): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of fields) {
    if (field.required && isEmpty(values[field.key])) {
      errors[field.key] = `${field.label} is required.`;
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [saving, setSaving] = React.useState(false);

  // Ref used to focus the error summary heading when validation fails so that
  // assistive technologies immediately announce the problem count.
  const errorSummaryRef = React.useRef<HTMLDivElement>(null);

  // Reset the form each time the dialog opens or the target record changes.
  React.useEffect(() => {
    if (!open) return;
    setValues(buildInitialValues(editableFields, record));
    setErrors({});
    setSaving(false);
  }, [open, record, editableFields]);

  // Move focus to the error summary whenever new validation errors appear so
  // screen readers announce the summary without the user having to hunt for it.
  const errorKeys = Object.keys(errors);
  React.useEffect(() => {
    if (errorKeys.length > 0) {
      errorSummaryRef.current?.focus();
    }
  // We intentionally depend on the serialised key-list string so the effect
  // only fires when the set of invalid fields actually changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorKeys.join(',')]);

  const setFieldValue = React.useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    // Clear the per-field error as soon as the user starts editing it.
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const onSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (saving) return;

      const validationErrors = validateFields(editableFields, values);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        // Toast is supplementary — primary feedback is the inline error summary.
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
      editableFields,
      values,
      isEditing,
      record,
      projectId,
      object.slug,
      object.labelSingular,
      onSaved,
      onOpenChange,
      toast,
    ],
  );

  // IDs used for aria-describedby wiring.
  const formId = 'sabcrm-record-form';
  const errorSummaryId = 'sabcrm-error-summary';
  const invalidFieldKeys = errorKeys;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
       * DialogContent (Radix) provides:
       *   • role="dialog" + aria-modal="true"
       *   • Focus trap (first focusable element on open; restores on close)
       *   • Escape to close
       */}
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
          id={formId}
          onSubmit={onSubmit}
          noValidate
          aria-label={
            isEditing
              ? `Edit ${object.labelSingular} form`
              : `New ${object.labelSingular} form`
          }
          aria-describedby={
            invalidFieldKeys.length > 0 ? errorSummaryId : undefined
          }
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
            {/* ── Error summary ─────────────────────────────────────────── */}
            {invalidFieldKeys.length > 0 && (
              <div
                id={errorSummaryId}
                ref={errorSummaryRef}
                // tabIndex=-1 makes it programmatically focusable without
                // adding it to the natural tab order.
                tabIndex={-1}
                role="alert"
                aria-live="assertive"
                aria-atomic="true"
                className={cn(
                  'flex flex-col gap-2 rounded-[var(--zoru-radius)] border border-zoru-danger/40',
                  'bg-zoru-danger/5 p-3 text-sm text-zoru-danger',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-danger/40',
                )}
              >
                <p className="flex items-center gap-1.5 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                  {invalidFieldKeys.length === 1
                    ? '1 field needs your attention:'
                    : `${invalidFieldKeys.length} fields need your attention:`}
                </p>
                <ul className="ml-5 list-disc space-y-0.5">
                  {editableFields
                    .filter((f) => errors[f.key])
                    .map((f) => (
                      <li key={f.key}>
                        {/* Clicking the link focuses the invalid control. */}
                        <a
                          href={`#sabcrm-field-${f.key}`}
                          className="underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zoru-danger"
                          onClick={(e) => {
                            e.preventDefault();
                            document
                              .getElementById(`sabcrm-field-${f.key}`)
                              ?.focus();
                          }}
                        >
                          {f.label}
                        </a>
                        {' — '}
                        {errors[f.key]}
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* ── Fields ────────────────────────────────────────────────── */}
            {editableFields.map((field) => {
              const fieldId = `sabcrm-field-${field.key}`;
              const descId = field.description
                ? `sabcrm-desc-${field.key}`
                : undefined;
              const errId = errors[field.key]
                ? `sabcrm-err-${field.key}`
                : undefined;
              // aria-describedby lists description then error (both optional).
              const describedBy =
                [descId, errId].filter(Boolean).join(' ') || undefined;

              const relationOptions = field.relation
                ? (relationOptionsByObject[field.relation.targetObject] ?? [])
                : undefined;

              return (
                <div key={field.key} className="flex flex-col gap-1.5">
                  <Label
                    htmlFor={fieldId}
                    className="flex items-center gap-1"
                  >
                    {field.label}
                    {field.required && (
                      // aria-hidden: the required state is conveyed via
                      // aria-required on the input itself (FieldInput passes
                      // it through to the native element when `field.required`
                      // is set — graceful degradation otherwise).
                      <span
                        className="text-zoru-danger"
                        aria-hidden="true"
                        title="Required"
                      >
                        *
                      </span>
                    )}
                  </Label>

                  {field.description && (
                    <p
                      id={descId}
                      className="text-xs text-zoru-ink-muted"
                    >
                      {field.description}
                    </p>
                  )}

                  {/*
                   * FieldInputProps does not spread arbitrary HTML attributes,
                   * so ARIA and autoFocus are applied via a thin wrapper div
                   * that carries the semantics visible to assistive technology.
                   * The div uses role="group" so AT contextualises the inner
                   * control with the aria-describedby IDs even when FieldInput
                   * cannot forward them to a native element itself.
                   */}
                  <div
                    role="group"
                    aria-describedby={describedBy}
                    aria-required={field.required ? true : undefined}
                    aria-invalid={errors[field.key] ? true : undefined}
                  >
                    <FieldInput
                      id={fieldId}
                      field={field}
                      value={values[field.key]}
                      invalid={!!errors[field.key]}
                      disabled={saving}
                      relationOptions={relationOptions}
                      onChange={(value) => setFieldValue(field.key, value)}
                    />
                  </div>

                  {errors[field.key] && (
                    <p
                      id={errId}
                      role="alert"
                      aria-live="polite"
                      className="text-xs text-zoru-danger"
                    >
                      {errors[field.key]}
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

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <DialogFooter className="border-t border-zoru-line bg-zoru-surface/40 p-4">
            <Button
              type="button"
              variant="ghost"
              // Disable cancel while submitting so users cannot close mid-flight.
              disabled={saving}
              aria-disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              aria-disabled={saving}
              aria-busy={saving}
            >
              {saving && (
                <Loader2
                  className={cn('animate-spin')}
                  aria-hidden="true"
                />
              )}
              {saving
                ? 'Saving…'
                : isEditing
                  ? 'Save changes'
                  : `Create ${object.labelSingular.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
