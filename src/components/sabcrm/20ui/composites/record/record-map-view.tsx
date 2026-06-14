'use client';

/**
 * RecordMapView — the `map` presentation of a record list (RecordSurface
 * composite, 20ui).
 *
 * DELIBERATELY NOT a slippy map. SabCRM ADDRESS values are postal parts, not
 * geocoded lat/long, and the policy is in-house only (no Google Maps / Mapbox
 * SDK). So this is a lightweight, fully-local "location explorer": records are
 * grouped into location buckets (City, State / City, Country / Country) derived
 * from an ADDRESS field, rendered as a grid of location cards. Like the board +
 * queue + calendar + timeline presentations it does NO fetching: the host
 * passes `records` already filtered + sorted and the object's field metadata.
 * The map picks its ADDRESS field via {@link pickLocationField}; with no
 * address field it renders an empty-state and the host degrades to the table.
 *
 * Pure grouping logic lives in `record-view-buckets.ts` (no DOM, unit-tested);
 * this file is the React shell.
 *
 * Gotchas honoured: 20ui primitives imported RELATIVELY (never the barrel —
 * self-cycle), styling rides `--st-*` tokens (see record-map-view.css).
 */

import * as React from 'react';
import {
  ExternalLink,
  MapPin,
  MapPinOff,
} from 'lucide-react';

import type {
  ObjectMetadata,
  FieldMetadata,
  CrmRecord,
} from '@/lib/sabcrm/types';
import { IconButton } from '../../button';
import { Badge } from '../../badge';
import { Spinner } from '../../loading';
import { EmptyState } from '../../feedback';
import { cn } from '../lib/cn';
import {
  groupByLocation,
  pickLocationField,
  type LocationGroup,
} from './record-view-buckets';

import './record-map-view.css';

/* ------------------------------------------------------------------ types */

export interface RecordMapViewProps {
  /** Drives labels / accessible names. */
  object: ObjectMetadata;
  /** Already filtered+sorted by the host fetch. */
  records: CrmRecord[];
  /** The object's field metadata (the ADDRESS field is picked from here). */
  fields: FieldMetadata[];
  /** Preferred ADDRESS field key; wins when it is an ADDRESS field. */
  preferredLocationKey?: string | null;
  loading?: boolean;
  onOpen: (recordId: string) => void;
  rowLabel?: (record: CrmRecord) => string;
  emptyState?: React.ReactNode;
  /** Rendered when the object has no ADDRESS field. */
  noFieldState?: React.ReactNode;
  className?: string;
}

/** Max record rows a location card shows before collapsing to "+N more". */
const MAX_ROWS = 6;

/** Conventional label keys (mirrors the queue/my-work fallback). */
function fallbackLabel(record: CrmRecord): string {
  for (const key of ['title', 'name', 'label', 'fullName', 'subject', 'email']) {
    const v = record.data[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return 'Untitled record';
}

/* ------------------------------------------------------------ location card */

function LocationCard({
  group,
  labelOf,
  onOpen,
}: {
  group: LocationGroup;
  labelOf: (record: CrmRecord) => string;
  onOpen: (recordId: string) => void;
}): React.JSX.Element {
  const [expanded, setExpanded] = React.useState(false);
  const rows = expanded ? group.records : group.records.slice(0, MAX_ROWS);
  const overflow = group.records.length - rows.length;

  return (
    <section
      className="rmap-card"
      aria-label={`${group.label} (${group.records.length})`}
    >
      <header className="rmap-card__head">
        <MapPin size={14} aria-hidden="true" className="rmap-card__pin" />
        <span className="rmap-card__title" title={group.label}>
          {group.label}
        </span>
        <Badge tone="neutral" className="rmap-card__count">
          {group.records.length}
        </Badge>
      </header>
      <ul className="rmap-card__list">
        {rows.map((record) => {
          const label = labelOf(record);
          return (
            <li className="rmap-item" key={record._id}>
              <button
                type="button"
                className="rmap-item__title"
                title={label}
                onClick={() => onOpen(record._id)}
              >
                {label}
              </button>
              <IconButton
                label={`Open ${label}`}
                icon={ExternalLink}
                size="sm"
                onClick={() => onOpen(record._id)}
              />
            </li>
          );
        })}
      </ul>
      {overflow > 0 || expanded ? (
        <button
          type="button"
          className="rmap-card__toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show fewer' : `+${overflow} more`}
        </button>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------- RecordMapView */

export function RecordMapView({
  object,
  records,
  fields,
  preferredLocationKey,
  loading = false,
  onOpen,
  rowLabel,
  emptyState,
  noFieldState,
  className,
}: RecordMapViewProps): React.JSX.Element {
  const locationField = React.useMemo(
    () => pickLocationField(fields, preferredLocationKey),
    [fields, preferredLocationKey],
  );

  const labelOf = rowLabel ?? fallbackLabel;

  const { groups, noLocation } = React.useMemo(() => {
    if (!locationField) return { groups: [], noLocation: [] };
    return groupByLocation(records, locationField.key);
  }, [records, locationField]);

  if (!locationField) {
    return (
      <div className={cn('rmap', className)}>
        {noFieldState ?? (
          <EmptyState
            icon={MapPinOff}
            title="No address field to map"
            description={`${object.labelPlural} have no address field, so there is nothing to group by location. Switch to the table view.`}
          />
        )}
      </div>
    );
  }

  if (loading && records.length === 0) {
    return (
      <div className={cn('rmap', className)}>
        <div className="rmap-loading">
          <Spinner aria-label={`Loading ${object.labelPlural.toLowerCase()}`} />
        </div>
      </div>
    );
  }

  const noneInScope = records.length === 0;
  const noLocations = groups.length === 0;

  return (
    <div className={cn('rmap', className)}>
      <div className="rmap-head">
        <span className="rmap-head__meta">
          {groups.length}{' '}
          {groups.length === 1 ? 'location' : 'locations'} · by{' '}
          {locationField.label}
        </span>
        {noLocation.length > 0 ? (
          <Badge tone="neutral" className="rmap-head__missing">
            {noLocation.length} without a location
          </Badge>
        ) : null}
      </div>

      {noneInScope && emptyState ? (
        emptyState
      ) : noLocations ? (
        <EmptyState
          size="sm"
          icon={MapPinOff}
          title={`No located ${object.labelPlural.toLowerCase()}`}
          description={`No ${object.labelPlural.toLowerCase()} have a ${locationField.label.toLowerCase()} to group by. They appear once an address is filled in.`}
        />
      ) : (
        <div
          className="rmap-grid"
          aria-label={`${object.labelPlural} grouped by ${locationField.label}`}
        >
          {groups.map((group) => (
            <LocationCard
              key={group.key}
              group={group}
              labelOf={labelOf}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default RecordMapView;
