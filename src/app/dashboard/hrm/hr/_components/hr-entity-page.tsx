'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  cn,
  useZoruToast,
  zoruBadgeVariants,
} from '@/components/zoruui';
import {
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  ExternalLink,
  } from 'lucide-react';
import { useActionState,
  useEffect,
  useState,
  useTransition } from 'react';

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import type { EntityKey } from '@/lib/lookup-registry';

export type HrFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'number'
  | 'date'
  | 'email'
  | 'url'
  | 'tel'
  | 'array'
  | 'entity';

export interface HrArraySubField {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'select' | 'date';
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
}

export interface HrField {
  name: string;
  label: string;
  type?: HrFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
  fullWidth?: boolean;
  defaultValue?: string;
  /** For `type: 'array'` — the shape of each row. */
  subFields?: HrArraySubField[];
  /** Label shown on the "+ Add row" button. */
  addLabel?: string;
  /** Help/hint text rendered under the field. */
  help?: string;
  /** For `type: 'entity'` — the lookup entity key. */
  entity?: EntityKey;
  /** For `type: 'entity'` — optional sibling name to mirror the picker label. */
  dualWriteName?: string;
  /** For `type: 'entity'` — static filter passed to the lookup query. */
  entityFilter?: Record<string, unknown>;
}

export interface HrColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => unknown;
  className?: string;
}

/**
 * ClayBadge — legacy compat shim. Maps the old `tone` API onto
 * ZoruBadge variants so existing HR pages keep rendering during the
 * migration. Prefer `ZoruBadge` directly in new code.
 */
type LegacyTone =
  | 'neutral'
  | 'rose'
  | 'rose-soft'
  | 'obsidian'
  | 'green'
  | 'amber'
  | 'red'
  | 'blue';

interface ClayBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  tone?: LegacyTone;
  dot?: boolean;
  children?: React.ReactNode;
}

const TONE_TO_VARIANT: Record<
  LegacyTone,
  'default' | 'ghost' | 'success' | 'warning' | 'danger'
> = {
  neutral: 'ghost',
  rose: 'default',
  'rose-soft': 'ghost',
  obsidian: 'default',
  green: 'success',
  amber: 'warning',
  red: 'danger',
  blue: 'ghost',
};

const DOT_CLASS: Record<LegacyTone, string> = {
  neutral: 'bg-zoru-ink-muted',
  rose: 'bg-zoru-ink',
  'rose-soft': 'bg-zoru-ink',
  obsidian: 'bg-zoru-ink',
  green: 'bg-zoru-success',
  amber: 'bg-zoru-warning',
  red: 'bg-zoru-danger',
  blue: 'bg-zoru-ink-muted',
};

export const ClayBadge = React.forwardRef<HTMLSpanElement, ClayBadgeProps>(
  ({ className, tone = 'neutral', dot = false, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        zoruBadgeVariants({ variant: TONE_TO_VARIANT[tone] }),
        'gap-1.5',
        className,
      )}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 rounded-full', DOT_CLASS[tone])}
        />
      ) : null}
      {children}
    </span>
  ),
);
ClayBadge.displayName = 'ClayBadge';

function toNode(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (React.isValidElement(value)) return value;
  if (value instanceof Date) return value.toLocaleDateString();
  if (Array.isArray(value)) return String(value.length);
  if (typeof value === 'object') {
    // ObjectId or other — stringify
    try {
      return String(value);
    } catch {
      return '—';
    }
  }
  return String(value);
}

export interface HrKpi<T> {
  /** KPI label (short, e.g. "Submitted this week"). */
  label: string;
  /**
   * Compute the KPI value from the loaded rows.
   * Return a number, string, or React node.
   */
  compute: (rows: T[]) => React.ReactNode;
  /** Optional small caption shown under the value. */
  hint?: string | ((rows: T[]) => string);
  /** Optional accent tone for the value text. */
  tone?: 'neutral' | 'green' | 'amber' | 'red' | 'blue';
}

export interface HrEntityPageProps<T extends { _id: string }> {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  singular: string;
  columns: HrColumn<T>[];
  fields: HrField[];
  getAllAction: () => Promise<T[]>;
  saveAction: (
    prev: any,
    formData: FormData,
  ) => Promise<{ message?: string; error?: string; id?: string }>;
  deleteAction: (id: string) => Promise<{ success: boolean; error?: string }>;
  /** Optional empty-state CTA text. */
  emptyText?: string;
  /**
   * When set, the list page routes Add and Edit to dedicated pages
   * instead of opening a dialog. Pass the base route (e.g.
   * "/dashboard/hrm/hr/jobs") — the list will link to `${basePath}/new`
   * and `${basePath}/${row._id}/edit`.
   */
  basePath?: string;
  /**
   * Optional KPI strip rendered above the table. Each KPI receives the
   * full row list and returns a displayable value (number / string /
   * React node). Per §1D.1 of the CRM rebuild contract, every list page
   * SHOULD ship 3–5 summary cards. Cards are NOT clickable filters in
   * this minimal implementation — that's a TODO once the list shell
   * grows filter state.
   */
  kpis?: HrKpi<T>[];
  /**
   * When set, the row's primary cell links to `${basePath}/${row._id}`
   * (the detail page) rather than opening the edit dialog. Defaults to
   * `false` so existing pages keep their click-to-edit affordance.
   */
  rowLinksToDetail?: boolean;
}

function renderField(field: HrField, value?: unknown) {
  const stringValue = typeof value === 'string' ? value : '';

  if (field.type === 'array') {
    return <FieldArray field={field} initialValue={value} />;
  }

  if (field.type === 'entity' && field.entity) {
    const initialId =
      typeof value === 'string' && value
        ? value
        : value !== undefined && value !== null
          ? String(value)
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

  const common = {
    id: field.name,
    name: field.name,
    required: field.required,
    defaultValue: stringValue || field.defaultValue || '',
    placeholder: field.placeholder,
  };

  if (field.type === 'textarea') {
    return <ZoruTextarea {...common} rows={3} />;
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

/**
 * FieldArray — dynamic repeater for array-of-object fields (e.g. OKR
 * key results, onboarding tasks, survey questions). Stores the array
 * as JSON in a hidden input so the existing `jsonKeys` server-side
 * parsing keeps working unchanged. The UI exposes a proper row-per-
 * item editor with Add / Remove controls.
 */
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
    if (Array.isArray(initialValue)) {
      return (initialValue as any[]).map((row) => {
        const out: Record<string, string> = {};
        for (const s of subs) {
          const v = row?.[s.name];
          out[s.name] = v === undefined || v === null ? '' : String(v);
        }
        return out;
      });
    }
    if (typeof initialValue === 'string') {
      try {
        const parsed = JSON.parse(initialValue);
        if (Array.isArray(parsed)) {
          return parsed.map((row: any) => {
            const out: Record<string, string> = {};
            for (const s of subs) {
              const v = row?.[s.name];
              out[s.name] = v === undefined || v === null ? '' : String(v);
            }
            return out;
          });
        }
      } catch {
        /* ignore */
      }
    }
    return [];
  };
  const [rows, setRows] = useState<Record<string, string>[]>(parseInitial);

  const makeEmptyRow = (): Record<string, string> => {
    const r: Record<string, string> = {};
    for (const s of subs) r[s.name] = '';
    return r;
  };

  const addRow = () => setRows((prev) => [...prev, makeEmptyRow()]);
  const removeRow = (i: number) =>
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  const updateRow = (i: number, name: string, value: string) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [name]: value } : r)));

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
                        onValueChange={(v) => updateRow(i, s.name, v)}
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
                      onChange={(e) => updateRow(i, s.name, e.target.value)}
                    />
                  </div>
                );
              })}
              <ZoruButton
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRow(i)}
                className="text-zoru-danger-ink"
                aria-label="Remove row"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </ZoruButton>
            </div>
          ))}
        </div>
      )}

      <ZoruButton type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {field.addLabel || 'Add row'}
      </ZoruButton>

      {field.help ? (
        <p className="text-[11.5px] text-zoru-ink-muted">{field.help}</p>
      ) : null}
    </div>
  );
}

const KPI_TONE_CLASS: Record<NonNullable<HrKpi<any>['tone']>, string> = {
  neutral: 'text-zoru-ink',
  green: 'text-zoru-success-ink',
  amber: 'text-zoru-warning-ink',
  red: 'text-zoru-danger-ink',
  blue: 'text-zoru-ink',
};

function HrKpiStrip<T>({ rows, kpis }: { rows: T[]; kpis: HrKpi<T>[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {kpis.map((k, i) => {
        const value = k.compute(rows);
        const hint = typeof k.hint === 'function' ? k.hint(rows) : k.hint;
        const toneClass = KPI_TONE_CLASS[k.tone || 'neutral'];
        return (
          <ZoruCard key={i} className="p-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
              {k.label}
            </div>
            <div className={cn('mt-1 text-[20px] font-semibold leading-tight', toneClass)}>
              {value === null || value === undefined || value === '' ? '—' : value}
            </div>
            {hint ? (
              <div className="mt-0.5 text-[11px] text-zoru-ink-muted">{hint}</div>
            ) : null}
          </ZoruCard>
        );
      })}
    </div>
  );
}

export function HrEntityPage<T extends { _id: string; [k: string]: any }>({
  title,
  subtitle,
  icon,
  singular,
  columns,
  fields,
  getAllAction,
  saveAction,
  deleteAction,
  emptyText,
  basePath,
  kpis,
  rowLinksToDetail,
}: HrEntityPageProps<T>) {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<T[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saveState, saveFormAction, isSaving] = useActionState(saveAction, {
    message: '',
    error: '',
  } as any);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const list = await getAllAction();
        setRows(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error('Failed to load entities:', e);
      }
    });
  }, [getAllAction]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      setDialogOpen(false);
      setEditing(null);
      refresh();
    }
    if (saveState?.error) {
      toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
    }
  }, [saveState, toast, refresh]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteAction(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: `${singular} removed.` });
      setDeletingId(null);
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  return (
    <EntityListShell
      title={title}
      subtitle={subtitle}
      primaryAction={
        basePath ? (
          <ZoruButton asChild>
            <Link href={`${basePath}/new`}>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Add {singular}
            </Link>
          </ZoruButton>
        ) : (
          <ZoruButton
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Add {singular}
          </ZoruButton>
        )
      }
    >

      {kpis && kpis.length > 0 ? (
        <HrKpiStrip rows={rows} kpis={kpis} />
      ) : null}

      <ZoruCard className="p-6">
        <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow>
                {columns.map((c) => (
                  <ZoruTableHead key={c.key} className={c.className}>
                    {c.label}
                  </ZoruTableHead>
                ))}
                <ZoruTableHead className="w-[140px] text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading && rows.length === 0 ? (
                [...Array(3)].map((_, i) => (
                  <ZoruTableRow key={i}>
                    <ZoruTableCell colSpan={columns.length + 1}>
                      <ZoruSkeleton className="h-8 w-full" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              ) : rows.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={columns.length + 1}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    {emptyText || `No ${singular.toLowerCase()} yet — click Add to get started.`}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                rows.map((row) => (
                  <ZoruTableRow key={row._id}>
                    {columns.map((c) => (
                      <ZoruTableCell key={c.key} className="text-[13px] text-zoru-ink">
                        {c.render ? toNode(c.render(row)) : toNode(row[c.key])}
                      </ZoruTableCell>
                    ))}
                    <ZoruTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {basePath && rowLinksToDetail ? (
                          <ZoruButton variant="ghost" size="sm" asChild>
                            <Link href={`${basePath}/${row._id}`} aria-label="View">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </ZoruButton>
                        ) : null}
                        {basePath ? (
                          <ZoruButton variant="ghost" size="sm" asChild>
                            <Link href={`${basePath}/${row._id}/edit`} aria-label="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </ZoruButton>
                        ) : (
                          <ZoruButton
                            variant="ghost"
                            size="sm"
                            aria-label="Edit"
                            onClick={() => {
                              setEditing(row);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </ZoruButton>
                        )}
                        <ZoruButton
                          variant="ghost"
                          size="sm"
                          aria-label="Delete"
                          onClick={() => setDeletingId(row._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                        </ZoruButton>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>

      <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent className="max-w-2xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? `Edit ${singular}` : `Add ${singular}`}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              {editing ? 'Update the details and save.' : `Fill in the details below.`}
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <form action={saveFormAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              {fields.map((field) => (
                <div
                  key={field.name}
                  className={field.fullWidth ? 'md:col-span-2' : ''}
                >
                  <ZoruLabel htmlFor={field.name}>
                    {field.label}
                    {field.required ? <span className="text-zoru-danger-ink"> *</span> : null}
                  </ZoruLabel>
                  <div className="mt-1.5">
                    {renderField(
                      field,
                      editing
                        ? field.type === 'array' || field.type === 'entity'
                          ? (editing[field.name] as unknown)
                          : formatFieldValue(editing[field.name], field.type)
                        : undefined,
                    )}
                  </div>
                </div>
              ))}
            </div>

            <ZoruDialogFooter className="gap-2">
              <ZoruButton
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </ZoruButton>
              <ZoruButton type="submit" disabled={isSaving}>
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                ) : null}
                Save
              </ZoruButton>
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </ZoruDialog>

      <ZoruAlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete {singular}?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete}>Delete</ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </EntityListShell>
  );
}

/** Format a field value for display inside an Input default value. */
function formatFieldValue(value: unknown, type?: HrFieldType): string {
  if (value === null || value === undefined) return '';
  if (type === 'date' && value) {
    const d = new Date(value as any);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
