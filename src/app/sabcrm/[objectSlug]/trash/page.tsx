'use client';

/**
 * SabCRM — Twenty-faithful TRASH screen (`/sabcrm/[objectSlug]/trash`).
 *
 * Lists the object's soft-deleted records and offers two per-row actions in
 * Twenty's visual language (the `.st-*` kit + the new `.str-*` classes — NO
 * ZoruUI here on purpose, to match the rest of the SabCRM Twenty slice):
 *
 *   - Restore — un-deletes the record (`restoreSabcrmRecordTw`) and removes it
 *     from the list optimistically.
 *   - Delete permanently — opens a confirm dialog, then hard-deletes via
 *     `permanentDeleteSabcrmRecordTw` and removes the row.
 *
 * Every data call is a gated server action returning an `ActionResult`; the
 * Rust engine may be DOWN, so the error branch renders an inline banner and the
 * page degrades to empty/error states — it never crashes.
 */

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Trash2,
  RotateCcw,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { TwentyFieldValue } from '@/components/sabcrm/twenty/twenty-field';
import './trash.css';
import { useProject } from '@/context/project-context';
import {
  listSabcrmObjectsTw,
  listSabcrmTrashTw,
  restoreSabcrmRecordTw,
  permanentDeleteSabcrmRecordTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type { SabcrmRustRecord } from '@/app/actions/sabcrm-twenty.actions.types';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';

// ---------------------------------------------------------------------------
// Value helpers (mirrors the index page so the trash table reads identically)
// ---------------------------------------------------------------------------

/** Resolve a record's display label from the object's `isLabel` field. */
function recordLabel(object: ObjectMetadata, record: SabcrmRustRecord): string {
  const field =
    object.fields.find((f) => f.isLabel) ??
    object.fields.find((f) => f.type === 'TEXT' || f.type === 'EMAIL') ??
    object.fields[0];
  if (field) {
    const raw = record.data[field.key];
    if (typeof raw === 'string' && raw.trim()) return raw;
    if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
  }
  return `${object.labelSingular} ${record.id.slice(-6)}`;
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

// ---------------------------------------------------------------------------
// Confirm dialog for permanent deletion
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  /** Human label of the record about to be destroyed. */
  recordLabelText: string;
  objectSingular: string;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({
  recordLabelText,
  objectSingular,
  deleting,
  error,
  onCancel,
  onConfirm,
}: ConfirmDialogProps): React.JSX.Element {
  // Close on Escape (but never while a delete is mid-flight).
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel, deleting]);

  return (
    <div
      className="st-dialog-overlay"
      onClick={deleting ? undefined : onCancel}
      role="presentation"
    >
      <div
        className="st-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Permanently delete ${objectSingular}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="st-dialog__header">
          <h2 className="st-dialog__title">Delete permanently</h2>
          <button
            type="button"
            className="st-dialog__close"
            onClick={onCancel}
            disabled={deleting}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="st-dialog__body str-confirm__body">
          <p>
            Permanently delete{' '}
            <span className="str-confirm__name">{recordLabelText}</span>?
          </p>
          <p className="str-confirm__warn">
            This action cannot be undone — the {objectSingular.toLowerCase()} and
            its data are removed for good.
          </p>
          {error && (
            <div className="st-banner" role="alert">
              <AlertTriangle className="st-banner__icon" size={15} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="st-dialog__footer">
          <TwentyButton variant="secondary" onClick={onCancel} disabled={deleting}>
            Cancel
          </TwentyButton>
          <button
            type="button"
            className="st-btn str-btn-danger-solid"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? <Loader2 size={14} className="st-spin" /> : null}
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton / error
// ---------------------------------------------------------------------------

function TableSkeleton(): React.JSX.Element {
  return (
    <div className="st-table-wrap" style={{ padding: 'var(--st-space-3)' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="st-skeleton st-skeleton-row" />
      ))}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="st-banner" role="alert">
      <AlertTriangle className="st-banner__icon" size={15} />
      <span>{message}</span>
    </div>
  );
}

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
  const [loadingData, setLoadingData] = React.useState(true);
  const [dataError, setDataError] = React.useState<string | null>(null);

  // Rows currently restoring / deleting (drives the per-row busy dimming).
  const [busy, setBusy] = React.useState<Set<string>>(new Set());

  // Permanent-delete confirm flow: the record pending confirmation, plus the
  // dialog's in-flight + error state.
  const [confirmRecord, setConfirmRecord] =
    React.useState<SabcrmRustRecord | null>(null);
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
    (async () => {
      const res = await listSabcrmTrashTw(objectSlug, activeProjectId ?? undefined);
      if (cancelled) return;
      if (!res.ok) {
        setDataError(res.error);
        setRecords([]);
      } else {
        setRecords(res.data);
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

  // ---- Restore -----------------------------------------------------------
  const handleRestore = React.useCallback(
    async (recordId: string) => {
      if (busy.has(recordId)) return;
      setBusy((b) => new Set(b).add(recordId));
      setDataError(null);

      const res = await restoreSabcrmRecordTw(objectSlug, recordId);

      if (!res.ok) {
        setDataError(res.error);
        setBusy((b) => {
          const n = new Set(b);
          n.delete(recordId);
          return n;
        });
        return;
      }
      // Restored → it leaves the trash list.
      setRecords((rs) => rs.filter((r) => r.id !== recordId));
      setBusy((b) => {
        const n = new Set(b);
        n.delete(recordId);
        return n;
      });
    },
    [busy, objectSlug],
  );

  // ---- Permanent delete (confirmed) --------------------------------------
  const handleConfirmDelete = React.useCallback(async () => {
    const target = confirmRecord;
    if (!target || confirmDeleting) return;
    setConfirmDeleting(true);
    setConfirmError(null);

    const res = await permanentDeleteSabcrmRecordTw(objectSlug, target.id);
    setConfirmDeleting(false);

    if (!res.ok) {
      setConfirmError(res.error);
      return;
    }
    setRecords((rs) => rs.filter((r) => r.id !== target.id));
    setConfirmRecord(null);
  }, [confirmRecord, confirmDeleting, objectSlug]);

  const openConfirm = React.useCallback((record: SabcrmRustRecord) => {
    setConfirmError(null);
    setConfirmDeleting(false);
    setConfirmRecord(record);
  }, []);

  const closeConfirm = React.useCallback(() => {
    if (confirmDeleting) return;
    setConfirmRecord(null);
    setConfirmError(null);
  }, [confirmDeleting]);

  // ---- Render -------------------------------------------------------------

  if (loadingObject) {
    return (
      <div className="st-page">
        <div
          className="st-skeleton"
          style={{ height: 28, width: 220, marginBottom: 20 }}
        />
        <TableSkeleton />
      </div>
    );
  }

  if (objectError && !object) {
    return (
      <div className="st-page">
        <Link href="/sabcrm" className="st-back">
          <ArrowLeft size={14} />
          SabCRM
        </Link>
        <ErrorBanner message={objectError} />
      </div>
    );
  }

  if (!object) {
    return (
      <div className="st-page">
        <Link href="/sabcrm" className="st-back">
          <ArrowLeft size={14} />
          SabCRM
        </Link>
        <div className="st-empty">
          <span className="st-empty__icon">
            <Trash2 size={20} />
          </span>
          <h2 className="st-empty__title">Object not found</h2>
          <p className="st-empty__desc">
            No CRM object matches “{objectSlug}”. It may have been removed or you
            may not have access.
          </p>
          <TwentyButton variant="secondary">
            <Link
              href="/sabcrm"
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              Back to SabCRM
            </Link>
          </TwentyButton>
        </div>
      </div>
    );
  }

  const colSpan = previewFields.length + 3; // label + previews + deleted-at + actions

  return (
    <div className="st-page">
      <Link href={`/sabcrm/${object.slug}`} className="st-back">
        <ArrowLeft size={14} />
        {object.labelPlural}
      </Link>

      <TwentyPageHeader title={`Trash — ${object.labelPlural}`} icon={Trash2} />

      <p className="str-sub">
        Soft-deleted {object.labelPlural.toLowerCase()} — restore them or remove
        them permanently.
      </p>

      {dataError && <ErrorBanner message={dataError} />}

      {loadingData ? (
        <TableSkeleton />
      ) : records.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty__icon">
            <Trash2 size={20} />
          </span>
          <h2 className="st-empty__title">Trash is empty</h2>
          <p className="st-empty__desc">
            No deleted {object.labelPlural.toLowerCase()} to restore.
          </p>
          <TwentyButton variant="secondary">
            <Link
              href={`/sabcrm/${object.slug}`}
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              Back to {object.labelPlural}
            </Link>
          </TwentyButton>
        </div>
      ) : (
        <div className="st-table-wrap">
          <table className="st-table">
            <thead>
              <tr>
                <th>{object.labelSingular}</th>
                {previewFields.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                <th>Deleted</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const isBusy = busy.has(record.id);
                const label = recordLabel(object, record);
                return (
                  <tr
                    key={record.id}
                    className={`st-row${isBusy ? ' str-row--busy' : ''}`}
                  >
                    <td>
                      <span className="str-label">{label}</span>
                    </td>
                    {previewFields.map((f) => (
                      <td key={f.key}>
                        <TwentyFieldValue field={f} value={record.data[f.key]} />
                      </td>
                    ))}
                    <td>
                      <span className="str-time">
                        {fmtTime(deletedAtOf(record))}
                      </span>
                    </td>
                    <td className="str-actions__cell">
                      <span className="str-actions">
                        <TwentyButton
                          variant="secondary"
                          icon={isBusy ? undefined : RotateCcw}
                          disabled={isBusy}
                          onClick={() => handleRestore(record.id)}
                        >
                          {isBusy ? (
                            <Loader2 size={14} className="st-spin" />
                          ) : null}
                          Restore
                        </TwentyButton>
                        <button
                          type="button"
                          className="st-btn st-btn--secondary str-btn-danger"
                          disabled={isBusy}
                          onClick={() => openConfirm(record)}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                          Delete permanently
                        </button>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="st-row">
                <td colSpan={colSpan}>
                  <span className="str-time">
                    {records.length}{' '}
                    {records.length === 1
                      ? object.labelSingular.toLowerCase()
                      : object.labelPlural.toLowerCase()}{' '}
                    in trash
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {confirmRecord && (
        <ConfirmDialog
          recordLabelText={recordLabel(object, confirmRecord)}
          objectSingular={object.labelSingular}
          deleting={confirmDeleting}
          error={confirmError}
          onCancel={closeConfirm}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  );
}
