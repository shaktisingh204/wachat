'use client';

/**
 * SabCRM — Twenty-faithful "Find duplicates" screen
 * (`/sabcrm/[objectSlug]/duplicates`).
 *
 * Picks a field to dedupe on (defaults to the object's label field, or an EMAIL
 * field when present) and scans for records that share the same value via
 * `findDuplicateRecordsTw(object, field, projectId?)`. Each returned group — a
 * shared value with a count and ≥2 records — renders as a Twenty card listing
 * the colliding records (label linked to their detail page) plus a "Merge…"
 * link that deep-links the existing merge screen with the group's first two
 * records preselected (`?primary=ID&secondary=ID`).
 *
 * NO ZoruUI / Tailwind / clay — Twenty look only (`.st-*` from the kit plus the
 * sibling `duplicates.css`, which holds only NEW `.st-dup-*` classes; the shared
 * `sabcrm-twenty.css` is never edited). Every data call is a gated server action
 * returning an `ActionResult`; the Rust engine may be DOWN, so every branch
 * degrades to an inline banner / empty state and the page never crashes.
 */

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Search,
  AlertTriangle,
  Database,
  Loader2,
  GitMerge,
  CopyCheck,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

import { TwentyPageHeader, TwentyButton } from '@/components/sabcrm/twenty';
import { TwentyFieldValue } from '@/components/sabcrm/twenty/twenty-field';
import { useProject } from '@/context/project-context';
import {
  listSabcrmObjectsTw,
  findDuplicateRecordsTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type { SabcrmRustRecord } from '@/app/actions/sabcrm-twenty.actions.types';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';

import './duplicates.css';

// ---------------------------------------------------------------------------
// Types — the shape `findDuplicateRecordsTw` resolves to (added in parallel).
// ---------------------------------------------------------------------------

/** One bucket of records that collide on the scanned field's value. */
interface DuplicateGroup {
  /** The shared value the records collide on. */
  value: unknown;
  /** How many records share `value` (always ≥ 2 for a real duplicate). */
  count: number;
  /** The colliding records themselves. */
  records: SabcrmRustRecord[];
}

/** Result envelope of `findDuplicateRecordsTw`. */
interface DuplicateScanResult {
  groups: DuplicateGroup[];
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

/**
 * Field types it makes sense to dedupe on — scalar, comparable values a user
 * would expect collisions for. Relations / files / booleans / multi-selects are
 * excluded (a boolean "duplicate" is meaningless; relations merge structurally).
 */
const DEDUPABLE: ReadonlySet<FieldMetadata['type']> = new Set<
  FieldMetadata['type']
>(['TEXT', 'EMAIL', 'PHONE', 'LINK', 'NUMBER', 'SELECT']);

/** Fields the user may scan for duplicates on (system fields excluded). */
function dedupableFields(object: ObjectMetadata): FieldMetadata[] {
  return object.fields.filter((f) => !f.system && DEDUPABLE.has(f.type));
}

/**
 * The default field to dedupe on: prefer an EMAIL field (the canonical dedupe
 * key), then the object's label field, then the first dedupable field.
 */
function defaultDedupeField(
  object: ObjectMetadata,
  fields: FieldMetadata[],
): string {
  const email = fields.find((f) => f.type === 'EMAIL');
  if (email) return email.key;
  const label = fields.find((f) => f.isLabel);
  if (label) return label.key;
  return fields[0]?.key ?? '';
}

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

/** A readable rendering of the group's shared value (for the group header). */
function groupValueLabel(field: FieldMetadata, value: unknown): string {
  if (value === null || value === undefined || value === '') return '(empty)';
  if (field.type === 'SELECT') {
    const opt = field.options?.find((o) => o.value === String(value));
    if (opt) return opt.label;
  }
  return String(value);
}

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="st-banner" role="alert">
      <AlertTriangle className="st-banner__icon" size={15} />
      <span>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Duplicate group card
// ---------------------------------------------------------------------------

interface GroupCardProps {
  object: ObjectMetadata;
  field: FieldMetadata;
  group: DuplicateGroup;
}

function GroupCard({ object, field, group }: GroupCardProps): React.JSX.Element {
  // Deep-link the existing merge screen with the first two colliding records
  // preselected (it reads `?primary=ID&secondary=ID`). Survivor = first record.
  const primaryId = group.records[0]?.id;
  const secondaryId = group.records[1]?.id;
  const mergeHref =
    primaryId && secondaryId
      ? `/sabcrm/${object.slug}/merge?primary=${encodeURIComponent(
          primaryId,
        )}&secondary=${encodeURIComponent(secondaryId)}`
      : null;

  return (
    <div className="st-dup-group">
      <div className="st-dup-group__head">
        <span className="st-dup-group__value">
          <span className="st-dup-group__field">{field.label}:</span>
          <span className="st-dup-group__value-text">
            {groupValueLabel(field, group.value)}
          </span>
        </span>
        <span className="st-dup-group__badge">
          {group.count} {group.count === 1 ? 'record' : 'records'}
        </span>
        <span className="st-dup-group__spacer" />
        {mergeHref && (
          <Link href={mergeHref} className="st-dup-group__merge">
            <GitMerge size={13} aria-hidden="true" />
            Merge…
          </Link>
        )}
      </div>

      <div className="st-dup-records">
        {group.records.map((record) => (
          <div className="st-dup-record" key={record.id}>
            <Link
              href={`/sabcrm/${object.slug}/${record.id}`}
              className="st-dup-record__link"
            >
              {recordLabel(object, record)}
            </Link>
            <span className="st-dup-record__spacer" />
            <span className="st-dup-record__meta">
              <TwentyFieldValue field={field} value={record.data[field.key]} />
            </span>
            <span className="st-dup-record__id">{record.id.slice(-6)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmDuplicatesPage(): React.JSX.Element {
  const params = useParams<{ objectSlug: string }>();
  const objectSlug = params?.objectSlug ?? '';
  const { activeProjectId } = useProject();

  const [object, setObject] = React.useState<ObjectMetadata | null>(null);
  const [loadingObject, setLoadingObject] = React.useState(true);
  const [objectError, setObjectError] = React.useState<string | null>(null);

  // The field to dedupe on (defaults once the object resolves).
  const [fieldKey, setFieldKey] = React.useState('');

  // Scan lifecycle. `result` is null until the first scan completes; after that
  // an empty `groups` array means "scanned, no duplicates found".
  const [scanning, setScanning] = React.useState(false);
  const [scanError, setScanError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<DuplicateScanResult | null>(null);
  /** The field the visible result was scanned on (so the header labels match). */
  const [scannedField, setScannedField] = React.useState<FieldMetadata | null>(
    null,
  );

  // Reset transient scan state when the object changes.
  React.useEffect(() => {
    setResult(null);
    setScanError(null);
    setScannedField(null);
  }, [objectSlug]);

  // Load object metadata.
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

  const fields = React.useMemo(
    () => (object ? dedupableFields(object) : []),
    [object],
  );

  // Seed the default dedupe field once the object's fields are known.
  React.useEffect(() => {
    if (!object) return;
    setFieldKey((prev) =>
      prev && fields.some((f) => f.key === prev)
        ? prev
        : defaultDedupeField(object, fields),
    );
  }, [object, fields]);

  const selectedField = React.useMemo(
    () => fields.find((f) => f.key === fieldKey) ?? null,
    [fields, fieldKey],
  );

  const handleScan = React.useCallback(async () => {
    if (!object || !selectedField || scanning) return;
    setScanning(true);
    setScanError(null);
    const fieldAtScan = selectedField;
    const res = await findDuplicateRecordsTw(
      objectSlug,
      fieldAtScan.key,
      activeProjectId ?? undefined,
    );
    setScanning(false);
    if (!res.ok) {
      setScanError(res.error);
      setResult(null);
      setScannedField(null);
      return;
    }
    // `findDuplicateRecordsTw` resolves to a bare `SabcrmRecordDuplicateGroup[]`
    // — wrap it in the local `{ groups }` envelope the render reads from.
    setResult({ groups: res.data as DuplicateGroup[] });
    setScannedField(fieldAtScan);
  }, [object, selectedField, scanning, objectSlug, activeProjectId]);

  // ---- Render -------------------------------------------------------------

  if (loadingObject) {
    return (
      <div className="st-page">
        <div
          className="st-skeleton"
          style={{ height: 28, width: 240, marginBottom: 20 }}
        />
        <div className="st-skeleton" style={{ height: 96, marginBottom: 16 }} />
        <div className="st-skeleton" style={{ height: 160 }} />
      </div>
    );
  }

  if (objectError && !object) {
    return (
      <div className="st-page">
        <ErrorBanner message={objectError} />
      </div>
    );
  }

  if (!object) {
    return (
      <div className="st-page">
        <div className="st-empty">
          <span className="st-empty__icon">
            <Database size={20} />
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

  const groups = result?.groups ?? [];
  const headerField = scannedField ?? selectedField;

  return (
    <div className="st-page">
      <TwentyPageHeader
        title={`Find duplicates — ${object.labelPlural}`}
        icon={CopyCheck}
        actions={
          <TwentyButton variant="secondary" icon={ArrowLeft}>
            <Link
              href={`/sabcrm/${object.slug}`}
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              Back to {object.labelPlural.toLowerCase()}
            </Link>
          </TwentyButton>
        }
      />

      {/* Scan controls — pick a field, then scan. */}
      <div className="st-dup-scan">
        <div className="st-dup-scan__field">
          <label className="st-dup-scan__label" htmlFor="st-dup-field">
            Dedupe on field
          </label>
          <select
            id="st-dup-field"
            className="st-select"
            value={fieldKey}
            disabled={scanning || fields.length === 0}
            onChange={(e) => setFieldKey(e.target.value)}
          >
            {fields.length === 0 ? (
              <option value="">No dedupable fields</option>
            ) : (
              fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))
            )}
          </select>
        </div>

        <button
          type="button"
          className="st-btn st-btn--primary"
          disabled={scanning || !selectedField}
          onClick={handleScan}
        >
          {scanning ? (
            <Loader2 size={14} className="st-spin" />
          ) : (
            <Search size={14} />
          )}
          {scanning ? 'Scanning…' : 'Scan'}
        </button>

        <p className="st-dup-scan__hint">
          Records that share the same{' '}
          {selectedField ? selectedField.label.toLowerCase() : 'value'} are
          grouped together. Merge each group to keep one survivor.
        </p>
      </div>

      {scanError && <ErrorBanner message={scanError} />}

      {/* Results — empty until the first scan. */}
      {scanning && !result && (
        <>
          <div
            className="st-skeleton"
            style={{ height: 88, marginBottom: 16 }}
          />
          <div className="st-skeleton" style={{ height: 88 }} />
        </>
      )}

      {!scanning && result && groups.length === 0 && (
        <div className="st-empty">
          <span className="st-empty__icon">
            <CheckCircle2 size={20} />
          </span>
          <h2 className="st-empty__title">No duplicates found</h2>
          <p className="st-empty__desc">
            No two {object.labelPlural.toLowerCase()} share the same{' '}
            {(scannedField ?? selectedField)?.label.toLowerCase() ?? 'value'}.
            Try scanning on a different field.
          </p>
        </div>
      )}

      {result && groups.length > 0 && headerField && (
        <>
          <div className="st-dup-summary">
            <span className="st-dup-summary__count">{groups.length}</span>
            duplicate {groups.length === 1 ? 'group' : 'groups'} on{' '}
            {headerField.label.toLowerCase()}
          </div>
          <div className="st-dup-groups">
            {groups.map((group, i) => (
              <GroupCard
                key={`${String(group.value)}-${i}`}
                object={object}
                field={headerField}
                group={group}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
