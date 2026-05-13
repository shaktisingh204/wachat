'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle, Plus, Trash2 } from 'lucide-react';

import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import type { HrField } from './hr-entity-page';
import { getRemainingFields } from '@/lib/hr-form-sections';
import { EntityFormField } from '@/components/crm/entity-form-field';

/**
 * HrFormPage — full-page form for creating or editing an HR entity.
 * Replaces the dialog-based CRUD when a record's field set is large
 * enough that a modal would feel cramped.
 *
 * Use this for both `/entity/new` (no `initial`) and `/entity/[id]/edit`
 * (pass the fetched record as `initial`).
 */
export interface HrFormPageProps {
  /** Page title shown in the header. */
  title: string;
  /** Page subtitle shown in the header. */
  subtitle?: string;
  /** Lucide icon for the header chip. */
  icon: React.ElementType;
  /** Where to return after save / cancel. */
  backHref: string;
  /** Singular noun used for the save button (e.g. "Job"). */
  singular: string;
  /** Form field config — same shape HrEntityPage accepts. */
  fields: HrField[];
  /** Server action for save. */
  saveAction: (
    prev: any,
    formData: FormData,
  ) => Promise<{ message?: string; error?: string; id?: string }>;
  /** Pre-fill values (for edit mode). */
  initial?: Record<string, unknown> | null;
  /** Optional section groups — renders fields under headings. */
  sections?: { title: string; fieldNames: string[] }[];
}

export function HrFormPage({
  title,
  subtitle,
  icon: Icon,
  backHref,
  singular,
  fields,
  saveAction,
  initial,
  sections,
}: HrFormPageProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [state, formAction, isPending] = useActionState(saveAction, {
    message: '',
    error: '',
  } as any);

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

  const isEdit = Boolean(initial && (initial as any)._id);

  const fieldByName = React.useMemo(() => {
    const m = new Map<string, HrField>();
    for (const f of fields) m.set(f.name, f);
    return m;
  }, [fields]);

  const renderSection = (title: string, names: string[]) => {
    const sectionFields = names
      .map((n) => fieldByName.get(n))
      .filter(Boolean) as HrField[];
    if (sectionFields.length === 0) return null;
    return (
      <ZoruCard key={title} className="p-6">
        <div className="mb-4">
          <h2 className="text-[15px] text-zoru-ink">{title}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {sectionFields.map((field) => (
            <FieldCell key={field.name} field={field} initial={initial} />
          ))}
        </div>
      </ZoruCard>
    );
  };

  const remainingFields = getRemainingFields(fields, sections);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={title}
        subtitle={subtitle}
        icon={Icon}
        actions={
          <ZoruButton variant="outline" asChild>
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
              Back
            </Link>
          </ZoruButton>
        }
      />

      <form action={formAction} className="flex flex-col gap-6">
        {isEdit ? (
          <input type="hidden" name="_id" value={(initial as any)._id} />
        ) : null}

        {sections?.map((sec) => renderSection(sec.title, sec.fieldNames))}

        {remainingFields.length > 0 ? (
          <ZoruCard className="p-6">
            {sections ? (
              <div className="mb-4">
                <h2 className="text-[15px] text-zoru-ink">
                  Additional details
                </h2>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              {remainingFields.map((field) => (
                <FieldCell key={field.name} field={field} initial={initial} />
              ))}
            </div>
          </ZoruCard>
        ) : null}

        <div className="flex justify-end gap-2">
          <ZoruButton type="button" variant="outline" asChild>
            <Link href={backHref}>Cancel</Link>
          </ZoruButton>
          <ZoruButton type="submit" disabled={isPending}>
            {isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : null}
            {isEdit ? `Update ${singular}` : `Create ${singular}`}
          </ZoruButton>
        </div>
      </form>
    </div>
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
      <div className="mt-1.5">
        {renderField(field, raw)}
      </div>
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
    const d = new Date(value as any);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
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
      ? (initialValue as any[])
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

function safeJsonArray(s: string): any[] {
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
