'use client';

import { Badge, Checkbox, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Skeleton, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui';
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
import { EntityRowLink } from '@/components/crm/entity-row-link';

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
        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
            <Table>
                <THead>
                    <Tr className="border-[var(--st-border)] hover:bg-transparent">
                        <Th className="w-[36px]">
                            <Checkbox
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
                        </Th>
                        <Th>Code</Th>
                        <Th>Name</Th>
                        <Th>Type</Th>
                        <Th>City</Th>
                        <Th>Manager</Th>
                        <Th className="text-right">Capacity</Th>
                        <Th>Default</Th>
                        <Th>Status</Th>
                        <Th className="text-right">Actions</Th>
                    </Tr>
                </THead>
                <TBody>
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <Tr key={i} className="border-[var(--st-border)]">
                                <Td colSpan={10}>
                                    <Skeleton className="h-10 w-full" />
                                </Td>
                            </Tr>
                        ))
                    ) : rows.length === 0 ? (
                        <Tr className="border-[var(--st-border)]">
                            <Td
                                colSpan={10}
                                className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                            >
                                No warehouses match the current filters.
                            </Td>
                        </Tr>
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
                </TBody>
            </Table>
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
        w.status || (w.archived ? 'archived' : 'active');
    const cap = w.capacityUnits;
    const sqft = w.capacitySqft;

    return (
        <Tr
            className={[
                'border-[var(--st-border)] transition-colors',
                w.archived ? 'opacity-70' : '',
                selected ? 'bg-[var(--st-bg-muted)]/70' : '',
            ].join(' ')}
        >
            <Td>
                <Checkbox
                    aria-label={`Select ${w.name}`}
                    checked={selected}
                    onCheckedChange={() => onToggle(id)}
                />
            </Td>
            <Td className="font-mono text-[12.5px] text-[var(--st-text-secondary)]">
                {w.code || '—'}
            </Td>
            <Td>
                <EntityRowLink
                    href={`/dashboard/crm/inventory/warehouses/${id}`}
                    label={w.name}
                    subtitle={w.code ? `Code ${w.code}` : undefined}
                />
            </Td>
            <Td className="text-[12.5px]">
                <Badge variant="secondary">
                    {warehouseTypeLabel(w.type)}
                </Badge>
            </Td>
            <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                {w.city || '—'}
            </Td>
            <Td className="text-[12.5px]">
                {w.managerId ? (
                    <EntityPickerChip
                        entity="employee"
                        id={String(w.managerId)}
                        fallback={w.managerName || 'Manager'}
                    />
                ) : w.managerName ? (
                    <span className="text-[var(--st-text)]">{w.managerName}</span>
                ) : (
                    <span className="text-[var(--st-text-secondary)]">—</span>
                )}
            </Td>
            <Td className="text-right font-mono text-[12.5px] text-[var(--st-text)]">
                {cap
                    ? `${cap.toLocaleString()} u`
                    : sqft
                      ? `${sqft.toLocaleString()} sqft`
                      : '—'}
            </Td>
            <Td>
                {w.isDefault ? (
                    <Badge variant="info">Default</Badge>
                ) : (
                    <span className="text-[12.5px] text-[var(--st-text-secondary)]">—</span>
                )}
            </Td>
            <Td>
                <StatusPill
                    label={String(statusLabel)}
                    tone={statusToTone(String(statusLabel))}
                />
            </Td>
            <Td className="text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label={`Actions for ${w.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                            <Link href={`/dashboard/crm/inventory/warehouses/${id}`}>
                                View
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                            <Link
                                href={`/dashboard/crm/inventory/warehouses/${id}/edit`}
                            >
                                <Edit className="mr-1.5 h-3.5 w-3.5" />
                                Edit
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            disabled={!!w.isDefault}
                            onClick={() => onSetDefault(id)}
                        >
                            <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
                            Set as default
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onArchive(id)}>
                            <Archive className="mr-1.5 h-3.5 w-3.5" />
                            {w.archived ? 'Restore' : 'Archive'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onDelete(id)}
                            className="text-[var(--st-danger)]"
                        >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </Td>
        </Tr>
    );
}

export default WarehousesTable;
