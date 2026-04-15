'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle, Plus, Trash2 } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { HrField } from './hr-entity-page';

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
  const { toast } = useToast();
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

  const renderedFieldNames = new Set<string>();
  const renderSection = (title: string, names: string[]) => {
    const sectionFields = names
      .map((n) => fieldByName.get(n))
      .filter(Boolean) as HrField[];
    sectionFields.forEach((f) => renderedFieldNames.add(f.name));
    if (sectionFields.length === 0) return null;
    return (
      <ClayCard key={title}>
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold text-clay-ink">{title}</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {sectionFields.map((field) => (
            <FieldCell key={field.name} field={field} initial={initial} />
          ))}
        </div>
      </ClayCard>
    );
  };

  const remainingFields = fields.filter((f) => !renderedFieldNames.has(f.name));

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={title}
        subtitle={subtitle}
        icon={Icon}
        actions={
          <Link href={backHref}>
            <ClayButton
              variant="pill"
              leading={<ArrowLeft className="h-4 w-4" strokeWidth={1.75} />}
            >
              Back
            </ClayButton>
          </Link>
        }
      />

      <form action={formAction} className="flex flex-col gap-6">
        {isEdit ? (
          <input type="hidden" name="_id" value={(initial as any)._id} />
        ) : null}

        {sections?.map((sec) => renderSection(sec.title, sec.fieldNames))}

        {remainingFields.length > 0 ? (
          <ClayCard>
            {sections ? (
              <div className="mb-4">
                <h2 className="text-[15px] font-semibold text-clay-ink">
                  Additional details
                </h2>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              {remainingFields.map((field) => (
                <FieldCell key={field.name} field={field} initial={initial} />
              ))}
            </div>
          </ClayCard>
        ) : null}

        <div className="flex justify-end gap-2">
          <Link href={backHref}>
            <ClayButton type="button" variant="pill">
              Cancel
            </ClayButton>
          </Link>
          <ClayButton
            type="submit"
            variant="obsidian"
            disabled={isPending}
            leading={
              isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : null
            }
          >
            {isEdit ? `Update ${singular}` : `Create ${singular}`}
          </ClayButton>
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
      <Label htmlFor={field.name} className="text-clay-ink">
        {field.label}
        {field.required ? <span className="text-clay-red"> *</span> : null}
      </Label>
      <div className="mt-1.5">
        {renderField(field, raw)}
      </div>
      {field.help ? (
        <p className="mt-1 text-[11.5px] text-clay-ink-muted">{field.help}</p>
      ) : null}
    </div>
  );
}

function renderField(field: HrField, raw?: unknown) {
  if (field.type === 'array') {
    return <FieldArray field={field} initialValue={raw} />;
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
    return (
      <Textarea
        {...common}
        rows={4}
        className="rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
      />
    );
  }
  if (field.type === 'select') {
    return (
      <Select name={field.name} defaultValue={String(common.defaultValue || '')}>
        <SelectTrigger
          id={field.name}
          className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
        >
          <SelectValue placeholder={field.placeholder || 'Select'} />
        </SelectTrigger>
        <SelectContent>
          {(field.options || []).map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      {...common}
      type={field.type || 'text'}
      className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
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
        <p className="rounded-clay-md border border-dashed border-clay-border bg-clay-surface-2 px-3 py-2.5 text-center text-[12px] text-clay-ink-muted">
          No rows yet — click Add below to start.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div
              key={i}
              className="flex flex-wrap items-end gap-2 rounded-clay-md border border-clay-border bg-clay-surface-2 p-2"
            >
              {subs.map((s) => {
                const fieldId = `${field.name}-${i}-${s.name}`;
                if (s.type === 'select') {
                  return (
                    <div key={s.name} className="min-w-[120px] flex-1">
                      <Label htmlFor={fieldId} className="text-[11px] text-clay-ink-muted">
                        {s.label}
                      </Label>
                      <Select
                        value={row[s.name] || ''}
                        onValueChange={(v) =>
                          setRows((prev) =>
                            prev.map((r, idx) =>
                              idx === i ? { ...r, [s.name]: v } : r,
                            ),
                          )
                        }
                      >
                        <SelectTrigger
                          id={fieldId}
                          className="h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                        >
                          <SelectValue placeholder={s.placeholder || 'Select'} />
                        </SelectTrigger>
                        <SelectContent>
                          {(s.options || []).map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                }
                return (
                  <div key={s.name} className="min-w-[120px] flex-1">
                    <Label htmlFor={fieldId} className="text-[11px] text-clay-ink-muted">
                      {s.label}
                    </Label>
                    <Input
                      id={fieldId}
                      type={s.type || 'text'}
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
                      className="h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                    />
                  </div>
                );
              })}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setRows((prev) => prev.filter((_, idx) => idx !== i))
                }
                className="text-clay-red"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setRows((prev) => [...prev, emptyRow()])}
        className="rounded-clay-md border-clay-border text-[12px]"
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {field.addLabel || 'Add row'}
      </Button>
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
