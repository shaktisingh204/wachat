'use client';

import { Button, Checkbox, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
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
    <div className="overflow-x-auto rounded-[var(--st-radius)] border border-[var(--st-border)]">
      <Table>
        <THead>
          <Tr className="hover:bg-transparent">
            <Th className="w-10">
              <Checkbox
                aria-label="Select all rows on this page"
                checked={allSelected}
                onCheckedChange={(v) => onToggleAll(Boolean(v))}
              />
            </Th>
            <Th>Date</Th>
            <Th>Name</Th>
            <Th>Type</Th>
            <Th className="text-center">Recurring</Th>
            <Th>Applicable locations</Th>
            <Th>Notes</Th>
            <Th className="text-right">Actions</Th>
          </Tr>
        </THead>
        <TBody>
          {rows.length === 0 ? (
            <Tr>
              <Td
                colSpan={8}
                className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
              >
                {hasActiveFilters
                  ? 'No holidays match the current filters.'
                  : 'No holidays.'}
              </Td>
            </Tr>
          ) : (
            rows.map((h) => {
              const id = h._id.toString();
              return (
                <Tr key={id} className="border-[var(--st-border)]">
                  <Td>
                    <Checkbox
                      aria-label={`Select ${h.name}`}
                      checked={selected.has(id)}
                      onCheckedChange={() => onToggleOne(id)}
                    />
                  </Td>
                  <Td className="text-[13px] text-[var(--st-text)]">
                    {fmtDate(h.date)}
                  </Td>
                  <Td className="text-[13px] text-[var(--st-text)]">
                    <Link
                      href={`/dashboard/hrm/payroll/holidays/${id}`}
                      className="hover:underline"
                    >
                      {h.name}
                    </Link>
                  </Td>
                  <Td>
                    <StatusPill
                      label={(h.type ?? 'national').toString()}
                      tone={statusToTone(h.type ?? 'national')}
                    />
                  </Td>
                  <Td className="text-center">
                    {h.recurring ? (
                      <StatusPill label="Yes" tone="green" />
                    ) : (
                      <StatusPill label="No" tone="neutral" />
                    )}
                  </Td>
                  <Td className="text-[13px] text-[var(--st-text-secondary)]">
                    {locationsText(h) || '—'}
                  </Td>
                  <Td
                    className="max-w-[220px] truncate text-[13px] text-[var(--st-text-secondary)]"
                    title={h.notes ?? ''}
                  >
                    {h.notes ?? '—'}
                  </Td>
                  <Td>
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
                        <Trash2 className="h-3.5 w-3.5 text-[var(--st-text)]" />
                      </Button>
                    </div>
                  </Td>
                </Tr>
              );
            })
          )}
        </TBody>
      </Table>
    </div>
  );
}
