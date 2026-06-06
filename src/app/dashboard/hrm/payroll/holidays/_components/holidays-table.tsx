'use client';

import {
  Button,
  Checkbox,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/sabcrm/20ui/compat';
import {
  format } from 'date-fns';
import { Eye,
  Pencil,
  Trash2 } from 'lucide-react';

/**
 * <HolidaysTable> — 8-column canonical table for the holidays list
 * (per §1D.1). Columns: select · Date · Name · Type · Recurring ·
 * Applicable locations · Notes · Actions.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import type { CrmHoliday } from '@/lib/definitions';
import type { WithId } from 'mongodb';

export type HolidayRow = WithId<CrmHoliday> & {
  type?: string;
  recurring?: boolean;
  location?: string;
  applicableLocations?: string | string[];
  notes?: string;
};

export function locationsText(h: HolidayRow): string {
  if (Array.isArray(h.applicableLocations)) {
    return h.applicableLocations.filter(Boolean).join(', ');
  }
  if (typeof h.applicableLocations === 'string') return h.applicableLocations;
  if (typeof h.location === 'string') return h.location;
  return '';
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
      <Table>
        <ZoruTableHeader>
          <ZoruTableRow className="hover:bg-transparent">
            <ZoruTableHead className="w-10">
              <Checkbox
                aria-label="Select all rows on this page"
                checked={allSelected}
                onCheckedChange={(v) => onToggleAll(Boolean(v))}
              />
            </ZoruTableHead>
            <ZoruTableHead>Date</ZoruTableHead>
            <ZoruTableHead>Name</ZoruTableHead>
            <ZoruTableHead>Type</ZoruTableHead>
            <ZoruTableHead className="text-center">Recurring</ZoruTableHead>
            <ZoruTableHead>Applicable locations</ZoruTableHead>
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
                  : 'No holidays.'}
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            rows.map((h) => {
              const id = h._id.toString();
              return (
                <ZoruTableRow key={id} className="border-zoru-line">
                  <ZoruTableCell>
                    <Checkbox
                      aria-label={`Select ${h.name}`}
                      checked={selected.has(id)}
                      onCheckedChange={() => onToggleOne(id)}
                    />
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[13px] text-zoru-ink">
                    {fmtDate(h.date)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[13px] text-zoru-ink">
                    <Link
                      href={`/dashboard/hrm/payroll/holidays/${id}`}
                      className="hover:underline"
                    >
                      {h.name}
                    </Link>
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <StatusPill
                      label={(h.type ?? 'national').toString()}
                      tone={statusToTone(h.type ?? 'national')}
                    />
                  </ZoruTableCell>
                  <ZoruTableCell className="text-center">
                    {h.recurring ? (
                      <StatusPill label="Yes" tone="green" />
                    ) : (
                      <StatusPill label="No" tone="neutral" />
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                    {locationsText(h) || '—'}
                  </ZoruTableCell>
                  <ZoruTableCell
                    className="max-w-[220px] truncate text-[13px] text-zoru-ink-muted"
                    title={h.notes ?? ''}
                  >
                    {h.notes ?? '—'}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild>
                        <Link
                          href={`/dashboard/hrm/payroll/holidays/${id}`}
                          aria-label="View"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="icon" asChild>
                        <Link
                          href={`/dashboard/hrm/payroll/holidays/${id}/edit`}
                          aria-label="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-zoru-ink" />
                      </Button>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })
          )}
        </ZoruTableBody>
      </Table>
    </div>
  );
}
