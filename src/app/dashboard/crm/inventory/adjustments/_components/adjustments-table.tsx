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
  BadgeCheck,
  CircleX,
  Edit,
  MoreHorizontal,
  Trash2,
  } from 'lucide-react';

/**
 * `<AdjustmentsTable>` — 10-col list table for the §1D adjustments page.
 *
 * Extracted from `<AdjustmentsListClient>` to keep that file under the
 * 600-line per-file cap. Purely presentational: every row event is
 * fired up to the parent.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';

import type { CrmStockAdjustment } from '@/lib/definitions';
import type { WithId } from 'mongodb';

function fmtDate(value: unknown): string {
    if (!value) return '—';
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function impactOf(adj: WithId<CrmStockAdjustment>): number {
    const qty = Number(adj.quantity || 0);
    const cost = Number((adj as any).costPerUnit || 0);
    if (!cost) return Math.abs(qty);
    return Math.abs(qty * cost);
}

export interface AdjustmentsTableProps {
    rows: WithId<CrmStockAdjustment>[];
    loading: boolean;
    selected: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (all: boolean) => void;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    onDelete: (id: string) => void;
}

export function AdjustmentsTable({
    rows,
    loading,
    selected,
    onToggleOne,
    onToggleAll,
    onApprove,
    onReject,
    onDelete,
}: AdjustmentsTableProps) {
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
                        <ZoruTableHead>Adj #</ZoruTableHead>
                        <ZoruTableHead>Date</ZoruTableHead>
                        <ZoruTableHead>Warehouse</ZoruTableHead>
                        <ZoruTableHead>Reason</ZoruTableHead>
                        <ZoruTableHead className="text-right">Lines</ZoruTableHead>
                        <ZoruTableHead className="text-right">Impact</ZoruTableHead>
                        <ZoruTableHead>Status</ZoruTableHead>
                        <ZoruTableHead>Approved by</ZoruTableHead>
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
                                No adjustments match the current filters.
                            </ZoruTableCell>
                        </ZoruTableRow>
                    ) : (
                        rows.map((a) => (
                            <AdjustmentRow
                                key={String(a._id)}
                                a={a}
                                selected={selected.has(String(a._id))}
                                onToggle={onToggleOne}
                                onApprove={onApprove}
                                onReject={onReject}
                                onDelete={onDelete}
                            />
                        ))
                    )}
                </ZoruTableBody>
            </ZoruTable>
        </div>
    );
}

interface RowProps {
    a: WithId<CrmStockAdjustment>;
    selected: boolean;
    onToggle: (id: string) => void;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    onDelete: (id: string) => void;
}

function AdjustmentRow({
    a,
    selected,
    onToggle,
    onApprove,
    onReject,
    onDelete,
}: RowProps) {
    const id = String(a._id);
    const status = ((a as any).status as string) || 'pending';
    const linesCount = (a as any).lines?.length ?? 1;
    const impact = impactOf(a);
    const num = (a as any).adjustmentNumber || id.slice(-6);

    return (
        <ZoruTableRow
            className={[
                'border-zoru-line transition-colors',
                selected ? 'bg-zoru-surface-2/70' : '',
            ].join(' ')}
        >
            <ZoruTableCell>
                <ZoruCheckbox
                    aria-label={`Select ${num}`}
                    checked={selected}
                    onCheckedChange={() => onToggle(id)}
                />
            </ZoruTableCell>
            <ZoruTableCell>
                <EntityRowLink
                    href={`/dashboard/crm/inventory/adjustments/${id}`}
                    label={num}
                    subtitle={a.reason ? String(a.reason) : undefined}
                />
            </ZoruTableCell>
            <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                {fmtDate(a.date)}
            </ZoruTableCell>
            <ZoruTableCell className="text-[12.5px]">
                {a.warehouseId ? (
                    <EntityPickerChip
                        entity="warehouse"
                        id={String(a.warehouseId)}
                        fallback={(a as any).warehouseName || 'Warehouse'}
                    />
                ) : (
                    <span className="text-zoru-ink-muted">—</span>
                )}
            </ZoruTableCell>
            <ZoruTableCell className="text-[12.5px]">
                <ZoruBadge variant="secondary">{a.reason}</ZoruBadge>
            </ZoruTableCell>
            <ZoruTableCell className="text-right font-mono text-[12.5px] text-zoru-ink">
                {linesCount}
            </ZoruTableCell>
            <ZoruTableCell
                className={[
                    'text-right font-mono text-[12.5px]',
                    a.quantity > 0
                        ? 'text-emerald-500'
                        : a.quantity < 0
                          ? 'text-rose-500'
                          : 'text-zoru-ink',
                ].join(' ')}
            >
                {impact
                    ? impact.toLocaleString('en-IN', {
                          maximumFractionDigits: 2,
                      })
                    : '—'}
            </ZoruTableCell>
            <ZoruTableCell>
                <StatusPill label={status} tone={statusToTone(status)} />
            </ZoruTableCell>
            <ZoruTableCell className="text-[12.5px]">
                {(a as any).approvedBy ? (
                    <EntityPickerChip
                        entity="user"
                        id={String((a as any).approvedBy)}
                        fallback={(a as any).approvedByName || 'Approver'}
                    />
                ) : (
                    <span className="text-zoru-ink-muted">—</span>
                )}
            </ZoruTableCell>
            <ZoruTableCell className="text-right">
                <ZoruDropdownMenu>
                    <ZoruDropdownMenuTrigger asChild>
                        <button
                            type="button"
                            aria-label={`Actions for ${num}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </button>
                    </ZoruDropdownMenuTrigger>
                    <ZoruDropdownMenuContent align="end">
                        <ZoruDropdownMenuItem asChild>
                            <Link
                                href={`/dashboard/crm/inventory/adjustments/${id}`}
                            >
                                View
                            </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem asChild>
                            <Link
                                href={`/dashboard/crm/inventory/adjustments/${id}/edit`}
                            >
                                <Edit className="mr-1.5 h-3.5 w-3.5" />
                                Edit
                            </Link>
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem
                            disabled={status === 'approved'}
                            onClick={() => onApprove(id)}
                        >
                            <BadgeCheck className="mr-1.5 h-3.5 w-3.5" />
                            Approve
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuItem
                            disabled={status === 'rejected'}
                            onClick={() => onReject(id)}
                        >
                            <CircleX className="mr-1.5 h-3.5 w-3.5" />
                            Reject
                        </ZoruDropdownMenuItem>
                        <ZoruDropdownMenuSeparator />
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

export default AdjustmentsTable;
