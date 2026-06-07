"use client";

/**
 * RelatedRecordsPanel
 * -------------------
 * Renders the RELATION fields of a single SabCRM record as compact, linked
 * lists, and provides an inline "add relation" picker.
 *
 * Data flow — all server actions live in `@/app/actions/sabcrm.actions` and are
 * tenant-scoped + RBAC-gated server side (this component never touches Mongo):
 *
 *   - `listRelatedRecordsAction(recordId, relationKeys?)`
 *       → `Record<fieldKey, CrmRecordWithLabel[]>` — resolves every RELATION
 *         field of the record in one round-trip (MANY_TO_ONE collapses to a
 *         0/1-length list; ONE_TO_MANY is the back-reference set).
 *   - `searchRecordsForPickerAction(targetObject, search, limit?)`
 *       → `SabcrmPickerOption[]` (`{ id, label, object }`) — typeahead for the
 *         "add relation" picker.
 *   - `updateRecordAction(id, patch)`
 *       → mutation primitive used to attach/detach links:
 *         * MANY_TO_ONE: patch THIS record's `data[fieldKey]` to the target id
 *           (attach) or `null` (detach).
 *         * ONE_TO_MANY: patch the CHILD record's inverse MANY_TO_ONE field to
 *           point at this record's id (attach) or `null` (detach).
 *
 * UI: Ui20 primitives only (`@/components/ui20`), black & white. There is no
 * dedicated Spinner in the barrel, so loading uses lucide `Loader2` (matching
 * the sibling `record-detail.tsx`).
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { Plus, X, Search, ExternalLink, Loader2, Link2 } from "lucide-react";

import { Card, CardHeader, CardTitle, CardBody, Button, Input, Badge, EmptyState } from '@/components/sabcrm/20ui';

import type {
  ActionResult,
  CrmRecordWithLabel,
  FieldMetadata,
  FieldRelation,
  ObjectMetadata,
} from "@/lib/sabcrm/types";

import {
  listRelatedRecordsAction,
  searchRecordsForPickerAction,
  updateRecordAction,
} from "@/app/actions/sabcrm.actions";
import type { SabcrmPickerOption } from "@/app/actions/sabcrm.actions.types";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface RelatedRecordsPanelProps {
  /** The object the *current* record belongs to (its metadata). */
  object: ObjectMetadata;
  /** The current record whose relations we render. */
  record: CrmRecordWithLabel;
  /**
   * Catalogue of every object in the workspace, used to resolve each relation
   * field's `targetObject` slug into its metadata (labels, icon) and to find the
   * inverse field when (de)linking ONE_TO_MANY relations.
   */
  objects: ObjectMetadata[];
  /**
   * Project id to forward to the gated server actions. Optional — the actions
   * fall back to the caller's first project when omitted.
   */
  projectId?: string;
  /**
   * When false the panel is read-only: no add/detach controls are rendered.
   * Server still enforces RBAC; this is a UX affordance only.
   */
  canManage?: boolean;
  /** Optional callback fired after any successful attach/detach. */
  onChanged?: () => void;
  className?: string;
}

/** A relation field paired with its resolved target object metadata. */
interface ResolvedRelationField {
  field: FieldMetadata;
  relation: FieldRelation;
  target: ObjectMetadata;
  /** True for the ONE_TO_MANY (back-reference) side. */
  many: boolean;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function isRelationField(
  field: FieldMetadata,
): field is FieldMetadata & { relation: FieldRelation } {
  return field.type === "RELATION" && field.relation != null;
}

function targetHref(targetSlug: string, recordId: string): string {
  return `/sabcrm/${encodeURIComponent(targetSlug)}/${encodeURIComponent(recordId)}`;
}

/**
 * Find the inverse MANY_TO_ONE field on `target` that points back at
 * `sourceSlug` — i.e. the child field that owns a ONE_TO_MANY back-reference.
 * Used to attach/detach children by patching their owning field.
 */
function findInverseManyToOneKey(
  target: ObjectMetadata,
  sourceSlug: string,
): string | null {
  const inverse = target.fields.find(
    (f) =>
      f.type === "RELATION" &&
      f.relation?.kind === "MANY_TO_ONE" &&
      f.relation.targetObject === sourceSlug,
  );
  return inverse?.key ?? null;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function RelatedRecordsPanel({
  object,
  record,
  objects,
  projectId,
  canManage = false,
  onChanged,
  className,
}: RelatedRecordsPanelProps) {
  const objectIndex = useMemo(() => {
    const map = new Map<string, ObjectMetadata>();
    for (const o of objects) map.set(o.slug, o);
    return map;
  }, [objects]);

  const relationFields = useMemo<ResolvedRelationField[]>(() => {
    const out: ResolvedRelationField[] = [];
    for (const field of object.fields) {
      if (!isRelationField(field)) continue;
      const target = objectIndex.get(field.relation.targetObject);
      if (!target) continue; // target object not in catalogue — skip safely
      out.push({
        field,
        relation: field.relation,
        target,
        many: field.relation.kind === "ONE_TO_MANY",
      });
    }
    return out;
  }, [object.fields, objectIndex]);

  // All relations are resolved in one server round-trip, keyed by field key.
  const [resolved, setResolved] = useState<
    Record<string, CrmRecordWithLabel[]>
  >({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const relationKeys = useMemo(
    () => relationFields.map((rf) => rf.field.key),
    [relationFields],
  );

  const load = useCallback(async () => {
    if (relationKeys.length === 0) {
      setResolved({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res: ActionResult<Record<string, CrmRecordWithLabel[]>> =
        await listRelatedRecordsAction(record._id, relationKeys, projectId);
      if (res.ok) {
        setResolved(res.data);
      } else {
        setError(res.error);
        setResolved({});
      }
    } catch {
      setError("Failed to load related records.");
      setResolved({});
    } finally {
      setLoading(false);
    }
  }, [record._id, relationKeys, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (relationFields.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex flex-col gap-4">
        {error && (
          <p className="text-xs text-red-500" role="alert">
            {error}
          </p>
        )}
        {relationFields.map((rf) => (
          <RelationSection
            key={rf.field.key}
            sourceObject={object}
            record={record}
            resolved={rf}
            items={resolved[rf.field.key] ?? []}
            loading={loading}
            projectId={projectId}
            canManage={canManage}
            onReload={load}
            onChanged={onChanged}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-relation section                                                */
/* ------------------------------------------------------------------ */

interface RelationSectionProps {
  sourceObject: ObjectMetadata;
  record: CrmRecordWithLabel;
  resolved: ResolvedRelationField;
  items: CrmRecordWithLabel[];
  loading: boolean;
  projectId?: string;
  canManage: boolean;
  onReload: () => Promise<void>;
  onChanged?: () => void;
}

function RelationSection({
  sourceObject,
  record,
  resolved,
  items,
  loading,
  projectId,
  canManage,
  onReload,
  onChanged,
}: RelationSectionProps) {
  const { field, target, many } = resolved;

  const [pickerOpen, setPickerOpen] = useState<boolean>(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAttach = useCallback(
    (picked: SabcrmPickerOption) => {
      setMutationError(null);
      startTransition(async () => {
        let res: ActionResult<unknown>;
        if (many) {
          // ONE_TO_MANY: link by pointing the CHILD's inverse field at us.
          const inverseKey = findInverseManyToOneKey(target, sourceObject.slug);
          if (!inverseKey) {
            setMutationError(
              `Cannot link: ${target.labelSingular} has no field referencing ${sourceObject.labelSingular}.`,
            );
            return;
          }
          res = await updateRecordAction(
            picked.id,
            { [inverseKey]: record._id },
            projectId,
          );
        } else {
          // MANY_TO_ONE: set THIS record's field to the target id.
          res = await updateRecordAction(
            record._id,
            { [field.key]: picked.id },
            projectId,
          );
        }
        if (res.ok) {
          setPickerOpen(false);
          await onReload();
          onChanged?.();
        } else {
          setMutationError(res.error);
        }
      });
    },
    [
      many,
      target,
      sourceObject.slug,
      sourceObject.labelSingular,
      target.labelSingular,
      record._id,
      field.key,
      projectId,
      onReload,
      onChanged,
    ],
  );

  const handleDetach = useCallback(
    (linked: CrmRecordWithLabel) => {
      setMutationError(null);
      startTransition(async () => {
        let res: ActionResult<unknown>;
        if (many) {
          const inverseKey = findInverseManyToOneKey(target, sourceObject.slug);
          if (!inverseKey) {
            setMutationError("Cannot unlink: inverse field not found.");
            return;
          }
          res = await updateRecordAction(
            linked._id,
            { [inverseKey]: null },
            projectId,
          );
        } else {
          res = await updateRecordAction(
            record._id,
            { [field.key]: null },
            projectId,
          );
        }
        if (res.ok) {
          await onReload();
          onChanged?.();
        } else {
          setMutationError(res.error);
        }
      });
    },
    [
      many,
      target,
      sourceObject.slug,
      record._id,
      field.key,
      projectId,
      onReload,
      onChanged,
    ],
  );

  // A MANY_TO_ONE relation can only point at a single record: hide the add
  // control once it is filled.
  const canAdd = canManage && (many || items.length === 0);
  const excludeIds = useMemo(() => items.map((i) => i._id), [items]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Link2 className="h-4 w-4 opacity-60" aria-hidden />
          <span>{field.label}</span>
          {!loading && (
            <Badge variant="outline" className="ml-1">
              {items.length}
            </Badge>
          )}
        </CardTitle>
        {canAdd && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            aria-label={`Add ${target.labelSingular} relation`}
          >
            <Plus className="h-4 w-4" />
            <span className="ml-1">Add</span>
          </Button>
        )}
      </CardHeader>

      <CardBody className="flex flex-col gap-2">
        {canAdd && pickerOpen && (
          <RelationPicker
            target={target}
            excludeIds={excludeIds}
            projectId={projectId}
            onPick={handleAttach}
            onCancel={() => setPickerOpen(false)}
          />
        )}

        {mutationError && (
          <p className="text-xs text-red-500" role="alert">
            {mutationError}
          </p>
        )}

        {loading ? (
          <div className="flex items-center gap-2 py-3 text-xs opacity-60">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span>Loading {target.labelPlural.toLowerCase()}…</span>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            className="py-4"
            title={`No ${target.labelPlural.toLowerCase()}`}
            description={
              canAdd
                ? `Link a ${target.labelSingular.toLowerCase()} to get started.`
                : undefined
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/10">
            {items.map((item) => (
              <RelatedRow
                key={item._id}
                item={item}
                target={target}
                disabled={isPending}
                onDetach={canManage ? () => handleDetach(item) : undefined}
              />
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Single related row                                                  */
/* ------------------------------------------------------------------ */

interface RelatedRowProps {
  item: CrmRecordWithLabel;
  target: ObjectMetadata;
  disabled?: boolean;
  onDetach?: () => void;
}

function RelatedRow({ item, target, disabled, onDetach }: RelatedRowProps) {
  const href = targetHref(target.slug, item._id);
  return (
    <li className="group flex items-center justify-between gap-2 py-2">
      <Link
        href={href}
        className="flex min-w-0 flex-1 items-center gap-2 text-sm hover:underline"
      >
        <span className="truncate">{item.label || item._id}</span>
        <ExternalLink className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-50" />
      </Link>
      {onDetach && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          disabled={disabled}
          onClick={onDetach}
          aria-label={`Remove ${item.label || item._id}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Add-relation picker (typeahead)                                     */
/* ------------------------------------------------------------------ */

interface RelationPickerProps {
  target: ObjectMetadata;
  excludeIds: string[];
  projectId?: string;
  onPick: (option: SabcrmPickerOption) => void;
  onCancel: () => void;
}

function RelationPicker({
  target,
  excludeIds,
  projectId,
  onPick,
  onCancel,
}: RelationPickerProps) {
  const [term, setTerm] = useState<string>("");
  const [results, setResults] = useState<SabcrmPickerOption[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      setSearching(true);
      searchRecordsForPickerAction(target.slug, term, 8, projectId)
        .then((res: ActionResult<SabcrmPickerOption[]>) => {
          if (cancelled) return;
          setResults(
            res.ok ? res.data.filter((r) => !excludeSet.has(r.id)) : [],
          );
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [term, target.slug, projectId, excludeSet]);

  return (
    <div className="rounded-md border border-black/10 p-2 dark:border-white/10">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
        <Input
          ref={inputRef}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={`Search ${target.labelPlural.toLowerCase()}…`}
          className="pl-8 pr-8"
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
          aria-label={`Search ${target.labelPlural} to link`}
        />
        {searching && (
          <Loader2 className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin opacity-50" />
        )}
      </div>

      <ul className="mt-2 flex max-h-56 flex-col overflow-y-auto">
        {!searching && results.length === 0 && (
          <li className="px-2 py-3 text-xs opacity-60">
            {term
              ? "No matches."
              : `Type to search ${target.labelPlural.toLowerCase()}.`}
          </li>
        )}
        {results.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onPick(r)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
            >
              <Plus className="h-3.5 w-3.5 shrink-0 opacity-50" />
              <span className="truncate">{r.label || r.id}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
