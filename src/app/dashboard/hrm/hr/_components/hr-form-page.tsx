'use client';

import {
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  useActionState,
  useEffect,
  useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus,
  Trash2 } from 'lucide-react';

/**
 * HrFormPage — sectioned full-page form for HR entities, now composed on
 * top of `<EntityFormShell>` to satisfy §1D.3 of the CRM rebuild bar.
 *
 *   <EntityFormShell>
 *     sections[]:
 *       - per configured section: rendered fields (entity, array, select,
 *         input, textarea)
 *       - remaining fields land in an "Additional details" section
 *
 * Server actions read fields by name unchanged — every existing FormData
 * key is preserved (entity → name, array → JSON-encoded hidden input).
 */

import * as React from 'react';

import {
  EntityFormShell,
  type EntityFormShellSection,
} from '@/components/crm/entity-form-shell';
import type { HrField } from './hr-entity-page';
import { getRemainingFields } from '@/lib/hr-form-sections';
import { EntityFormField } from '@/components/crm/entity-form-field';

export interface HrFormPageProps {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  backHref: string;
  singular: string;
  fields: HrField[];
  saveAction: (
    prev: unknown,
    formData: FormData,
  ) => Promise<{ message?: string; error?: string; id?: string }>;
  initial?: Record<string, unknown> | null;
  sections?: { title: string; fieldNames: string[] }[];
}

// Keep server action signature: `(prev, FormData) => ...`. EntityFormShell
// hands the raw FormData to its `action` prop which we route through
// useActionState so we still get message/error feedback.
const SAVE_INITIAL = { message: '', error: '' } as const;

export function HrFormPage({
  title,
  subtitle,
  icon: _Icon,
  backHref,
  singular,
  fields,
  saveAction,
  initial,
  sections,
}: HrFormPageProps) {
  void _Icon;
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction, _isPending] = useActionState(saveAction, SAVE_INITIAL);
  void _isPending;

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push(backHref);
      router.refresh();
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router, backHref]);

  const isEdit = Boolean(initial && (initial as { _id?: unknown })._id);

  const fieldByName = React.useMemo(() => {
    const m = new Map<string, HrField>();
    for (const f of fields) m.set(f.name, f);
    return m;
  }, [fields]);

  const remainingFields = getRemainingFields(fields, sections);

  const renderFieldCells = (list: HrField[]) => (
    <div className="grid gap-4 md:grid-cols-2">
      {list.map((field) => (
        <FieldCell key={field.name} field={field} initial={initial} />
      ))}
    </div>
  );

  const shellSections: EntityFormShellSection[] = [];
  if (sections) {
    for (const sec of sections) {
      const list = sec.fieldNames
        .map((n) => fieldByName.get(n))
        .filter(Boolean) as HrField[];
      if (list.length === 0) continue;
      shellSections.push({
        id: sec.title,
        title: sec.title,
        children: renderFieldCells(list),
      });
    }
  }
  if (remainingFields.length > 0) {
    shellSections.push({
      id: 'additional',
      title: sections ? 'Additional details' : 'Details',
      children: renderFieldCells(remainingFields),
    });
  }

  const editId = (initial as { _id?: unknown } | null)?._id;

  return (
    <EntityFormShell
      title={title}
      subtitle={subtitle}
      action={formAction}
      sections={shellSections}
      submitLabel={isEdit ? `Update ${singular}` : `Create ${singular}`}
      cancelHref={backHref}
      error={state?.error || undefined}
      message={state?.message || undefined}
      hiddenInputs={
        isEdit ? (
          <>
            <input type="hidden" name="_id" value={String(editId)} />
            <input type="hidden" name="id" value={String(editId)} />
          </>
        ) : null
      }
    />
  );
}

function FieldCell({
  field,
  initial,
}: {
  field: HrField;
  initial?: Record<string, unknown> | null;
}) {
  const raw = initial ? initial[field.name] : undefined;
  return (
    <div className={field.fullWidth ? 'md:col-span-2' : ''}>
      <ZoruLabel htmlFor={field.name}>
        {field.label}
        {field.required ? <span className="text-zoru-danger-ink"> *</span> : null}
      </ZoruLabel>
      <div className="mt-1.5">{renderField(field, raw)}</div>
      {field.help ? (
        <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{field.help}</p>
      ) : null}
    </div>
  );
}

function renderField(field: HrField, raw?: unknown) {
  if (field.type === 'array') {
    return <FieldArray field={field} initialValue={raw} />;
  }

  if (field.type === 'entity' && field.entity) {
    const initialId =
      typeof raw === 'string' && raw
        ? raw
        : raw !== undefined && raw !== null
          ? String(raw)
          : field.defaultValue || undefined;
    return (
      <EntityFormField
        entity={field.entity}
        name={field.name}
        dualWriteName={field.dualWriteName}
        initialId={initialId}
        filter={field.entityFilter}
        required={field.required}
        placeholder={field.placeholder}
      />
    );
  }

  const stringValue = formatForInput(raw, field.type);
  const common = {
    id: field.name,
    name: field.name,
    required: field.required,
    defaultValue: stringValue || field.defaultValue || '',
    placeholder: field.placeholder,
  };

  if (field.type === 'textarea') {
    return <ZoruTextarea {...common} rows={4} />;
  }
  if (field.type === 'select') {
    return (
      <ZoruSelect name={field.name} defaultValue={String(common.defaultValue || '')}>
        <ZoruSelectTrigger id={field.name}>
          <ZoruSelectValue placeholder={field.placeholder || 'Select'} />
        </ZoruSelectTrigger>
        <ZoruSelectContent>
          {(field.options || []).map((opt) => (
            <ZoruSelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </ZoruSelectItem>
          ))}
        </ZoruSelectContent>
      </ZoruSelect>
    );
  }
  return (
    <ZoruInput
      {...common}
      type={field.type || 'text'}
      min={field.type === 'number' ? 0 : undefined}
    />
  );
}

function formatForInput(value: unknown, type?: string): string {
  if (value === null || value === undefined) return '';
  if (type === 'date' && value) {
    const d = new Date(value as string | number | Date);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function FieldArray({
  field,
  initialValue,
}: {
  field: HrField;
  initialValue?: unknown;
}) {
  const subs = field.subFields || [];
  const parseInitial = (): Record<string, string>[] => {
    if (!initialValue) return [];
    const arr = Array.isArray(initialValue)
      ? (initialValue as Record<string, unknown>[])
      : typeof initialValue === 'string'
        ? safeJsonArray(initialValue)
        : [];
    return arr.map((row) => {
      const out: Record<string, string> = {};
      for (const s of subs) {
        const v = row?.[s.name];
        out[s.name] = v === undefined || v === null ? '' : String(v);
      }
      return out;
    });
  };
  const [rows, setRows] = useState<Record<string, string>[]>(parseInitial);

  const emptyRow = () => {
    const r: Record<string, string> = {};
    for (const s of subs) r[s.name] = '';
    return r;
  };

  const hiddenValue = JSON.stringify(
    rows.map((r) => {
      const out: Record<string, string | number> = {};
      for (const s of subs) {
        const raw = r[s.name] ?? '';
        out[s.name] = s.type === 'number' && raw !== '' ? Number(raw) : raw;
      }
      return out;
    }),
  );

  return (
    <div className="space-y-2">
      <input type="hidden" name={field.name} value={hiddenValue} />

      {rows.length === 0 ? (
        <p className="rounded-[var(--zoru-radius)] border border-dashed border-zoru-line bg-zoru-surface-2 px-3 py-2.5 text-center text-[12px] text-zoru-ink-muted">
          No rows yet — click Add below to start.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div
              key={i}
              className="flex flex-wrap items-end gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface-2 p-2"
            >
              {subs.map((s) => {
                const fieldId = `${field.name}-${i}-${s.name}`;
                if (s.type === 'select') {
                  return (
                    <div key={s.name} className="min-w-[120px] flex-1">
                      <ZoruLabel htmlFor={fieldId}>{s.label}</ZoruLabel>
                      <ZoruSelect
                        value={row[s.name] || ''}
                        onValueChange={(v) =>
                          setRows((prev) =>
                            prev.map((r, idx) =>
                              idx === i ? { ...r, [s.name]: v } : r,
                            ),
                          )
                        }
                      >
                        <ZoruSelectTrigger id={fieldId}>
                          <ZoruSelectValue placeholder={s.placeholder || 'Select'} />
                        </ZoruSelectTrigger>
                        <ZoruSelectContent>
                          {(s.options || []).map((opt) => (
                            <ZoruSelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </ZoruSelectItem>
                          ))}
                        </ZoruSelectContent>
                      </ZoruSelect>
                    </div>
                  );
                }
                return (
                  <div key={s.name} className="min-w-[120px] flex-1">
                    <ZoruLabel htmlFor={fieldId}>{s.label}</ZoruLabel>
                    <ZoruInput
                      id={fieldId}
                      type={s.type || 'text'}
                      min={s.type === 'number' ? 0 : undefined}
                      value={row[s.name] || ''}
                      placeholder={s.placeholder}
                      required={s.required}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r, idx) =>
                            idx === i ? { ...r, [s.name]: e.target.value } : r,
                          ),
                        )
                      }
                    />
                  </div>
                );
              })}
              <ZoruButton
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Remove row"
                className="text-zoru-danger-ink"
                onClick={() =>
                  setRows((prev) => prev.filter((_, idx) => idx !== i))
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </ZoruButton>
            </div>
          ))}
        </div>
      )}

      <ZoruButton
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setRows((prev) => [...prev, emptyRow()])}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {field.addLabel || 'Add row'}
      </ZoruButton>
    </div>
  );
}

function safeJsonArray(s: string): Record<string, unknown>[] {
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
