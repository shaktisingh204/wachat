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
  } from 'lucide-react';
import { useActionState,
  useEffect,
  useState,
  useTransition } from 'react';
import { EntityFormField } from '@/components/crm/entity-form-field';
import type { EntityKey } from '@/lib/lookup-registry';

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';

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

  /* ─── Entity picker (type: 'entity') ─────────────────────────── */
  /** Entity key to look up. Required when `type === 'entity'`. */
  entity?: EntityKey;
  /**
   * Optional second form field that should receive the picker's
   * primary label — used for "dual-write" migrations where the
   * underlying schema still has a free-text `*Name` field alongside
   * the new `*Id` reference.
   */
  dualWriteName?: string;
  /** Static filter applied to the lookup query. */
  filter?: Record<string, unknown>;
  /**
   * Build the lookup filter dynamically from sibling-field values.
   * Receives `{ fieldName: currentEntityValue }` for every other
   * `type: 'entity'` field in the form. Return `undefined` to omit
   * the filter.
   */
  cascadeFilterFrom?: (
    siblings: Record<string, string>,
  ) => Record<string, unknown> | undefined;
  /** Show a "Create new" item. Auto-on for reference entities. */
  allowCreate?: boolean;
  /** Multi-select. */
  multi?: boolean;
}

export interface HrColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => unknown;
  className?: string;
}

/**
 * ClayBadge — legacy compat shim. Maps the old `tone` API onto
 * ZoruBadge variants so existing CRM pages keep rendering during the
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
    try {
      return String(value);
    } catch {
      return '—';
    }
  }
  return String(value);
}

export interface HrEntityPageProps<T extends { _id: string }> {
  title: string;
  subtitle: string;
  icon?: React.ElementType;
  singular: string;
  columns: HrColumn<T>[];
  fields: HrField[];
  getAllAction: () => Promise<T[]>;
  saveAction: (
    prev: any,
    formData: FormData,
  ) => Promise<{ message?: string; error?: string; id?: string }>;
  deleteAction: (id: string) => Promise<{ success: boolean; error?: string }>;
  emptyText?: string;
  basePath?: string;
  /**
   * When true together with `basePath`, the first column's cell is
   * wrapped in `<EntityRowLink>` pointing at `${basePath}/{row._id}`.
   * The inline dialog "Edit" action is retained as a secondary action
   * (it is NOT swapped to a Link). Use when `[id]/page.tsx` detail
   * routes exist and should be the primary navigation target while
   * inline edit remains available.
   */
  rowLinksToDetail?: boolean;
  /**
   * When `basePath` is unset (dialog-based editing), wrap the first
   * column's cell in a clickable affordance that opens the edit dialog
   * for that row. Has no effect when `basePath` is set — use
   * `rowLinksToDetail` for that flow.
   */
  rowOpensEditDialog?: boolean;
}

function renderField(
  field: HrField,
  value?: unknown,
  entityValues?: Record<string, string>,
  onEntityChange?: (name: string, id: string | null) => void,
) {
  const stringValue = typeof value === 'string' ? value : '';

  if (field.type === 'array') {
    return <FieldArray field={field} initialValue={value} />;
  }

  if (field.type === 'entity' && field.entity) {
    return (
      <EntityField
        field={field}
        initialId={stringValue || field.defaultValue || ''}
        siblings={entityValues ?? {}}
        onChange={(id) => onEntityChange?.(field.name, id)}
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
 * Wraps <EntityFormField> with HrField wiring (cascading filter
 * resolution + form-state callback). The picker plus its hidden inputs
 * live in `EntityFormField` — this just resolves the filter from
 * sibling values and forwards.
 */
function EntityField({
  field,
  initialId,
  siblings,
  onChange,
}: {
  field: HrField;
  initialId: string;
  siblings: Record<string, string>;
  onChange: (id: string | null) => void;
}) {
  const computedFilter = React.useMemo(() => {
    if (field.cascadeFilterFrom) {
      const f = field.cascadeFilterFrom(siblings);
      return { ...(field.filter ?? {}), ...(f ?? {}) };
    }
    return field.filter;
  }, [field, siblings]);

  return (
    <EntityFormField
      entity={field.entity!}
      name={field.name}
      dualWriteName={field.dualWriteName}
      initialId={initialId || null}
      filter={computedFilter}
      allowCreate={field.allowCreate}
      required={field.required}
      placeholder={field.placeholder}
      onChange={onChange}
    />
  );
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

export function HrEntityPage<T extends { _id: string; [k: string]: any }>({
  title,
  subtitle,
  singular,
  columns,
  fields,
  getAllAction,
  saveAction,
  deleteAction,
  emptyText,
  basePath,
  rowLinksToDetail,
  rowOpensEditDialog,
}: HrEntityPageProps<T>) {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<T[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [entityValues, setEntityValues] = useState<Record<string, string>>({});
  const [saveState, saveFormAction, isSaving] = useActionState(saveAction, {
    message: '',
    error: '',
  } as any);

  // Initialize entity-picker state when opening the dialog or switching
  // between rows — so cascading filters see the loaded values right away.
  useEffect(() => {
    if (!dialogOpen) {
      setEntityValues({});
      return;
    }
    const init: Record<string, string> = {};
    for (const f of fields) {
      if (f.type === 'entity') {
        const raw = editing?.[f.name];
        if (raw !== undefined && raw !== null) init[f.name] = String(raw);
      }
    }
    setEntityValues(init);
  }, [dialogOpen, editing, fields]);

  const onEntityChange = React.useCallback(
    (name: string, id: string | null) => {
      setEntityValues((prev) => {
        const next = { ...prev };
        if (id == null || id === '') delete next[name];
        else next[name] = id;

        // Cascade: any dependent entity field whose `cascadeFilterFrom`
        // produced a different filter under `next` than under `prev` is
        // cleared, so the picker stops showing a now-out-of-scope value
        // (e.g. clearing `country` clears `state` and `city`).
        for (const f of fields) {
          if (f.type !== 'entity' || !f.cascadeFilterFrom) continue;
          if (f.name === name) continue;
          if (!Object.prototype.hasOwnProperty.call(next, f.name)) continue;
          const before = JSON.stringify(f.cascadeFilterFrom(prev) ?? {});
          const after = JSON.stringify(f.cascadeFilterFrom(next) ?? {});
          if (before !== after) {
            delete next[f.name];
          }
        }
        return next;
      });
    },
    [fields],
  );

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
        basePath && !rowLinksToDetail ? (
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
                <ZoruTableHead className="w-[120px] text-right">Actions</ZoruTableHead>
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
                    {columns.map((c, colIdx) => {
                      const content = c.render ? toNode(c.render(row)) : toNode(row[c.key]);
                      const wrapWithLink =
                        colIdx === 0 && rowLinksToDetail && basePath;
                      const wrapWithDialogTrigger =
                        colIdx === 0 && rowOpensEditDialog && !basePath;
                      return (
                        <ZoruTableCell key={c.key} className="text-[13px] text-zoru-ink">
                          {wrapWithLink ? (
                            <EntityRowLink
                              href={`${basePath}/${row._id}`}
                              label={content}
                            />
                          ) : wrapWithDialogTrigger ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditing(row);
                                setDialogOpen(true);
                              }}
                              className="group inline-flex flex-col items-start gap-0.5 rounded-sm text-left outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                            >
                              <span className="font-medium text-foreground transition-colors group-hover:text-primary group-hover:underline group-focus-visible:underline">
                                {content}
                              </span>
                            </button>
                          ) : (
                            content
                          )}
                        </ZoruTableCell>
                      );
                    })}
                    <ZoruTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {basePath && !rowLinksToDetail ? (
                          <ZoruButton variant="ghost" size="sm" asChild>
                            <Link href={`${basePath}/${row._id}/edit`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Link>
                          </ZoruButton>
                        ) : (
                          <ZoruButton
                            variant="ghost"
                            size="sm"
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
                        ? field.type === 'array'
                          ? (editing[field.name] as unknown)
                          : formatFieldValue(editing[field.name], field.type)
                        : undefined,
                      entityValues,
                      onEntityChange,
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

function formatFieldValue(value: unknown, type?: HrFieldType): string {
  if (value === null || value === undefined) return '';
  if (type === 'date' && value) {
    const d = new Date(value as any);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
