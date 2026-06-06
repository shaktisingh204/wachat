'use client';

import { Button, Card, Checkbox, ColorPicker, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft,
  LoaderCircle,
  Plus,
  Save,
  X } from 'lucide-react';

/**
 * <CustomFieldForm /> — create + edit form for a CRM custom-field
 * definition (`crm_custom_fields`). Mirrors the email-templates pattern:
 * a single client component bound to `saveCustomField` via
 * `useActionState`, reusable on both the (legacy) new dialog and the
 * dedicated edit page.
 *
 * The list page (`/dashboard/crm/settings/custom-fields`) still uses an
 * inline dialog for backwards compatibility, but the new
 * `[id]/edit/page.tsx` route mounts this component standalone so the
 * full structured-options / validation surface gets the full viewport.
 */

import { EnumFormField } from '@/components/crm/enum-form-field';

import { saveCustomField } from '@/app/actions/crm-custom-fields.actions';
import type {
  CrmCustomFieldDoc,
  CrmCustomFieldOption,
  CrmCustomFieldType,
  CrmCustomFieldValidation,
} from '@/lib/rust-client/crm-custom-fields';

const BASE = '/dashboard/crm/settings/custom-fields';

const ENTITY_KINDS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'contact', label: 'Contacts' },
  { value: 'deal', label: 'Deals' },
  { value: 'lead', label: 'Leads' },
  { value: 'account', label: 'Accounts' },
  { value: 'ticket', label: 'Tickets' },
  { value: 'employee', label: 'Employees' },
  { value: 'vendor', label: 'Vendors' },
  { value: 'item', label: 'Items' },
  { value: 'project', label: 'Projects' },
];

const FIELD_TYPES: ReadonlyArray<{ value: CrmCustomFieldType; label: string }> = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date & time' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select', label: 'Single select' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'file', label: 'File' },
];

const OPTION_BEARING: ReadonlySet<CrmCustomFieldType> = new Set([
  'select',
  'multiselect',
]);

const VALIDATABLE: ReadonlySet<CrmCustomFieldType> = new Set([
  'text',
  'textarea',
  'number',
  'currency',
]);

type SaveState = { message?: string; error?: string; id?: string };
const initialState: SaveState = {};

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      {isEditing ? 'Save changes' : 'Create field'}
    </Button>
  );
}

function FlagRow({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  useEffect(() => {
    setChecked(defaultChecked);
  }, [defaultChecked]);
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[var(--st-text)]">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => setChecked(v === true)}
      />
      {checked ? <input type="hidden" name={name} value="on" /> : null}
      <span>{label}</span>
    </label>
  );
}

export function CustomFieldForm({
  initialData,
}: {
  initialData?: CrmCustomFieldDoc | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const isEditing = !!initialData?._id;

  const [state, formAction] = useActionState(saveCustomField, initialState);

  const [entityKind, setEntityKind] = useState<string>(
    initialData?.entityKind ?? 'contact',
  );
  const [fieldType, setFieldType] = useState<CrmCustomFieldType>(
    (initialData?.fieldType as CrmCustomFieldType) ?? 'text',
  );
  const [options, setOptions] = useState<CrmCustomFieldOption[]>(
    initialData?.options ? [...initialData.options] : [],
  );
  const validation: CrmCustomFieldValidation = initialData?.validation ?? {};

  useEffect(() => {
    if (state?.message) {
      toast({
        title: isEditing ? 'Field updated' : 'Field created',
        description: state.message,
      });
      const target = state.id ?? initialData?._id;
      router.push(target ? `${BASE}/${target}` : BASE);
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router, isEditing, initialData]);

  const showOptions = OPTION_BEARING.has(fieldType);
  const showValidation = VALIDATABLE.has(fieldType);

  const updateOption = (idx: number, patch: Partial<CrmCustomFieldOption>) => {
    setOptions((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    );
  };

  return (
    <Card className="p-6">
      <form action={formAction} className="flex flex-col gap-6">
        {isEditing ? (
          <input
            type="hidden"
            name="fieldId"
            value={String(initialData!._id)}
          />
        ) : null}
        <input
          type="hidden"
          name="optionsJson"
          value={JSON.stringify(options)}
        />

        {/* Row 1: entityKind + fieldType */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="entityKind">Entity *</Label>
            <Select
              name="entityKind"
              value={entityKind}
              onValueChange={setEntityKind}
              required
            >
              <SelectTrigger id="entityKind">
                <SelectValue placeholder="Pick an entity…" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_KINDS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fieldType">Field type *</Label>
            <EnumFormField
              name="fieldType"
              enumName="customFieldType"
              initialId={fieldType}
              onChange={(id) => setFieldType((id ?? 'text') as CrmCustomFieldType)}
              required
              placeholder="Pick a type…"
            />
          </div>
        </div>

        {/* Row 2: label + name */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="label">Display label *</Label>
            <Input
              id="label"
              name="label"
              required
              placeholder="e.g. Passport Number"
              defaultValue={initialData?.label ?? ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Internal name *</Label>
            <Input
              id="name"
              name="name"
              required
              pattern="^[a-z][a-z0-9_]*$"
              title="Lowercase letters, digits, and underscores. Must start with a letter."
              placeholder="passport_number"
              defaultValue={initialData?.name ?? ''}
              readOnly={isEditing}
              className={
                isEditing
                  ? 'cursor-not-allowed font-mono opacity-70'
                  : 'font-mono'
              }
            />
          </div>
        </div>

        {/* Row 3: placeholder + section */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="placeholder">Placeholder</Label>
            <Input
              id="placeholder"
              name="placeholder"
              placeholder="Shown inside empty inputs"
              defaultValue={initialData?.placeholder ?? ''}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section">Section</Label>
            <Input
              id="section"
              name="section"
              placeholder="e.g. Identification"
              defaultValue={initialData?.section ?? ''}
            />
          </div>
        </div>

        {/* Row 4: helpText */}
        <div className="space-y-1.5">
          <Label htmlFor="helpText">Help text</Label>
          <Textarea
            id="helpText"
            name="helpText"
            rows={2}
            placeholder="A short hint shown below the field on forms."
            defaultValue={initialData?.helpText ?? ''}
          />
        </div>

        {/* Row 5: displayOrder */}
        <div className="space-y-1.5">
          <Label htmlFor="displayOrder">Display order</Label>
          <Input
            id="displayOrder"
            name="displayOrder"
            type="number"
            min={0}
            step={1}
            defaultValue={initialData?.displayOrder ?? 0}
            className="max-w-[160px]"
          />
        </div>

        {/* Flags */}
        <div className="rounded-md border border-[var(--st-border)] p-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
            Flags
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FlagRow
              name="required"
              label="Required"
              defaultChecked={initialData?.required ?? false}
            />
            <FlagRow
              name="unique"
              label="Unique"
              defaultChecked={initialData?.unique ?? false}
            />
            <FlagRow
              name="visibleInList"
              label="Visible in list"
              defaultChecked={initialData?.visibleInList ?? false}
            />
            <FlagRow
              name="visibleInForm"
              label="Visible in form"
              defaultChecked={initialData?.visibleInForm ?? true}
            />
            <FlagRow
              name="editableInForm"
              label="Editable in form"
              defaultChecked={initialData?.editableInForm ?? true}
            />
            <FlagRow
              name="isActive"
              label="Active"
              defaultChecked={initialData?.isActive ?? true}
            />
          </div>
        </div>

        {/* Options (select / multiselect) */}
        {showOptions ? (
          <div className="rounded-md border border-[var(--st-border)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                Options
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOptions((prev) => [
                    ...prev,
                    { label: '', value: '', color: '' },
                  ])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add option
              </Button>
            </div>
            {options.length === 0 ? (
              <p className="rounded-md border border-dashed border-[var(--st-border)] px-3 py-4 text-center text-[12px] text-[var(--st-text-secondary)]">
                Add at least one option for a select / multiselect field.
              </p>
            ) : (
              <div className="space-y-2">
                {options.map((opt, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_1fr_120px_auto] items-center gap-2"
                  >
                    <Input
                      placeholder="Label"
                      value={opt.label}
                      onChange={(e) =>
                        updateOption(idx, { label: e.target.value })
                      }
                    />
                    <Input
                      placeholder="value (slug)"
                      value={opt.value}
                      onChange={(e) =>
                        updateOption(idx, { value: e.target.value })
                      }
                    />
                    <ColorPicker
                      value={opt.color || '#999999'}
                      onChange={(c) => updateOption(idx, { color: c })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setOptions((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label="Remove option"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {/* Validation */}
        {showValidation ? (
          <div className="rounded-md border border-[var(--st-border)] p-3">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
              Validation
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="validation.min">Min</Label>
                <Input
                  id="validation.min"
                  name="validation.min"
                  type="number"
                  step="any"
                  placeholder="—"
                  defaultValue={
                    typeof validation.min === 'number'
                      ? String(validation.min)
                      : ''
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="validation.max">Max</Label>
                <Input
                  id="validation.max"
                  name="validation.max"
                  type="number"
                  step="any"
                  placeholder="—"
                  defaultValue={
                    typeof validation.max === 'number'
                      ? String(validation.max)
                      : ''
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="validation.pattern">Regex pattern</Label>
                <Input
                  id="validation.pattern"
                  name="validation.pattern"
                  placeholder="^[A-Z0-9]+$"
                  className="font-mono"
                  defaultValue={
                    typeof validation.pattern === 'string'
                      ? validation.pattern
                      : ''
                  }
                />
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button variant="ghost" asChild>
            <Link href={isEditing ? `${BASE}/${initialData!._id}` : BASE}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <SubmitButton isEditing={isEditing} />
        </div>
      </form>
    </Card>
  );
}
