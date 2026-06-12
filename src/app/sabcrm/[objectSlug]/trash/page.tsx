'use client';

/**
 * SabCRM — Trash screen (`/sabcrm/[objectSlug]/trash`), 20ui.
 *
 * Lists the object's soft-deleted records in a 20ui table and offers, per row
 * and in bulk via row selection:
 *
 *   - Restore — un-deletes the record (`restoreSabcrmRecordTw`) and removes it
 *     from the list optimistically.
 *   - Delete permanently — opens a confirm AlertDialog, then hard-deletes via
 *     `permanentDeleteSabcrmRecordTw` and removes the row(s).
 *
 * 20ui only (`@/components/sabcrm/20ui` + the record composites' `RecordCell`
 * for field-value rendering) plus the sibling `trash.css` for page-local layout
 * (`.str-*`, scoped to the 20ui root). Every data call is a gated server action
 * returning an `ActionResult`; the Rust engine may be DOWN, so every branch
 * degrades to an inline alert / empty state and the page never crashes.
 */

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Database,
} from 'lucide-react';

import {
  Alert,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Checkbox,
  EmptyState,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Skeleton,
  Table,
  TBody,
  Td,
  TFoot,
  Th,
  THead,
  Tr,
} from '@/components/sabcrm/20ui';
import { RecordCell } from '@/components/sabcrm/20ui/composites/record';
import { useProject } from '@/context/project-context';
import {
  listSabcrmObjectsTw,
  listSabcrmTrashTw,
  restoreSabcrmRecordTw,
  permanentDeleteSabcrmRecordTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type { SabcrmRustRecord } from '@/app/actions/sabcrm-twenty.actions.types';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';
import { sabcrmRecordLabel } from '@/lib/sabcrm/record-label';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import './trash.css';

// ---------------------------------------------------------------------------
// Value helpers (mirrors the index page so the trash table reads identically)
// ---------------------------------------------------------------------------

/** Resolve a record's display label from the object's `isLabel` field. */
function recordLabel(object: ObjectMetadata, record: SabcrmRustRecord): string {
  return sabcrmRecordLabel(object, record);
}

/**
 * Best-effort soft-delete timestamp. The engine record carries `createdAt` /
 * `updatedAt` (the delete write bumps `updatedAt`); a `deletedAt` may also be
 * surfaced inside `data`. Prefer an explicit deleted marker, fall back to
 * `updatedAt`, then `createdAt`.
 */
function deletedAtOf(record: SabcrmRustRecord): string | null {
  const fromData =
    (record.data['deletedAt'] as string | undefined) ??
    (record.data['__deletedAt'] as string | undefined) ??
    (record.data['deleted_at'] as string | undefined);
  return fromData ?? record.updatedAt ?? record.createdAt ?? null;
}

/** Format an ISO timestamp into a compact, locale-aware date-time. */
function fmtTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** What the permanent-delete confirm is about to destroy. */
type ConfirmTarget =
  | { kind: 'one'; record: SabcrmRustRecord }
  | { kind: 'bulk'; ids: string[] };

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmTrashPage(): React.JSX.Element {
  const params = useParams<{ objectSlug: string }>();
  const objectSlug = params?.objectSlug ?? '';
  const { activeProjectId } = useProject();

  const [object, setObject] = React.useState<ObjectMetadata | null>(null);
  const [loadingObject, setLoadingObject] = React.useState(true);
  const [objectError, setObjectError] = React.useState<string | null>(null);

  const [records, setRecords] = React.useState<SabcrmRustRecord[]>([]);
  /** Total trashed records server-side (may exceed the loaded page). */
  const [total, setTotal] = React.useState(0);
  const [loadingData, setLoadingData] = React.useState(true);
  const [dataError, setDataError] = React.useState<string | null>(null);

  // Row selection (drives the bulk action bar).
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // Rows currently restoring / deleting (drives the per-row busy dimming).
  const [busy, setBusy] = React.useState<Set<string>>(new Set());
  /** A bulk run is in flight (disables the bulk bar + selection). */
  const [bulkBusy, setBulkBusy] = React.useState(false);

  // Permanent-delete confirm flow: the target pending confirmation, plus the
  // dialog's in-flight + error state.
  const [confirm, setConfirm] = React.useState<ConfirmTarget | null>(null);
  const [confirmDeleting, setConfirmDeleting] = React.useState(false);
  const [confirmError, setConfirmError] = React.useState<string | null>(null);

  // ---- Load object metadata ----------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    setLoadingObject(true);
    setObjectError(null);
    (async () => {
      const res = await listSabcrmObjectsTw(activeProjectId ?? undefined);
      if (cancelled) return;
      if (!res.ok) {
        setObjectError(res.error);
        setObject(null);
      } else {
        setObject(res.data.find((o) => o.slug === objectSlug) ?? null);
      }
      setLoadingObject(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, activeProjectId]);

  // ---- Load trashed records ----------------------------------------------
  React.useEffect(() => {
    if (!object || !objectSlug) return;
    let cancelled = false;
    setLoadingData(true);
    setDataError(null);
    setSelected(new Set());
    (async () => {
      const res = await listSabcrmTrashTw(
        objectSlug,
        undefined,
        activeProjectId ?? undefined,
      );
      if (cancelled) return;
      if (!res.ok) {
        setDataError(res.error);
        setRecords([]);
        setTotal(0);
      } else {
        // `listSabcrmTrashTw` resolves to a `{ records, total }` page.
        setRecords(res.data.records);
        setTotal(res.data.total);
      }
      setLoadingData(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [object, objectSlug, activeProjectId]);

  // The label field + a couple of inTable preview columns (skip the label and
  // relation fields — relations don't read cleanly out of a trashed snapshot).
  const previewFields = React.useMemo<FieldMetadata[]>(
    () =>
      object
        ? object.fields
            .filter((f) => f.inTable && !f.isLabel && f.type !== 'RELATION')
            .slice(0, 2)
        : [],
    [object],
  );

  // ---- Selection -----------------------------------------------------------

  const selectedIds = React.useMemo(
    () => records.filter((r) => selected.has(r.id)).map((r) => r.id),
    [records, selected],
  );
  const allSelected = records.length > 0 && selectedIds.length === records.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

  const toggleAll = React.useCallback(() => {
    setSelected((prev) =>
      records.length > 0 && records.every((r) => prev.has(r.id))
        ? new Set()
        : new Set(records.map((r) => r.id)),
    );
  }, [records]);

  const toggleOne = React.useCallback((recordId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }, []);

  /** Drop a record from the local list after a successful restore / delete. */
  const removeRow = React.useCallback((recordId: string) => {
    setRecords((rs) => rs.filter((r) => r.id !== recordId));
    setTotal((t) => Math.max(0, t - 1));
    setSelected((s) => {
      if (!s.has(recordId)) return s;
      const n = new Set(s);
      n.delete(recordId);
      return n;
    });
  }, []);

  // ---- Restore (single) ----------------------------------------------------
  const handleRestore = React.useCallback(
    async (recordId: string) => {
      if (busy.has(recordId) || bulkBusy) return;
      setBusy((b) => new Set(b).add(recordId));
      setDataError(null);

      const res = await restoreSabcrmRecordTw(
        objectSlug,
        recordId,
        activeProjectId ?? undefined,
      );

      if (!res.ok) {
        setDataError(res.error);
      } else {
        // Restored → it leaves the trash list.
        removeRow(recordId);
      }
      setBusy((b) => {
        const n = new Set(b);
        n.delete(recordId);
        return n;
      });
    },
    [busy, bulkBusy, objectSlug, activeProjectId, removeRow],
  );

  // ---- Restore (bulk, over the selection) ----------------------------------
  const handleBulkRestore = React.useCallback(async () => {
    const ids = selectedIds;
    if (ids.length === 0 || bulkBusy) return;
    setBulkBusy(true);
    setBusy(new Set(ids));
    setDataError(null);

    let failed = 0;
    let firstError: string | null = null;
    for (const id of ids) {
      const res = await restoreSabcrmRecordTw(
        objectSlug,
        id,
        activeProjectId ?? undefined,
      );
      if (res.ok) {
        removeRow(id);
      } else {
        failed += 1;
        if (!firstError) firstError = res.error;
      }
      setBusy((b) => {
        const n = new Set(b);
        n.delete(id);
        return n;
      });
    }

    setBulkBusy(false);
    if (firstError) {
      setDataError(
        failed > 1 ? `${firstError} (${failed} records failed)` : firstError,
      );
    }
  }, [selectedIds, bulkBusy, objectSlug, activeProjectId, removeRow]);

  // ---- Permanent delete (confirmed; single or bulk) -------------------------
  const handleConfirmDelete = React.useCallback(async () => {
    if (!confirm || confirmDeleting) return;
    const ids = confirm.kind === 'one' ? [confirm.record.id] : confirm.ids;
    setConfirmDeleting(true);
    setConfirmError(null);
    setBusy(new Set(ids));

    let failed = 0;
    let firstError: string | null = null;
    for (const id of ids) {
      const res = await permanentDeleteSabcrmRecordTw(
        objectSlug,
        id,
        activeProjectId ?? undefined,
      );
      if (res.ok) {
        removeRow(id);
      } else {
        failed += 1;
        if (!firstError) firstError = res.error;
      }
      setBusy((b) => {
        const n = new Set(b);
        n.delete(id);
        return n;
      });
    }

    setConfirmDeleting(false);
    if (firstError) {
      // Keep the dialog open so the failure is read in context.
      setConfirmError(
        failed > 1 ? `${firstError} (${failed} records failed)` : firstError,
      );
      return;
    }
    setConfirm(null);
  }, [confirm, confirmDeleting, objectSlug, activeProjectId, removeRow]);

  const openConfirm = React.useCallback((target: ConfirmTarget) => {
    setConfirmError(null);
    setConfirmDeleting(false);
    setConfirm(target);
  }, []);

  const closeConfirm = React.useCallback(() => {
    if (confirmDeleting) return;
    setConfirm(null);
    setConfirmError(null);
  }, [confirmDeleting]);

  // ---- Render -------------------------------------------------------------

  if (loadingObject) {
    return (
      <div className="str-page">
        <div className="str-page__inner">
          <div className="str-skeletons">
            <Skeleton width={220} height={28} radius={6} />
            <Skeleton height={40} radius={8} />
            <Skeleton height={240} radius={10} />
          </div>
        </div>
      </div>
    );
  }

  if (objectError && !object) {
    return (
      <div className="str-page">
        <div className="str-page__inner">
          <Alert tone="danger" icon={AlertTriangle}>
            {objectError}
          </Alert>
        </div>
      </div>
    );
  }

  if (!object) {
    return (
      <div className="str-page">
        <div className="str-page__inner">
          <EmptyState
            icon={Database}
            title="Object not found"
            description={`No CRM object matches “${objectSlug}”. It may have been removed or you may not have access.`}
            action={
              <Button variant="secondary" asChild>
                <Link href="/sabcrm">Back to SabCRM</Link>
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  // checkbox + label + previews + deleted-at + actions
  const colSpan = previewFields.length + 4;

  const confirmCount =
    confirm?.kind === 'bulk' ? confirm.ids.length : confirm ? 1 : 0;
  const confirmName =
    confirm?.kind === 'one'
      ? recordLabel(object, confirm.record)
      : `${confirmCount} ${
          confirmCount === 1
            ? object.labelSingular.toLowerCase()
            : object.labelPlural.toLowerCase()
        }`;

  return (
    <div className="str-page">
      <div className="str-page__inner">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Trash — {object.labelPlural}</PageTitle>
            <PageDescription>
              Soft-deleted {object.labelPlural.toLowerCase()} — restore them or
              remove them permanently.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button variant="secondary" iconLeft={ArrowLeft} asChild>
              <Link href={`/sabcrm/${object.slug}`}>
                Back to {object.labelPlural.toLowerCase()}
              </Link>
            </Button>
          </PageActions>
        </PageHeader>

        {dataError && (
          <Alert tone="danger" icon={AlertTriangle}>
            {dataError}
          </Alert>
        )}

        {/* Bulk action bar — appears once any row is selected. */}
        {selectedIds.length > 0 && (
          <div className="str-bulkbar" role="toolbar" aria-label="Bulk actions">
            <span className="str-bulkbar__count">
              {selectedIds.length} selected
            </span>
            <span className="str-bulkbar__spacer" />
            <Button
              variant="secondary"
              size="sm"
              iconLeft={RotateCcw}
              disabled={bulkBusy || confirmDeleting}
              loading={bulkBusy}
              onClick={() => void handleBulkRestore()}
            >
              Restore
            </Button>
            <Button
              variant="secondary"
              size="sm"
              iconLeft={Trash2}
              className="str-btn-danger"
              disabled={bulkBusy || confirmDeleting}
              onClick={() => openConfirm({ kind: 'bulk', ids: selectedIds })}
            >
              Delete permanently
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={bulkBusy || confirmDeleting}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
          </div>
        )}

        {loadingData ? (
          <div className="str-skeletons">
            <Skeleton height={36} radius={8} />
            <Skeleton height={36} radius={8} />
            <Skeleton height={36} radius={8} />
            <Skeleton height={36} radius={8} />
            <Skeleton height={36} radius={8} />
            <Skeleton height={36} radius={8} />
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            icon={Trash2}
            title="Trash is empty"
            description={`No deleted ${object.labelPlural.toLowerCase()} to restore.`}
            action={
              <Button variant="secondary" asChild>
                <Link href={`/sabcrm/${object.slug}`}>
                  Back to {object.labelPlural}
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="str-table-wrap">
            <Table density="compact">
              <THead>
                <Tr>
                  <Th className="str-check-col">
                    <Checkbox
                      size="sm"
                      checked={allSelected}
                      indeterminate={someSelected}
                      disabled={bulkBusy}
                      onChange={toggleAll}
                      aria-label="Select all records"
                    />
                  </Th>
                  <Th>{object.labelSingular}</Th>
                  {previewFields.map((f) => (
                    <Th key={f.key}>{f.label}</Th>
                  ))}
                  <Th>Deleted</Th>
                  <Th align="right" aria-label="Actions" />
                </Tr>
              </THead>
              <TBody>
                {records.map((record) => {
                  const isBusy = busy.has(record.id);
                  const isSelected = selected.has(record.id);
                  const label = recordLabel(object, record);
                  return (
                    <Tr
                      key={record.id}
                      selected={isSelected}
                      className={isBusy ? 'str-row--busy' : undefined}
                    >
                      <Td className="str-check-col">
                        <Checkbox
                          size="sm"
                          checked={isSelected}
                          disabled={isBusy || bulkBusy}
                          onChange={() => toggleOne(record.id)}
                          aria-label={`Select ${label}`}
                        />
                      </Td>
                      <Td>
                        <span className="str-label">{label}</span>
                      </Td>
                      {previewFields.map((f) => (
                        <Td key={f.key}>
                          <RecordCell field={f} value={record.data[f.key]} />
                        </Td>
                      ))}
                      <Td>
                        <span className="str-time">
                          {fmtTime(deletedAtOf(record))}
                        </span>
                      </Td>
                      <Td align="right" className="str-actions__cell">
                        <span className="str-actions">
                          <Button
                            variant="secondary"
                            size="sm"
                            iconLeft={RotateCcw}
                            disabled={isBusy || bulkBusy}
                            loading={isBusy && !bulkBusy && !confirmDeleting}
                            onClick={() => void handleRestore(record.id)}
                          >
                            Restore
                          </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                            iconLeft={Trash2}
                            className="str-btn-danger"
                            disabled={isBusy || bulkBusy}
                            onClick={() =>
                              openConfirm({ kind: 'one', record })
                            }
                          >
                            Delete permanently
                          </Button>
                        </span>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
              <TFoot>
                <Tr>
                  <Td colSpan={colSpan}>
                    <span className="str-time">
                      {total > records.length
                        ? `Showing ${records.length} of ${total} `
                        : `${total} `}
                      {total === 1
                        ? object.labelSingular.toLowerCase()
                        : object.labelPlural.toLowerCase()}{' '}
                      in trash
                    </span>
                  </Td>
                </Tr>
              </TFoot>
            </Table>
          </div>
        )}

        {/* Permanent-delete confirm (single row or the whole selection). */}
        <AlertDialog
          open={confirm !== null}
          onOpenChange={(open) => {
            if (!open) closeConfirm();
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete permanently?</AlertDialogTitle>
              <AlertDialogDescription>
                Permanently delete{' '}
                <span className="str-confirm__name">{confirmName}</span>? This
                action cannot be undone —{' '}
                {confirmCount === 1
                  ? `the ${object.labelSingular.toLowerCase()} and its data are`
                  : `these ${object.labelPlural.toLowerCase()} and their data are`}{' '}
                removed for good.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {confirmError && (
              <Alert tone="danger" icon={AlertTriangle}>
                {confirmError}
              </Alert>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={confirmDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={confirmDeleting}
                onClick={(e) => {
                  // Stay open while the delete runs (and on failure).
                  e.preventDefault();
                  void handleConfirmDelete();
                }}
              >
                {confirmDeleting ? 'Deleting…' : 'Delete permanently'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
