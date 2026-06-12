'use client';

/**
 * doc-surface — DocForm.
 *
 * The full create/edit form, rendered in a right-side Drawer:
 *
 *   - party section (async EntityPicker — a REAL record is required;
 *     this form cannot save placeholder ids);
 *   - issue / due dates (20ui DatePicker);
 *   - numbering (auto-suggested from the entity's latest documents,
 *     always overridable);
 *   - LineItemsEditor (shared math with the server action);
 *   - notes / terms textareas;
 *   - SabFiles attachments (`SabFilePickerButton` — library or upload,
 *     never a URL paste);
 *   - Save draft / Save + issue.
 */

import * as React from 'react';
import { Paperclip, X } from 'lucide-react';

import {
  Alert,
  Button,
  DatePicker,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  Field,
  Input,
  SelectField,
  Tag,
  Textarea,
  type SelectOption,
} from '@/components/sabcrm/20ui';
import { SabFilePickerButton } from '@/components/sabfiles';
import { isBlankDocLine } from '@/lib/sabcrm/finance-doc-math';

import { EntityPicker } from './entity-picker';
import { LineItemsEditor, blankDocLine } from './line-items-editor';
import type { DocFormConfig, DocFormValues } from './types';

import './doc-surface.css';

/* ─── Defaults ────────────────────────────────────────────────── */

const DEFAULT_CURRENCIES: SelectOption[] = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

function todayKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Fresh form values (due date defaults to +30 days). */
export function emptyDocFormValues(): DocFormValues {
  return {
    number: '',
    partyId: null,
    partyLabel: null,
    currency: 'INR',
    date: todayKey(),
    dueDate: todayKey(30),
    lines: [blankDocLine()],
    paymentTerms: '',
    customerNotes: '',
    termsAndConditions: '',
    attachments: [],
  };
}

/** `YYYY-MM-DD` ⇄ local `Date` for the DatePicker. */
function keyToDate(key: string): Date | undefined {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function dateToKey(d: Date | undefined): string {
  if (!d) return '';
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/* ─── Component ───────────────────────────────────────────────── */

export interface DocFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: DocFormConfig;
  mode: 'create' | 'edit';
  /** Seed values (edit mode, or a convert-from-parent prefill). */
  initialValues?: DocFormValues;
  /**
   * Persists the form. `issue` is true for the "save + issue" button.
   * Resolve `{ ok: false, error }` to keep the form open with an error.
   */
  onSubmit: (
    values: DocFormValues,
    opts: { issue: boolean },
  ) => Promise<{ ok: boolean; error?: string }>;
}

export function DocForm({
  open,
  onOpenChange,
  config,
  mode,
  initialValues,
  onSubmit,
}: DocFormProps): React.JSX.Element {
  const [values, setValues] = React.useState<DocFormValues>(
    initialValues ?? emptyDocFormValues(),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<false | 'draft' | 'issue'>(false);
  const seededNumber = React.useRef(false);

  const patch = (p: Partial<DocFormValues>): void =>
    setValues((v) => ({ ...v, ...p }));

  // Reset + (re)seed when the drawer opens.
  React.useEffect(() => {
    if (!open) return;
    setValues(initialValues ?? emptyDocFormValues());
    setError(null);
    seededNumber.current = false;
  }, [open, initialValues]);

  // Auto-numbering: suggest once per open, only when the field is empty.
  React.useEffect(() => {
    if (!open || mode !== 'create' || seededNumber.current) return;
    if (!config.suggestNumber) return;
    if ((initialValues?.number ?? '').trim()) return;
    seededNumber.current = true;
    let cancelled = false;
    void config.suggestNumber().then((suggestion) => {
      if (cancelled || !suggestion) return;
      setValues((v) => (v.number.trim() ? v : { ...v, number: suggestion }));
    });
    return () => {
      cancelled = true;
    };
  }, [open, mode, config, initialValues]);

  const validate = (): string | null => {
    if (!values.number.trim()) {
      return `${config.numberLabel} is required.`;
    }
    if (!values.partyId) {
      return `Pick a ${config.partyLabel.toLowerCase()}.`;
    }
    if (!values.date) return `${config.dateLabel} is required.`;
    if (!values.dueDate) return `${config.dueDateLabel} is required.`;
    if (values.dueDate < values.date) {
      return `${config.dueDateLabel} can't be before the ${config.dateLabel.toLowerCase()}.`;
    }
    if (values.lines.every(isBlankDocLine)) {
      return 'Add at least one line item.';
    }
    return null;
  };

  const submit = async (issue: boolean): Promise<void> => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setPending(issue ? 'issue' : 'draft');
    try {
      const res = await onSubmit(values, { issue });
      if (!res.ok) {
        setError(res.error ?? 'Something went wrong.');
        return;
      }
      onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  const currencies = config.currencies
    ? config.currencies.map((c) => ({ value: c.value, label: c.label }))
    : DEFAULT_CURRENCIES;

  const entityLower = config.entitySingular.toLowerCase();
  const busy = pending !== false;

  return (
    <Drawer open={open} onOpenChange={(next) => !busy && onOpenChange(next)} side="right">
      <DrawerContent aria-describedby="fdoc-form-desc" className="fdoc-form-drawer">
        <DrawerHeader>
          <DrawerTitle>
            {mode === 'create'
              ? `New ${entityLower}`
              : `Edit ${entityLower}`}
          </DrawerTitle>
          <DrawerDescription id="fdoc-form-desc">
            {mode === 'create'
              ? `Pick the ${config.partyLabel.toLowerCase()}, add line items and save as a draft or issue it right away.`
              : `Update the ${entityLower}'s details. Money fields are recomputed from the line items.`}
          </DrawerDescription>
        </DrawerHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(false);
          }}
        >
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <div className="fdoc-form-grid">
              <Field label={config.partyLabel} required>
                <EntityPicker
                  value={values.partyId}
                  valueLabel={values.partyLabel}
                  search={config.searchParties}
                  placeholder={config.partyPlaceholder}
                  disabled={busy}
                  invalid={!!error && !values.partyId}
                  onChange={(opt) =>
                    patch({
                      partyId: opt?.id ?? null,
                      partyLabel: opt?.label ?? null,
                    })
                  }
                />
              </Field>

              <Field label={config.numberLabel} required>
                <Input
                  value={values.number}
                  onChange={(e) => patch({ number: e.target.value })}
                  placeholder="INV-2026-0001"
                  disabled={busy}
                />
              </Field>

              <Field label={config.dateLabel} required>
                <DatePicker
                  value={keyToDate(values.date)}
                  onChange={(d) => patch({ date: dateToKey(d) })}
                  placeholder="Pick a date"
                  disabled={busy}
                  aria-label={config.dateLabel}
                />
              </Field>

              <Field label={config.dueDateLabel} required>
                <DatePicker
                  value={keyToDate(values.dueDate)}
                  onChange={(d) => patch({ dueDate: dateToKey(d) })}
                  placeholder="Pick a date"
                  disabled={busy}
                  aria-label={config.dueDateLabel}
                />
              </Field>

              <Field label="Currency" required>
                <SelectField
                  value={values.currency}
                  onChange={(v) => patch({ currency: v ?? 'INR' })}
                  options={currencies}
                  disabled={busy}
                />
              </Field>

              <Field label="Payment terms" help="Printed on the document.">
                <Input
                  value={values.paymentTerms}
                  onChange={(e) => patch({ paymentTerms: e.target.value })}
                  placeholder="Net 30"
                  disabled={busy}
                />
              </Field>

              <div className="fdoc-form-grid__full">
                <Field label="Line items" required>
                  <LineItemsEditor
                    lines={values.lines}
                    onChange={(lines) => patch({ lines })}
                    currency={values.currency}
                    searchItems={config.searchItems}
                    disabled={busy}
                  />
                </Field>
              </div>

              <Field label="Customer notes">
                <Textarea
                  value={values.customerNotes}
                  onChange={(e) => patch({ customerNotes: e.target.value })}
                  rows={3}
                  placeholder="Thanks for your business."
                  disabled={busy}
                />
              </Field>

              <Field label="Terms & conditions">
                <Textarea
                  value={values.termsAndConditions}
                  onChange={(e) =>
                    patch({ termsAndConditions: e.target.value })
                  }
                  rows={3}
                  placeholder="Late fee 1.5% / month."
                  disabled={busy}
                />
              </Field>

              <div className="fdoc-form-grid__full">
                <Field
                  label="Attachments"
                  help="Files live in SabFiles — pick from the library or upload."
                >
                  <div className="fdoc-attachments">
                    {values.attachments.map((att) => (
                      <Tag
                        key={att.fileId}
                        onRemove={
                          busy
                            ? undefined
                            : () =>
                                patch({
                                  attachments: values.attachments.filter(
                                    (a) => a.fileId !== att.fileId,
                                  ),
                                })
                        }
                      >
                        {att.name ?? 'Attachment'}
                      </Tag>
                    ))}
                    <SabFilePickerButton
                      onPick={(pick) => {
                        if (
                          values.attachments.some((a) => a.fileId === pick.id)
                        ) {
                          return;
                        }
                        patch({
                          attachments: [
                            ...values.attachments,
                            {
                              fileId: pick.id,
                              name: pick.name,
                              mimeType: pick.mime,
                              size: pick.size,
                            },
                          ],
                        });
                      }}
                    >
                      <Paperclip size={14} aria-hidden="true" /> Attach file
                    </SabFilePickerButton>
                  </div>
                </Field>
              </div>
            </div>

            {error ? (
              <div className="mt-3">
                <Alert tone="danger" role="alert">
                  {error}
                </Alert>
              </div>
            ) : null}
          </div>

          <DrawerFooter>
            <Button
              type="button"
              variant="ghost"
              iconLeft={X}
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              loading={pending === 'draft'}
              disabled={pending === 'issue'}
            >
              {mode === 'create' ? 'Save draft' : 'Save changes'}
            </Button>
            {mode === 'create' && config.issueLabel ? (
              <Button
                type="button"
                variant="primary"
                loading={pending === 'issue'}
                disabled={pending === 'draft'}
                onClick={() => void submit(true)}
              >
                {config.issueLabel}
              </Button>
            ) : null}
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
