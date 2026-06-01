'use client';

/**
 * SabCRM — record detail panel (inline-edit).
 *
 * A metadata-driven detail view of a single record. It can either receive a
 * record directly (`record` prop) or fetch one by id (`recordId` prop) via
 * {@link getRecordAction}.
 *
 * Every editable field is rendered in place: the read-only {@link FieldValue}
 * acts as a button that, when clicked, swaps to the shared {@link FieldInput}
 * editor. Saving a field dispatches {@link updateRecordAction} with an
 * optimistic update + toast; a failed save rolls the value back. Fields are
 * grouped into sections (Details / Relationships) and a created/updated meta
 * footer is always shown.
 *
 * The component owns its own optimistic copy of `record.data` so edits feel
 * instant, while staying in lockstep with any `record` prop the host supplies
 * (e.g. after a full-dialog edit via {@link onEdit}). FILE fields route through
 * SabFiles inside {@link FieldInput}, per SabNode policy.
 *
 * This is a client component (interactive inline editing + optimistic state).
 */

import * as React from 'react';
import {
  Calendar,
  Check,
  Link2,
  Loader2,
  Lock,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
  Skeleton,
  EmptyState,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  getRecordAction,
  updateRecordAction,
  deleteRecordAction,
} from '@/app/actions/sabcrm.actions';
import type {
  ObjectMetadata,
  FieldMetadata,
  CrmRecordWithLabel,
} from '@/lib/sabcrm/types';
import {
  FieldValue,
  FieldInput,
  resolveRecordTitle,
  type RelationOption,
} from './field-renderer';

export interface RecordDetailProps {
  object: ObjectMetadata;
  /** A pre-loaded record. Mutually exclusive with `recordId`. */
  record?: CrmRecordWithLabel | null;
  /** Record id to fetch when no `record` is supplied. */
  recordId?: string;
  /** Active project override forwarded to the server action. */
  projectId?: string;
  /**
   * Invoked when the user requests the full edit dialog (host opens the form
   * dialog). Inline editing is the primary path; this stays available for
   * editing many fields at once.
   */
  onEdit?: (record: CrmRecordWithLabel) => void;
  /** Invoked after a successful delete so the host can navigate away. */
  onDeleted?: (id: string) => void;
  /** Invoked after a successful inline field save with the patched record. */
  onUpdated?: (record: CrmRecordWithLabel) => void;
  /** Whether the current user may edit (gates inline edit + Edit button). */
  canEdit?: boolean;
  /** Whether the current user may delete (gates the Delete button). */
  canDelete?: boolean;
  /** Resolver mapping a related record id to a label, for RELATION rows. */
  resolveRelationLabel?: (id: string) => string | undefined;
  /**
   * RELATION candidate options keyed by target-object slug, used by the inline
   * RELATION editor. The host fetches related records once and passes their
   * {id,label} pairs here (same contract as the form dialog).
   */
  relationOptionsByObject?: Record<string, RelationOption[]>;
  /** Bump to force a refetch when fetching by id. */
  refreshToken?: number;
  className?: string;
}

/** A logical grouping of fields rendered as one section. */
interface FieldSection {
  key: string;
  title: string;
  fields: FieldMetadata[];
}

/**
 * Groups an object's detail fields into sections. The schema has no explicit
 * section metadata, so we derive a stable, sensible grouping:
 *   - "Relationships" — every RELATION field, surfaced together.
 *   - "Details"       — everything else, in declaration order.
 * The label field is excluded (it's the title) and empty sections are dropped.
 */
function buildSections(object: ObjectMetadata): FieldSection[] {
  const details: FieldMetadata[] = [];
  const relationships: FieldMetadata[] = [];

  for (const field of object.fields) {
    if (field.isLabel) continue;
    if (field.type === 'RELATION') relationships.push(field);
    else details.push(field);
  }

  const sections: FieldSection[] = [];
  if (details.length > 0) {
    sections.push({ key: 'details', title: 'Details', fields: details });
  }
  if (relationships.length > 0) {
    sections.push({
      key: 'relationships',
      title: 'Relationships',
      fields: relationships,
    });
  }
  return sections;
}

/** Read-only detail view of a single SabCRM record, editable field-by-field. */
export function RecordDetail({
  object,
  record: recordProp,
  recordId,
  projectId,
  onEdit,
  onDeleted,
  onUpdated,
  canEdit = true,
  canDelete = true,
  resolveRelationLabel,
  relationOptionsByObject = {},
  refreshToken = 0,
  className,
}: RecordDetailProps): React.ReactElement {
  const { toast } = useZoruToast();

  const [fetched, setFetched] = React.useState<CrmRecordWithLabel | null>(
    recordProp ?? null,
  );
  const [loading, setLoading] = React.useState(!recordProp && !!recordId);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // The field currently being edited inline (one at a time), plus its draft
  // value and a save-in-flight flag.
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<unknown>(undefined);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);

  const toastRef = React.useRef(toast);
  React.useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // Keep in sync with a directly-supplied record (e.g. after a dialog edit).
  React.useEffect(() => {
    if (recordProp !== undefined) setFetched(recordProp);
  }, [recordProp]);

  // Fetch by id when no record was supplied.
  React.useEffect(() => {
    if (recordProp || !recordId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getRecordAction(recordId, projectId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        setError(res.error);
        setFetched(null);
        return;
      }
      setFetched(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [recordProp, recordId, projectId, refreshToken]);

  const record = fetched;

  const sections = React.useMemo<FieldSection[]>(
    () => buildSections(object),
    [object],
  );

  const beginEdit = React.useCallback(
    (field: FieldMetadata, current: unknown) => {
      if (!canEdit || field.system || savingKey) return;
      setEditingKey(field.key);
      setDraft(current);
    },
    [canEdit, savingKey],
  );

  const cancelEdit = React.useCallback(() => {
    setEditingKey(null);
    setDraft(undefined);
  }, []);

  const commitEdit = React.useCallback(
    async (field: FieldMetadata) => {
      if (!record) return;
      const next = draft;
      const prev = record.data[field.key];

      // No-op if unchanged — close without a round-trip.
      if (sameValue(next, prev)) {
        cancelEdit();
        return;
      }

      // Optimistic update: patch the local record immediately.
      const optimistic: CrmRecordWithLabel = {
        ...record,
        data: { ...record.data, [field.key]: next },
      };
      setFetched(optimistic);
      setSavingKey(field.key);
      setEditingKey(null);

      const res = await updateRecordAction(
        record._id,
        { [field.key]: next },
        projectId,
      );
      setSavingKey(null);

      if (!res.ok) {
        // Roll back to the pre-edit value.
        setFetched((curr) =>
          curr
            ? { ...curr, data: { ...curr.data, [field.key]: prev } }
            : curr,
        );
        toastRef.current({
          title: 'Save failed',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }

      // Reconcile with the server's authoritative copy (timestamps, coercions),
      // preserving the resolved label decoration the read view relies on.
      const saved: CrmRecordWithLabel = {
        ...optimistic,
        data: res.data.data,
        updatedAt: res.data.updatedAt,
        createdAt: res.data.createdAt,
      };
      setFetched(saved);
      onUpdated?.(saved);
      toastRef.current({ title: `${field.label} updated.` });
    },
    [record, draft, projectId, cancelEdit, onUpdated],
  );

  const onDelete = React.useCallback(async () => {
    if (!record) return;
    const title = resolveRecordTitle(record, object.fields);
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(`Delete "${title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeleting(true);
    const res = await deleteRecordAction(record._id, projectId);
    setDeleting(false);

    if (!res.ok) {
      toastRef.current({
        title: 'Delete failed',
        description: res.error,
        variant: 'destructive',
      });
      return;
    }
    toastRef.current({ title: `Deleted ${object.labelSingular.toLowerCase()}.` });
    onDeleted?.(record._id);
  }, [record, object.fields, object.labelSingular, projectId, onDeleted]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-full max-w-sm" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error || !record) {
    return (
      <Card className={className}>
        <CardContent className="py-10">
          <EmptyState
            title={error ? 'Couldn’t load record' : 'Record not found'}
            description={
              error ?? 'This record may have been deleted or moved.'
            }
          />
        </CardContent>
      </Card>
    );
  }

  const title = resolveRecordTitle(record, object.fields);

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-zoru-ink-muted">
            {object.labelSingular}
          </p>
          <CardTitle className="truncate">{title}</CardTitle>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {canEdit && onEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEdit(record)}
            >
              <Pencil /> Edit all
            </Button>
          )}
          {canDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={deleting}
              onClick={() => void onDelete()}
            >
              {deleting ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Trash2 className="text-zoru-ink-muted" />
              )}
              Delete
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-0 p-0">
        {sections.map((section, sectionIdx) => (
          <div key={section.key}>
            {sectionIdx > 0 && <Separator />}
            <div className="px-5 pt-4">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zoru-ink-muted">
                {section.key === 'relationships' && (
                  <Link2 className="h-3.5 w-3.5" />
                )}
                {section.title}
              </h3>
            </div>
            <dl className="divide-y divide-zoru-line">
              {section.fields.map((field) => {
                const value = record.data[field.key];
                const isEditing = editingKey === field.key;
                const isSaving = savingKey === field.key;
                const editable = canEdit && !field.system;
                const relationOptions = field.relation
                  ? relationOptionsByObject[field.relation.targetObject] ?? []
                  : undefined;
                const fieldId = `sabcrm-detail-${field.key}`;

                return (
                  <div
                    key={field.key}
                    className="grid grid-cols-1 gap-1 px-5 py-3 sm:grid-cols-[180px_1fr] sm:gap-4"
                  >
                    <dt className="flex items-center gap-1 text-sm font-medium text-zoru-ink-muted">
                      <label htmlFor={isEditing ? fieldId : undefined}>
                        {field.label}
                      </label>
                      {field.required && (
                        <span className="text-zoru-danger" aria-hidden>
                          *
                        </span>
                      )}
                      {field.system && (
                        <Lock
                          className="h-3 w-3 text-zoru-ink-muted/60"
                          aria-label="Read-only"
                        />
                      )}
                    </dt>

                    <dd className="min-w-0 text-sm">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <FieldInput
                            id={fieldId}
                            field={field}
                            value={draft}
                            disabled={isSaving}
                            relationOptions={relationOptions}
                            onChange={setDraft}
                          />
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={isSaving}
                              onClick={() => void commitEdit(field)}
                            >
                              {isSaving ? (
                                <Loader2 className="animate-spin" />
                              ) : (
                                <Check />
                              )}
                              Save
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={isSaving}
                              onClick={cancelEdit}
                            >
                              <X /> Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="group flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!editable}
                            onClick={() => beginEdit(field, value)}
                            className={cn(
                              'min-w-0 flex-1 rounded-[var(--zoru-radius)] px-2 py-1 text-left transition-colors',
                              editable
                                ? 'cursor-text hover:bg-zoru-surface'
                                : 'cursor-default',
                            )}
                            aria-label={
                              editable
                                ? `Edit ${field.label}`
                                : undefined
                            }
                          >
                            <FieldValue
                              field={field}
                              value={value}
                              resolveRelationLabel={resolveRelationLabel}
                            />
                          </button>
                          {isSaving && (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-zoru-ink-muted" />
                          )}
                          {editable && !isSaving && (
                            <Pencil
                              className="h-3.5 w-3.5 shrink-0 text-zoru-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
                              aria-hidden
                            />
                          )}
                        </div>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        ))}

        <Separator />

        {/* System metadata footer */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-3 text-xs text-zoru-ink-muted">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Created {formatTimestamp(record.createdAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            Updated {formatTimestamp(record.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Shallow equality for field values. Arrays (MULTI_SELECT / RELATION) are
 * compared element-wise; primitives by value. Used to skip no-op saves.
 */
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => v === b[i]);
  }
  // Normalise the empty cases ('' / null / undefined) so blanking a field that
  // was already blank is treated as a no-op.
  const aEmpty = a === '' || a === null || a === undefined;
  const bEmpty = b === '' || b === null || b === undefined;
  return aEmpty && bEmpty;
}

function formatTimestamp(raw: string): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString();
}
