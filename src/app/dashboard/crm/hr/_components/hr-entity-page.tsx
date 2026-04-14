'use client';

import * as React from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
} from 'lucide-react';
import { useActionState, useEffect, useState, useTransition } from 'react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export type HrFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'number'
  | 'date'
  | 'email'
  | 'url'
  | 'tel'
  | 'array';

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
}

export interface HrColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => unknown;
  className?: string;
}

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
}

function renderField(field: HrField, value?: unknown) {
  const stringValue = typeof value === 'string' ? value : '';

  if (field.type === 'array') {
    return <FieldArray field={field} initialValue={value} />;
  }

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
        rows={3}
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
                      <Label
                        htmlFor={fieldId}
                        className="text-[11px] text-clay-ink-muted"
                      >
                        {s.label}
                      </Label>
                      <Select
                        value={row[s.name] || ''}
                        onValueChange={(v) => updateRow(i, s.name, v)}
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
                    <Label
                      htmlFor={fieldId}
                      className="text-[11px] text-clay-ink-muted"
                    >
                      {s.label}
                    </Label>
                    <Input
                      id={fieldId}
                      type={s.type || 'text'}
                      value={row[s.name] || ''}
                      placeholder={s.placeholder}
                      required={s.required}
                      onChange={(e) => updateRow(i, s.name, e.target.value)}
                      className="h-9 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                    />
                  </div>
                );
              })}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeRow(i)}
                className="text-clay-red"
                aria-label="Remove row"
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
        onClick={addRow}
        className="rounded-clay-md border-clay-border text-[12px]"
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        {field.addLabel || 'Add row'}
      </Button>

      {field.help ? (
        <p className="text-[11.5px] text-clay-ink-muted">{field.help}</p>
      ) : null}
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
}: HrEntityPageProps<T>) {
  const { toast } = useToast();
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={title}
        subtitle={subtitle}
        icon={icon}
        actions={
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Add {singular}
          </ClayButton>
        }
      />

      <ClayCard>
        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                {columns.map((c) => (
                  <TableHead
                    key={c.key}
                    className={'text-clay-ink-muted ' + (c.className || '')}
                  >
                    {c.label}
                  </TableHead>
                ))}
                <TableHead className="w-[120px] text-right text-clay-ink-muted">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && rows.length === 0 ? (
                [...Array(3)].map((_, i) => (
                  <TableRow key={i} className="border-clay-border">
                    <TableCell colSpan={columns.length + 1}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={columns.length + 1}
                    className="h-24 text-center text-[13px] text-clay-ink-muted"
                  >
                    {emptyText || `No ${singular.toLowerCase()} yet — click Add to get started.`}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row._id} className="border-clay-border">
                    {columns.map((c) => (
                      <TableCell key={c.key} className="text-[13px] text-clay-ink">
                        {c.render ? toNode(c.render(row)) : toNode(row[c.key])}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(row);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(row._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-clay-red" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-clay-ink">
              {editing ? `Edit ${singular}` : `Add ${singular}`}
            </DialogTitle>
            <DialogDescription className="text-clay-ink-muted">
              {editing ? 'Update the details and save.' : `Fill in the details below.`}
            </DialogDescription>
          </DialogHeader>

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
                  <Label htmlFor={field.name} className="text-clay-ink">
                    {field.label}
                    {field.required ? <span className="text-clay-red"> *</span> : null}
                  </Label>
                  <div className="mt-1.5">
                    {renderField(
                      field,
                      editing
                        ? field.type === 'array'
                          ? (editing[field.name] as unknown)
                          : formatFieldValue(editing[field.name], field.type)
                        : undefined,
                    )}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="gap-2">
              <ClayButton
                type="button"
                variant="pill"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </ClayButton>
              <ClayButton
                type="submit"
                variant="obsidian"
                disabled={isSaving}
                leading={
                  isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                  ) : null
                }
              >
                Save
              </ClayButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-clay-ink">Delete {singular}?</AlertDialogTitle>
            <AlertDialogDescription className="text-clay-ink-muted">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export { ClayBadge };

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
