'use client';

/**
 * SabCRM — "Find duplicates" screen (`/sabcrm/[objectSlug]/duplicates`), 20ui.
 *
 * Picks a field to dedupe on (defaults to the object's label field, or an EMAIL
 * field when present) and scans for records that share the same value via
 * `findDuplicateRecordsTw(object, field, projectId?)`. Each returned group — a
 * shared value with a count and ≥2 records — renders as a 20ui card listing
 * the colliding records (label linked to their detail page) plus a "Merge…"
 * link that deep-links the existing merge screen with the group's first two
 * records preselected (`?primary=ID&secondary=ID`).
 *
 * 20ui only (`@/components/sabcrm/20ui` + the record composites' `RecordCell`
 * for field-value rendering) plus the sibling `duplicates.css` for page-local
 * layout (`.scd-*`, scoped to the 20ui root). Every data call is a gated server
 * action returning an `ActionResult`; the Rust engine may be DOWN, so every
 * branch degrades to an inline alert / empty state and the page never crashes.
 */

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Search,
  AlertTriangle,
  Database,
  GitMerge,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  PageActions,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from '@/components/sabcrm/20ui';
import { RecordCell } from '@/components/sabcrm/20ui/composites/record';
import { useProject } from '@/context/project-context';
import {
  listSabcrmObjectsTw,
  findDuplicateRecordsTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type { SabcrmRustRecord } from '@/app/actions/sabcrm-twenty.actions.types';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';
import { sabcrmRecordLabel } from '@/lib/sabcrm/record-label';

import '@/components/sabcrm/20ui/surface-crm-base.css';
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
  return sabcrmRecordLabel(object, record);
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
    <Card variant="outlined" className="scd-group">
      <div className="scd-group__head">
        <span className="scd-group__value">
          <span className="scd-group__field">{field.label}:</span>
          <span className="scd-group__value-text">
            {groupValueLabel(field, group.value)}
          </span>
        </span>
        <Badge tone="accent">
          {group.count} {group.count === 1 ? 'record' : 'records'}
        </Badge>
        <span className="scd-group__spacer" />
        {mergeHref && (
          <Button variant="secondary" size="sm" iconLeft={GitMerge} asChild>
            <Link href={mergeHref}>Merge…</Link>
          </Button>
        )}
      </div>

      <div className="scd-records">
        {group.records.map((record) => (
          <div className="scd-record" key={record.id}>
            <Link
              href={`/sabcrm/${object.slug}/${record.id}`}
              className="scd-record__link"
            >
              {recordLabel(object, record)}
            </Link>
            <span className="scd-record__spacer" />
            <span className="scd-record__meta">
              <RecordCell field={field} value={record.data[field.key]} />
            </span>
            <span className="scd-record__id">{record.id.slice(-6)}</span>
          </div>
        ))}
      </div>
    </Card>
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
      <div className="scd-page">
        <div className="scd-page__inner">
          <div className="scd-skeletons">
            <Skeleton width={240} height={28} radius={6} />
            <Skeleton height={96} radius={10} />
            <Skeleton height={160} radius={10} />
          </div>
        </div>
      </div>
    );
  }

  if (objectError && !object) {
    return (
      <div className="scd-page">
        <div className="scd-page__inner">
          <Alert tone="danger" icon={AlertTriangle}>
            {objectError}
          </Alert>
        </div>
      </div>
    );
  }

  if (!object) {
    return (
      <div className="scd-page">
        <div className="scd-page__inner">
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

  const groups = result?.groups ?? [];
  const headerField = scannedField ?? selectedField;

  return (
    <div className="scd-page">
      <div className="scd-page__inner">
        <PageHeader>
          <PageHeaderHeading>
            <PageTitle>Find duplicates — {object.labelPlural}</PageTitle>
            <PageDescription>
              Records that share the same{' '}
              {selectedField ? selectedField.label.toLowerCase() : 'value'} are
              grouped together. Merge each group to keep one survivor.
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

        {/* Scan controls — pick a field, then scan. */}
        <Card variant="outlined" className="scd-scan">
          <div className="scd-scan__field">
            <Field label="Dedupe on field">
              <Select
                value={fieldKey || undefined}
                onValueChange={setFieldKey}
                disabled={scanning || fields.length === 0}
              >
                <SelectTrigger aria-label="Dedupe on field">
                  <SelectValue
                    placeholder={
                      fields.length === 0
                        ? 'No dedupable fields'
                        : 'Select field'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Button
            variant="primary"
            iconLeft={Search}
            loading={scanning}
            disabled={scanning || !selectedField}
            onClick={handleScan}
          >
            {scanning ? 'Scanning…' : 'Scan'}
          </Button>
        </Card>

        {scanError && (
          <Alert tone="danger" icon={AlertTriangle}>
            {scanError}
          </Alert>
        )}

        {/* Results — empty until the first scan. */}
        {scanning && !result && (
          <div className="scd-skeletons">
            <Skeleton height={88} radius={10} />
            <Skeleton height={88} radius={10} />
          </div>
        )}

        {!scanning && result && groups.length === 0 && (
          <EmptyState
            icon={CheckCircle2}
            tone="success"
            title="No duplicates found"
            description={`No two ${object.labelPlural.toLowerCase()} share the same ${
              (scannedField ?? selectedField)?.label.toLowerCase() ?? 'value'
            }. Try scanning on a different field.`}
          />
        )}

        {result && groups.length > 0 && headerField && (
          <>
            <div className="scd-summary">
              <span className="scd-summary__count">{groups.length}</span>
              duplicate {groups.length === 1 ? 'group' : 'groups'} on{' '}
              {headerField.label.toLowerCase()}
            </div>
            <div className="scd-groups">
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
    </div>
  );
}
