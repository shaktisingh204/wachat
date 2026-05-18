'use client';

import {
  ZoruBadge,
  ZoruCheckbox,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  Archive,
  BadgeCheck,
  Edit,
  MoreHorizontal,
  Trash2,
  } from 'lucide-react';

/**
 * `<WarehousesTable>` — 10-col list table for the §1D warehouses page.
 *
 * Extracted from `<WarehousesListClient>` to keep that file under the
 * 600-line per-file cap. Purely presentational: every row event is
 * fired up to the parent.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { EntityPickerChip } from '@/components/crm/entity-picker';

import type { CrmWarehouse } from '@/lib/definitions';
import type { WithId } from 'mongodb';

import { warehouseTypeLabel } from './warehouses-bits';

export interface WarehousesTableProps {
    rows: WithId<CrmWarehouse>[];
    loading: boolean;
    selected: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onArchive: (id: string) => void;
    onDelete: (id: string) => void;
    onSetDefault: (id: string) => void;
}

export function WarehousesTable({
    rows,
    loading,
    selected,
    onToggleOne,
    onToggleAll,
    onArchive,
    onDelete,
    onSetDefault,
}: WarehousesTableProps) {
    const allSelected =
        rows.length > 0 && rows.every((r) => selected.has(String(r._id)));
    const someSelected =
        !allSelected && rows.some((r) => selected.has(String(r._id)));

    return (
        <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
                <ZoruTableHeader>
                    <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                        <ZoruTableHead className="w-[36px]">
                            <ZoruCheckbox
                                aria-label="Select all"
                                checked={
                                    allSelected
                                        ? true
                                        : someSelected
                                          ? 'indeterminate'
                                          : false
                                }
                                onCheckedChange={(c) => onToggleAll(c === true)}
                            />
                        </ZoruTableHead>
                        <ZoruTableHead>Code</ZoruTableHead>
                        <ZoruTableHead>Name</ZoruTableHead>
                        <ZoruTableHead>Type</ZoruTableHead>
                        <ZoruTableHead>City</ZoruTableHead>
                        <ZoruTableHead>Manager</ZoruTableHead>
                        <ZoruTableHead className="text-right">Capacity</ZoruTableHead>
                        <ZoruTableHead>Default</ZoruTableHead>
                        <ZoruTableHead>Status</ZoruTableHead>
                        <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                    </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <ZoruTableRow key={i} className="border-zoru-line">
                                <ZoruTableCell colSpan={10}>
                                    <ZoruSkeleton className="h-10 w-full" />
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ))
                    ) : rows.length === 0 ? (
                        <ZoruTableRow className="border-zoru-line">
                            <ZoruTableCell
                                colSpan={10}
                                className="h-24 text-center text-[13px] text-zoru-ink-muted"
                            >
                                No warehouses match the current filters.
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : (
                        rows.map((w) => (
                            <WarehouseRow
                                key={String(w._id)}
                                w={w}
                                selected={selected.has(String(w._id))}
                                onToggle={onToggleOne}
                                onArchive={onArchive}
                                onDelete={onDelete}
                                onSetDefault={onSetDefault}
                            />
                        ))
                    )}
                </ZoruTableBody>
            </ZoruTable>
        </div>
    );
}

interface RowProps {
    w: WithId<CrmWarehouse>;
    selected: boolean;
    onToggle: (id: string) => void;
    onArchive: (id: string) => void;
    onDelete: (id: string) => void;
    onSetDefault: (id: string) => void;
}

function WarehouseRow({
    w,
    selected,
    onToggle,
    onArchive,
    onDelete,
    onSetDefault,
}: RowProps) {
    const id = String(w._id);
    const statusLabel =
        (w as any).status || ((w as any).archived ? 'archived' : 'active');
    const cap = (w as any).capacityUnits as number | undefined;
    const sqft = (w as any).capacitySqft as number | undefined;

    return (
        <ZoruTableRow
            className={[
                'border-zoru-line transition-colors',
                (w as any).archived ? 'opacity-70' : '',
                selected ? 'bg-zoru-surface-2/70' : '',
            ].join(' ')}
        >
            <ZoruTableCell>
                <ZoruCheckbox
                    aria-label={`Select ${w.name}`}
                    checked={selected}
                    onCheckedChange={() => onToggle(id)}
                />
            </ZoruTableCell>
            <ZoruTableCell className="font-mono text-[12.5px] text-zoru-ink-muted">
                {w.code || '—'}
            </ZoruTableCell>
            <ZoruTableCell>
                <Link
                    href={`/dashboard/crm/inventory/warehouses/${id}`}
                    className="font-medium text-zoru-ink hover:underline"
                >
                    {w.name}
                </Link>
            </ZoruTableCell>
            <ZoruTableCell className="text-[12.5px]">
                <ZoruBadge variant="secondary">
                    {warehouseTypeLabel(w.type)}
                </ZoruBadge>
            </ZoruTableCell>
            <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                {w.city || '—'}
            </ZoruTableCell>
            <ZoruTableCell className="text-[12.5px]">
                {(w as any).managerId ? (
                    <EntityPickerChip
                        entity="employee"
                        id={String((w as any).managerId)}
                        fallback={w.managerName || 'Manager'}
                    />
                ) : w.managerName ? (
                    <span className="text-zoru-ink">{w.managerName}</span>
                ) : (
                    <span className="text-zoru-ink-muted">—</span>
                )}
            </ZoruTableCell>
            <ZoruTableCell className="text-right font-mono text-[12.5px] text-zoru-ink">
                {cap
                    ? `${cap.toLocaleString()} u`
                    : sqft
                      ? `${sqft.toLocaleString()} sqft`
                      : '—'}
            </ZoruTableCell>
            <ZoruTableCell>
                {w.isDefault ? (
                    <ZoruBadge variant="info">Default</ZoruBadge>
                ) : (
                    <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                )}
            </ZoruTableCell>
            <ZoruTableCell>
                <StatusPill
                    label={String(statusLabel)}
                    tone={statusToTone(String(statusLabel))}
                />
            </ZoruTableCell>
            <ZoruTableCell className="text-right">
                <ZoruDropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label={`Actions for ${w.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </button>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent align="end">
                        <ZoruDropdownMenuItem asChild>
                            <Link href={`/dashboard/crm/inventory/warehouses/${id}`}>
                                View
                            </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                            <Link
                                href={`/dashboard/crm/inventory/warehouses/${id}/edit`}
                            >
                                <Edit className="mr-1.5 h-3.5 w-3.5" />
                                Edit
                            </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem
                            disabled={!!w.isDefault}
                            onClick={() => onSetDefault(id)}
                        >
                            <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
                            Set as default
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuSeparator />
                        <ZoruDropdownMenuItem onClick={() => onArchive(id)}>
                            <Archive className="mr-1.5 h-3.5 w-3.5" />
                            {(w as any).archived ? 'Restore' : 'Archive'}
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem
                            onClick={() => onDelete(id)}
                            className="text-zoru-danger"
                        >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Delete
                        </ZoruDropdownMenuItem>
                    </ZoruDropdownMenuContent>
                </ZoruDropdownMenu>
            </ZoruTableCell>
        </ZoruTableRow>
    );
}

export default WarehousesTable;
