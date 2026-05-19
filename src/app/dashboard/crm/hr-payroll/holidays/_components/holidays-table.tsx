'use client';

/**
 * Holidays list table — `/dashboard/crm/hr-payroll/holidays`.
 *
 * Renders the filtered set of holidays as a `<ZoruTable>` with bulk-select.
 * Columns (8):
 *   • select          — per-row checkbox
 *   • Name            — `<EntityRowLink>` to the detail page,
 *                       formatted date as the subtitle
 *   • Date            — long-form date
 *   • Type            — `<StatusPill>` (national / regional / religious /
 *                       optional / restricted)
 *   • Recurring       — yes/no pill
 *   • Locations       — count of applicable locations
 *   • Notes           — truncated note snippet
 *   • Actions         — view / edit / delete shortcuts
 *
 * Multi-tenant scoping is enforced upstream — the parent page fetches via
 * `getCrmHolidays()` which scopes to the current `userId`. This component
 * just renders whatever rows it receives.
 */

import * as React from 'react';
import Link from 'next/link';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import type { ObjectId, WithId } from 'mongodb';

import {
  ZoruButton,
  ZoruCheckbox,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { CrmHoliday } from '@/lib/definitions';

/**
 * Row type used by the holidays list page. Extends the canonical
 * `CrmHoliday` document with the optional UI-only fields the page filters
 * on (`type`, `recurring`, `applicableLocations`, `notes`).
 */
export type HolidayRow = WithId<CrmHoliday> & {
  _id: ObjectId | string;
  type?: string;
  recurring?: boolean;
  location?: string;
  applicableLocations?: string | string[];
  notes?: string;
};

/**
 * Flatten the various shapes the legacy `crm_holidays` collection stores
 * for "applicable locations" into a single comma-separated string. The
 * parent page calls this in three places (CSV export, search haystack,
 * location filter), so the surface stays as `(h: HolidayRow) => string`.
 */
export function locationsText(h: HolidayRow): string {
  if (Array.isArray(h.applicableLocations)) {
    return h.applicableLocations.filter(Boolean).join(', ');
  }
  if (typeof h.applicableLocations === 'string') return h.applicableLocations;
  if (typeof h.location === 'string') return h.location;
  return '';
}

function locationsCount(h: HolidayRow): number {
  if (Array.isArray(h.applicableLocations)) {
    return h.applicableLocations.filter(Boolean).length;
  }
  if (typeof h.applicableLocations === 'string') {
    return h.applicableLocations.trim() ? 1 : 0;
  }
  if (typeof h.location === 'string') {
    return h.location.trim() ? 1 : 0;
  }
  return 0;
}

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string | number | Date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const NOTE_SNIPPET_LEN = 80;

function noteSnippet(notes: string | undefined): string {
  if (!notes) return '—';
  const trimmed = notes.trim();
  if (trimmed.length === 0) return '—';
  if (trimmed.length <= NOTE_SNIPPET_LEN) return trimmed;
  return `${trimmed.slice(0, NOTE_SNIPPET_LEN).trimEnd()}…`;
}

interface HolidaysTableProps {
  rows: HolidayRow[];
  selected: Set<string>;
  onToggleOne: (id: string) => void;
  onToggleAll: (all: boolean) => void;
  onDelete: (id: string) => void;
  hasActiveFilters: boolean;
}

export function HolidaysTable({
  rows,
  selected,
  onToggleOne,
  onToggleAll,
  onDelete,
  hasActiveFilters,
}: HolidaysTableProps): React.JSX.Element {
  const allSelected =
    rows.length > 0 &&
    rows.every((h) => selected.has(h._id.toString()));

  return (
    <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow className="hover:bg-transparent">
            <ZoruTableHead className="w-10">
              <ZoruCheckbox
                aria-label="Select all holidays on this page"
                checked={allSelected}
                onCheckedChange={(v) => onToggleAll(Boolean(v))}
              />
            </ZoruTableHead>
            <ZoruTableHead>Name</ZoruTableHead>
            <ZoruTableHead>Date</ZoruTableHead>
            <ZoruTableHead>Type</ZoruTableHead>
            <ZoruTableHead className="text-center">Recurring</ZoruTableHead>
            <ZoruTableHead className="text-right">Locations</ZoruTableHead>
            <ZoruTableHead>Notes</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {rows.length === 0 ? (
            <ZoruTableRow>
              <ZoruTableCell
                colSpan={8}
                className="h-24 text-center text-[13px] text-zoru-ink-muted"
              >
                {hasActiveFilters
                  ? 'No holidays match the current filters.'
                  : 'No holidays yet.'}
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            rows.map((h) => {
              const id = h._id.toString();
              const name = h.name?.trim() || 'Untitled holiday';
              const dateLabel = fmtDate(h.date);
              const type = (h.type ?? 'national').toString();
              const locCount = locationsCount(h);
              return (
                <ZoruTableRow key={id} className="border-zoru-line">
                  <ZoruTableCell>
                    <ZoruCheckbox
                      aria-label={`Select ${name}`}
                      checked={selected.has(id)}
                      onCheckedChange={() => onToggleOne(id)}
                    />
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <EntityRowLink
                      href={`/dashboard/crm/hr-payroll/holidays/${id}`}
                      label={name}
                      subtitle={dateLabel}
                    />
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[13px] text-zoru-ink">
                    {dateLabel}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <StatusPill label={type} tone={statusToTone(type)} />
                  </ZoruTableCell>
                  <ZoruTableCell className="text-center">
                    {h.recurring ? (
                      <StatusPill label="Yes" tone="green" />
                    ) : (
                      <StatusPill label="No" tone="neutral" />
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell
                    className="text-right text-[12.5px] text-zoru-ink-muted"
                    title={locationsText(h) || undefined}
                  >
                    {locCount === 0 ? '—' : locCount}
                  </ZoruTableCell>
                  <ZoruTableCell
                    className="max-w-[220px] truncate text-[12.5px] text-zoru-ink-muted"
                    title={h.notes ?? ''}
                  >
                    {noteSnippet(h.notes)}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <div className="flex justify-end gap-1">
                      <ZoruButton variant="ghost" size="icon" asChild>
                        <Link
                          href={`/dashboard/crm/hr-payroll/holidays/${id}`}
                          aria-label={`View ${name}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </ZoruButton>
                      <ZoruButton variant="ghost" size="icon" asChild>
                        <Link
                          href={`/dashboard/crm/hr-payroll/holidays/${id}/edit`}
                          aria-label={`Edit ${name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </ZoruButton>
                      <ZoruButton
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(id)}
                        aria-label={`Delete ${name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </ZoruButton>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })
          )}
        </ZoruTableBody>
      </ZoruTable>
    </div>
  );
}
