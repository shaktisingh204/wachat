'use client';

export const dynamic = 'force-dynamic';

/**
 * SabCRM — Map view (`/sabcrm/map`), Twenty-faithful.
 *
 * A dependency-free "locations" browser. Records that carry a location-bearing
 * field — an ADDRESS composite, or a plain city / country TEXT field — are
 * bucketed CLIENT-side by their place and presented as a two-pane explorer:
 *
 *   - A LEFT rail listing every distinct place with a record count (Twenty's
 *     grouped-rail pattern), sorted most-populated first.
 *   - A RIGHT panel listing the records at the selected place, each as a chip
 *     linking to `/sabcrm/{object}/{id}` with its full address underneath.
 *
 * There are NO real map tiles — a structured location browser is the
 * dependency-free equivalent of Twenty's Map view, with a purely decorative
 * SVG "region" header (`.map-hero`) standing in for the canvas. The view is
 * rendered entirely in Twenty's visual language: the shared `.st-*` vocabulary
 * from `src/styles/sabcrm-twenty.css` (NOT edited) plus the sibling `./map.css`
 * extras and the `@/components/sabcrm/twenty` kit. No Ui20 / Tailwind / clay.
 *
 * Controls:
 *   - Object selector — only objects that declare at least one location field
 *     (ADDRESS, or a TEXT field that looks like city / country) qualify.
 *   - Location-field selector — that object's location fields; the place axis.
 *
 * Records are fetched SERVER-SIDE per (object, location field): we query
 * `listSabcrmRecordsTw` with a `<field> isNotEmpty` filter so only records that
 * actually carry a location cross the wire, paging until every match is loaded
 * (no 200-record client cap — large datasets render). Those records are then
 * bucketed client-side by place, so selecting a place stays instant.
 *
 * Every data call is a gated server action returning an `ActionResult`. The
 * Rust engine may be DOWN, so failures degrade to inline banners / empty
 * states — the page never crashes.
 */

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Database, MapPin, Globe2 } from 'lucide-react';

import {
  TwentyPageHeader,
  TwentyChip,
  TwentyAvatar,
} from '@/components/sabcrm/twenty';
import { Select, SearchInput, Alert } from '@/components/sabcrm/20ui';
import { useProject } from '@/context/project-context';
import {
  listSabcrmObjectsTw,
  listSabcrmRecordsTw,
} from '@/app/actions/sabcrm-twenty.actions';
import type {
  SabcrmRustRecord,
  SabcrmRecordFilters,
} from '@/app/actions/sabcrm-twenty.actions.types';
import type { ObjectMetadata, FieldMetadata } from '@/lib/sabcrm/types';
import { sabcrmRecordLabel } from '@/lib/sabcrm/record-label';

import '@/components/sabcrm/20ui/surface-crm-base.css';
import './map.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Per-request page size when paging the server for located records. */
const PAGE_SIZE = 200;

/**
 * Safety cap on how many located records we'll page in for one (object, field)
 * pair, so a pathological dataset can't loop forever. Surfaced in the footer
 * when hit.
 */
const MAX_RECORDS = 5000;

/** Sentinel bucket key for records whose location field is empty / unparseable. */
const UNKNOWN_KEY = '__unknown__';
const UNKNOWN_LABEL = 'Unknown location';

/**
 * A plain TEXT field qualifies as a "location" field when its key or label
 * looks geographic. ADDRESS fields always qualify regardless of name.
 */
const LOCATION_NAME_RE =
  /\b(address|city|town|country|region|state|province|location|place|locality)\b/i;

// ---------------------------------------------------------------------------
// Location helpers (dependency-free)
// ---------------------------------------------------------------------------

/** Narrow an unknown value to a plain object map (composite ADDRESS payloads). */
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** First non-empty string among the candidates, trimmed. */
function firstString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number') return String(v);
  }
  return '';
}

/**
 * Does this field carry a place we can bucket by? ADDRESS always does; a TEXT
 * field qualifies when its key/label reads geographic (city, country, …).
 */
function isLocationField(field: FieldMetadata): boolean {
  if (field.type === 'ADDRESS') return true;
  if (field.type === 'TEXT') {
    return LOCATION_NAME_RE.test(field.key) || LOCATION_NAME_RE.test(field.label);
  }
  return false;
}

/** The full, human-readable address lines for a value (ADDRESS or plain text). */
function addressLines(value: unknown): string[] {
  const rec = asRecord(value);
  if (!rec) {
    const s = firstString(value);
    return s ? [s] : [];
  }
  const street = firstString(rec.street, rec.addressStreet1, rec.street1);
  const street2 = firstString(rec.addressStreet2, rec.street2);
  const city = firstString(rec.city, rec.addressCity);
  const state = firstString(rec.state, rec.addressState, rec.province);
  const postcode = firstString(rec.postcode, rec.addressPostcode, rec.zip);
  const country = firstString(rec.country, rec.addressCountry);
  const cityLine = [city, state, postcode].filter(Boolean).join(', ');
  return [street, street2, cityLine, country].filter(Boolean);
}

/**
 * The place key a record buckets into for the chosen field. We prefer the most
 * specific human-meaningful grouping that's still shared across records:
 *   - ADDRESS → "City, Country" (falling back to whichever part exists), so
 *     records in the same city land together.
 *   - plain TEXT → the trimmed value itself.
 * Returns `''` when there's nothing to bucket on (→ the Unknown bucket).
 */
function placeKey(value: unknown): string {
  const rec = asRecord(value);
  if (!rec) return firstString(value);
  const city = firstString(rec.city, rec.addressCity);
  const country = firstString(rec.country, rec.addressCountry);
  const state = firstString(rec.state, rec.addressState, rec.province);
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (state && country) return `${state}, ${country}`;
  if (country) return country;
  // Last resort: the whole address collapsed to one line.
  return addressLines(value).join(', ');
}

/** The label-field value (best-effort) for a record, used as the chip text. */
function recordLabel(object: ObjectMetadata, record: SabcrmRustRecord): string {
  return sabcrmRecordLabel(object, record);
}

/**
 * Page the server for EVERY record of `object` whose `fieldKey` is non-empty,
 * up to {@link MAX_RECORDS}. The engine applies the `isNotEmpty` predicate so
 * location-less records never cross the wire. Pages are 1-based to match the
 * engine's `page` semantics. Resolves to the full set or the first error.
 */
async function fetchAllLocated(
  object: string,
  fieldKey: string,
  projectId: string | undefined,
): Promise<
  | { ok: true; records: SabcrmRustRecord[]; capped: boolean }
  | { ok: false; error: string }
> {
  const filters: SabcrmRecordFilters = {
    op: 'and',
    conditions: [{ field: fieldKey, operator: 'isNotEmpty' }],
  };
  const acc: SabcrmRustRecord[] = [];
  let page = 1;
  let total = 0;
  for (;;) {
    const res = await listSabcrmRecordsTw(
      object,
      { filters, page, limit: PAGE_SIZE },
      projectId,
    );
    if (!res.ok) return { ok: false, error: res.error };
    total = res.data.total;
    acc.push(...res.data.records);
    const more = res.data.records.length === PAGE_SIZE && acc.length < total;
    if (!more || acc.length >= MAX_RECORDS) {
      return { ok: true, records: acc, capped: acc.length < total };
    }
    page += 1;
  }
}

// ---------------------------------------------------------------------------
// Derived types
// ---------------------------------------------------------------------------

/** One distinct place bucket, with the records that resolved to it. */
interface PlaceBucket {
  /** Stable bucket key (the place label, or {@link UNKNOWN_KEY}). */
  key: string;
  /** Human label shown in the rail + detail header. */
  label: string;
  records: SabcrmRustRecord[];
}

// ---------------------------------------------------------------------------
// Shared states
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return (
    <Alert tone="danger" icon={AlertTriangle}>
      {message}
    </Alert>
  );
}

/** Decorative SVG "region" header — stands in for a map canvas, no tiles. */
function RegionHero({
  fieldLabel,
  placeCount,
}: {
  fieldLabel: string;
  placeCount: number;
}) {
  return (
    <div className="map-hero">
      <svg
        className="map-hero__svg"
        viewBox="0 0 800 132"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {/* Faint lat/long grid. */}
        <g stroke="var(--st-border-light)" strokeWidth="1">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <line key={`v${i}`} x1={i * 100} y1="0" x2={i * 100} y2="132" />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <line key={`h${i}`} x1="0" y1={i * 44} x2="800" y2={i * 44} />
          ))}
        </g>
        {/* Abstract land masses (purely decorative blobs). */}
        <g fill="var(--st-border)" opacity="0.55">
          <path d="M70 90 q40 -50 110 -28 q60 18 30 50 q-30 30 -90 20 q-70 -12 -50 -42 Z" />
          <path d="M340 40 q70 -22 120 8 q40 26 -4 50 q-60 28 -120 6 q-44 -20 4 -64 Z" />
          <path d="M600 96 q30 -44 96 -30 q66 16 40 52 q-30 26 -90 18 q-66 -10 -46 -40 Z" />
        </g>
        {/* Pin glyphs scattered across the regions. */}
        <g fill="var(--st-accent)" opacity="0.85">
          {[
            [140, 70],
            [410, 56],
            [665, 78],
            [250, 92],
            [520, 44],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="3.5" />
          ))}
        </g>
      </svg>
      <div className="map-hero__caption">
        <Globe2 size={15} aria-hidden="true" />
        {placeCount} {placeCount === 1 ? 'place' : 'places'}
        <span className="map-hero__caption-sub">grouped by {fieldLabel}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function SabcrmMapPage(): React.JSX.Element {
  const { activeProjectId } = useProject();

  // Object catalogue (filtered to those with a location field).
  const [objects, setObjects] = React.useState<ObjectMetadata[]>([]);
  const [loadingObjects, setLoadingObjects] = React.useState(true);
  const [objectError, setObjectError] = React.useState<string | null>(null);

  // Active selections.
  const [objectSlug, setObjectSlug] = React.useState<string>('');
  const [locationFieldKey, setLocationFieldKey] = React.useState<string>('');
  const [activePlace, setActivePlace] = React.useState<string | null>(null);
  // Free-text filter over the places rail (Twenty's grouped rail is searchable).
  const [placeQuery, setPlaceQuery] = React.useState('');

  // Located records for the active object + location field (server-filtered).
  const [records, setRecords] = React.useState<SabcrmRustRecord[]>([]);
  const [loadingData, setLoadingData] = React.useState(false);
  const [dataError, setDataError] = React.useState<string | null>(null);
  // True when more located records exist than we paged in (cap hit).
  const [recordsCapped, setRecordsCapped] = React.useState(false);

  // ---- Load objects -------------------------------------------------------
  React.useEffect(() => {
    let cancelled = false;
    setLoadingObjects(true);
    setObjectError(null);
    (async () => {
      const res = await listSabcrmObjectsTw(activeProjectId ?? undefined);
      if (cancelled) return;
      if (!res.ok) {
        setObjectError(res.error);
        setObjects([]);
      } else {
        // Only objects with at least one location field can be mapped.
        const eligible = res.data.filter((o) => o.fields.some(isLocationField));
        setObjects(eligible);
      }
      setLoadingObjects(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const activeObject = React.useMemo(
    () => objects.find((o) => o.slug === objectSlug) ?? null,
    [objects, objectSlug],
  );

  const locationFields = React.useMemo<FieldMetadata[]>(
    () => (activeObject ? activeObject.fields.filter(isLocationField) : []),
    [activeObject],
  );

  const locationField = React.useMemo<FieldMetadata | undefined>(
    () => locationFields.find((f) => f.key === locationFieldKey),
    [locationFields, locationFieldKey],
  );

  // Default the object once eligible objects arrive.
  React.useEffect(() => {
    if (!objectSlug && objects.length > 0) {
      setObjectSlug(objects[0].slug);
    }
  }, [objects, objectSlug]);

  // Whenever the object changes, default the location field to its first one.
  React.useEffect(() => {
    if (locationFields.length === 0) {
      setLocationFieldKey('');
      return;
    }
    if (!locationFields.some((f) => f.key === locationFieldKey)) {
      setLocationFieldKey(locationFields[0].key);
    }
  }, [locationFields, locationFieldKey]);

  // Active place selection + rail search must not leak across object / field
  // changes.
  React.useEffect(() => {
    setActivePlace(null);
    setPlaceQuery('');
  }, [objectSlug, locationFieldKey]);

  // ---- Load located records for the active object + field (server-side) ----
  // The engine applies an `isNotEmpty` filter on the chosen location field, so
  // only records that carry a place cross the wire; we page until exhausted.
  React.useEffect(() => {
    if (!objectSlug || !locationFieldKey) {
      setRecords([]);
      setRecordsCapped(false);
      return;
    }
    let cancelled = false;
    setLoadingData(true);
    setDataError(null);
    (async () => {
      const res = await fetchAllLocated(
        objectSlug,
        locationFieldKey,
        activeProjectId ?? undefined,
      );
      if (cancelled) return;
      if (!res.ok) {
        setDataError(res.error);
        setRecords([]);
        setRecordsCapped(false);
      } else {
        setRecords(res.records);
        setRecordsCapped(res.capped);
      }
      setLoadingData(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [objectSlug, locationFieldKey, activeProjectId]);

  // ---- Bucket records by place (client-side) -----------------------------
  // Most-populated places first; the Unknown bucket is always pinned last so it
  // never crowds out real locations.
  const buckets = React.useMemo<PlaceBucket[]>(() => {
    if (!locationFieldKey) return [];
    const map = new Map<string, PlaceBucket>();
    for (const rec of records) {
      const raw = rec.data[locationFieldKey];
      const place = placeKey(raw);
      const key = place || UNKNOWN_KEY;
      const label = place || UNKNOWN_LABEL;
      const existing = map.get(key);
      if (existing) existing.records.push(rec);
      else map.set(key, { key, label, records: [rec] });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.key === UNKNOWN_KEY) return 1;
      if (b.key === UNKNOWN_KEY) return -1;
      if (b.records.length !== a.records.length) {
        return b.records.length - a.records.length;
      }
      return a.label.localeCompare(b.label);
    });
  }, [records, locationFieldKey]);

  // The rail-visible subset (search-filtered by place label).
  const visibleBuckets = React.useMemo<PlaceBucket[]>(() => {
    const q = placeQuery.trim().toLowerCase();
    if (!q) return buckets;
    return buckets.filter((b) => b.label.toLowerCase().includes(q));
  }, [buckets, placeQuery]);

  // Default the selected place to the most-populated one once buckets exist.
  React.useEffect(() => {
    if (buckets.length === 0) {
      if (activePlace !== null) setActivePlace(null);
      return;
    }
    if (!buckets.some((b) => b.key === activePlace)) {
      setActivePlace(buckets[0].key);
    }
  }, [buckets, activePlace]);

  const selectedBucket = React.useMemo(
    () => buckets.find((b) => b.key === activePlace) ?? null,
    [buckets, activePlace],
  );

  const placedCount = React.useMemo(
    () =>
      buckets.reduce(
        (sum, b) => (b.key === UNKNOWN_KEY ? sum : sum + b.records.length),
        0,
      ),
    [buckets],
  );
  const distinctPlaces = React.useMemo(
    () => buckets.filter((b) => b.key !== UNKNOWN_KEY).length,
    [buckets],
  );

  // ---- Render -------------------------------------------------------------

  return (
    <div className="st-page">
      <TwentyPageHeader title="Map" />

      <div className="map-controls">
        <div className="map-controls__group">
          <span className="map-controls__label">Object</span>
          <Select
            value={objectSlug || null}
            disabled={loadingObjects || objects.length === 0}
            onChange={(value) => setObjectSlug(value ?? '')}
            aria-label="Map object"
            placeholder={objects.length === 0 ? 'No objects' : 'Select object'}
            options={objects.map((o) => ({
              value: o.slug,
              label: o.labelPlural,
            }))}
          />
        </div>

        <div className="map-controls__group">
          <span className="map-controls__label">By location</span>
          <Select
            value={locationFieldKey || null}
            disabled={locationFields.length === 0}
            onChange={(value) => setLocationFieldKey(value ?? '')}
            aria-label="Map location field"
            placeholder={
              locationFields.length === 0
                ? 'No location field'
                : 'Select field'
            }
            options={locationFields.map((f) => ({
              value: f.key,
              label: f.label,
            }))}
          />
        </div>

        <div className="map-controls__spacer" />

        {!loadingData && activeObject && locationField && (
          <span className="map-controls__count">
            {placedCount} placed · {distinctPlaces}{' '}
            {distinctPlaces === 1 ? 'place' : 'places'}
          </span>
        )}
      </div>

      {objectError && <ErrorBanner message={objectError} />}
      {dataError && <ErrorBanner message={dataError} />}

      {loadingObjects ? (
        <>
          <div
            className="st-skeleton rounded-[var(--st-radius-lg)]"
            style={{ height: 132, marginBottom: 16 }}
          />
          <div className="map-explorer">
            <div className="map-places">
              <div className="map-skeleton-rail">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="st-skeleton" style={{ height: 22 }} />
                ))}
              </div>
            </div>
            <div className="map-detail">
              <div className="map-skeleton-rail">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="st-skeleton" style={{ height: 28 }} />
                ))}
              </div>
            </div>
          </div>
        </>
      ) : objects.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty__icon">
            <MapPin size={20} />
          </span>
          <h2 className="st-empty__title">No mappable objects</h2>
          <p className="st-empty__desc">
            None of your CRM objects has a location field to group records by.
            Add an ADDRESS field — or a City / Country field — to an object to
            use the map.
          </p>
        </div>
      ) : !activeObject || locationFields.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty__icon">
            <Database size={20} />
          </span>
          <h2 className="st-empty__title">Pick an object and location field</h2>
          <p className="st-empty__desc">
            Choose an object with a location field above to browse its places.
          </p>
        </div>
      ) : loadingData ? (
        <div className="map-explorer">
          <div className="map-places">
            <div className="map-skeleton-rail">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="st-skeleton" style={{ height: 22 }} />
              ))}
            </div>
          </div>
          <div className="map-detail">
            <div className="map-skeleton-rail">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="st-skeleton" style={{ height: 28 }} />
              ))}
            </div>
          </div>
        </div>
      ) : buckets.length === 0 ? (
        <div className="st-empty">
          <span className="st-empty__icon">
            <MapPin size={20} />
          </span>
          <h2 className="st-empty__title">
            No {activeObject.labelPlural.toLowerCase()} to place
          </h2>
          <p className="st-empty__desc">
            None of the loaded {activeObject.labelPlural.toLowerCase()} has a
            value in “{locationField?.label}”. Add a location to a record to see
            it on the map.
          </p>
        </div>
      ) : (
        <>
          <RegionHero
            fieldLabel={locationField?.label ?? 'location'}
            placeCount={distinctPlaces}
          />

          <div className="map-explorer">
            {/* Left rail — places. */}
            <div className="map-places">
              <div className="map-places__head">Places</div>
              {buckets.length > 6 && (
                <SearchInput
                  className="map-places__search"
                  inputSize="sm"
                  placeholder="Filter places…"
                  value={placeQuery}
                  onValueChange={setPlaceQuery}
                  aria-label="Filter places"
                />
              )}
              <div className="map-places__list">
                {visibleBuckets.length === 0 && (
                  <div className="map-places__empty">
                    No places match “{placeQuery}”.
                  </div>
                )}
                {visibleBuckets.map((bucket) => {
                  const isActive = bucket.key === activePlace;
                  return (
                    <button
                      key={bucket.key}
                      type="button"
                      className={`map-place${isActive ? ' is-active' : ''}`}
                      aria-pressed={isActive}
                      onClick={() => setActivePlace(bucket.key)}
                    >
                      <span className="map-place__pin" aria-hidden="true">
                        <MapPin size={14} />
                      </span>
                      <span className="map-place__name" title={bucket.label}>
                        {bucket.label}
                      </span>
                      <span className="map-place__count">
                        {bucket.records.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right panel — records at the selected place. */}
            <div className="map-detail">
              {selectedBucket ? (
                <>
                  <div className="map-detail__head">
                    <MapPin size={16} aria-hidden="true" />
                    <span className="map-detail__title">
                      {selectedBucket.label}
                    </span>
                    <span className="map-detail__sub">
                      {selectedBucket.records.length}{' '}
                      {selectedBucket.records.length === 1
                        ? activeObject.labelSingular.toLowerCase()
                        : activeObject.labelPlural.toLowerCase()}
                    </span>
                  </div>
                  <div className="map-detail__body">
                    {selectedBucket.records.map((rec) => {
                      const lines = addressLines(rec.data[locationFieldKey]);
                      const label = recordLabel(activeObject, rec);
                      return (
                        <div className="map-record" key={rec.id}>
                          <div className="map-record__chips">
                            <Link
                              href={`/sabcrm/${activeObject.slug}/${rec.id}`}
                              className="map-record__link"
                            >
                              <TwentyAvatar name={label} size="xs" />
                              <TwentyChip label={label} />
                            </Link>
                          </div>
                          {lines.length > 0 && (
                            <div className="map-record__addr">
                              {lines.join(' · ')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="map-detail__empty">
                  Select a place to see its {activeObject.labelPlural.toLowerCase()}.
                </div>
              )}
            </div>
          </div>

          <p className="map-note">
            Showing {placedCount.toLocaleString()}{' '}
            {activeObject.labelPlural.toLowerCase()} grouped by “
            {locationField?.label}”, loaded server-side.
            {recordsCapped
              ? ` Capped at the first ${MAX_RECORDS.toLocaleString()} located records — some are not shown.`
              : ''}{' '}
            This is a structured location browser — no map tiles, no extra
            dependencies.
          </p>
        </>
      )}
    </div>
  );
}
