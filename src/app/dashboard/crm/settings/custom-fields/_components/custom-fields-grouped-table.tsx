'use client';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/sabcrm/20ui/compat';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  } from 'lucide-react';

/**
 * Grouped-by-group table for the Custom Fields list page. Renders one
 * <Card> per group with select-all + per-row controls (move up /
 * down, edit, delete). Extracted from page.tsx to keep that file
 * under the 600-line budget.
 */

import * as React from 'react';
import Link from 'next/link';

import type {
    WsCustomField,
    WsCustomFieldGroup,
} from '@/lib/worksuite/meta-types';

export type FieldRow = WsCustomField & { _id: string };
export type GroupRow = WsCustomFieldGroup & { _id: string };

export interface CustomFieldsGroupedTableProps {
    groups: GroupRow[];
    fields: FieldRow[];
    selected: Set<string>;
    setSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
    onDelete: (id: string) => void;
    onMove: (groupId: string, fieldId: string, dir: -1 | 1) => void;
    isReorderPending: boolean;
    search: string;
    entityFilter: string;
}

export function CustomFieldsGroupedTable({
    groups,
    fields,
    selected,
    setSelected,
    onDelete,
    onMove,
    isReorderPending,
    search,
    entityFilter,
}: CustomFieldsGroupedTableProps) {
    if (groups.length === 0) {
        return (
            <Card className="p-6">
                <div className="text-center">
                    <p className="text-[13px] text-[var(--st-text-secondary)]">
                        No groups match the active filter.
                    </p>
                </div>
            </Card>
        );
    }
    return (
        <>
            {groups.map((group) => {
                const groupFields = fields
                    .filter((f) => String(f.group_id) === String(group._id))
                    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
                return (
                    <Card key={group._id} className="p-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
                            <div className="flex items-center gap-2">
                                <h2 className="text-[16px] text-[var(--st-text)]">
                                    {group.name}
                                </h2>
                                <Badge variant="default">
                                    {group.belongs_to}
                                </Badge>
                            </div>
                            <Button variant="outline" asChild>
                                <Link
                                    href={`/dashboard/crm/settings/custom-fields/new?group=${group._id}`}
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Add field
                                </Link>
                            </Button>
                        </div>
                        <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                            <Table>
                                <ZoruTableHeader>
                                    <ZoruTableRow className="hover:bg-transparent">
                                        <ZoruTableHead className="w-[40px]">
                                            <Checkbox
                                                checked={
                                                    groupFields.length > 0 &&
                                                    groupFields.every((f) =>
                                                        selected.has(f._id),
                                                    )
                                                }
                                                onCheckedChange={() => {
                                                    setSelected((prev) => {
                                                        const n = new Set(prev);
                                                        const allIn =
                                                            groupFields.every((f) =>
                                                                n.has(f._id),
                                                            );
                                                        if (allIn)
                                                            groupFields.forEach((f) =>
                                                                n.delete(f._id),
                                                            );
                                                        else
                                                            groupFields.forEach((f) =>
                                                                n.add(f._id),
                                                            );
                                                        return n;
                                                    });
                                                }}
                                                aria-label="Select group"
                                            />
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-[var(--st-text-secondary)]">
                                            Label
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-[var(--st-text-secondary)]">
                                            Slug
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-[var(--st-text-secondary)]">
                                            Type
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-[var(--st-text-secondary)]">
                                            Required
                                        </ZoruTableHead>
                                        <ZoruTableHead className="text-[var(--st-text-secondary)]">
                                            In Table
                                        </ZoruTableHead>
                                        <ZoruTableHead className="w-[180px] text-right text-[var(--st-text-secondary)]">
                                            Actions
                                        </ZoruTableHead>
                                    </ZoruTableRow>
                                </ZoruTableHeader>
                                <ZoruTableBody>
                                    {groupFields.length === 0 ? (
                                        <ZoruTableRow>
                                            <ZoruTableCell
                                                colSpan={7}
                                                className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                                            >
                                                {search || entityFilter !== 'all'
                                                    ? 'No fields match your filter.'
                                                    : 'No fields yet.'}
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    ) : (
                                        groupFields.map((field, idx) => (
                                            <ZoruTableRow key={field._id}>
                                                <ZoruTableCell>
                                                    <Checkbox
                                                        checked={selected.has(field._id)}
                                                        onCheckedChange={() =>
                                                            setSelected((prev) => {
                                                                const n = new Set(prev);
                                                                if (n.has(field._id))
                                                                    n.delete(field._id);
                                                                else n.add(field._id);
                                                                return n;
                                                            })
                                                        }
                                                        aria-label="Select row"
                                                    />
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                                                    {field.label}
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-[13px] text-[var(--st-text-secondary)]">
                                                    {field.name}
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <Badge variant="ghost">
                                                        {field.type}
                                                    </Badge>
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <Badge
                                                        variant={
                                                            field.is_required
                                                                ? 'warning'
                                                                : 'ghost'
                                                        }
                                                    >
                                                        {field.is_required ? 'Yes' : 'No'}
                                                    </Badge>
                                                </ZoruTableCell>
                                                <ZoruTableCell>
                                                    <Badge
                                                        variant={
                                                            field.display_in_table
                                                                ? 'success'
                                                                : 'ghost'
                                                        }
                                                    >
                                                        {field.display_in_table
                                                            ? 'Yes'
                                                            : 'No'}
                                                    </Badge>
                                                </ZoruTableCell>
                                                <ZoruTableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={
                                                                idx === 0 || isReorderPending
                                                            }
                                                            onClick={() =>
                                                                onMove(
                                                                    String(group._id),
                                                                    field._id,
                                                                    -1,
                                                                )
                                                            }
                                                            aria-label="Move up"
                                                        >
                                                            <ArrowUp className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            disabled={
                                                                idx ===
                                                                    groupFields.length - 1 ||
                                                                isReorderPending
                                                            }
                                                            onClick={() =>
                                                                onMove(
                                                                    String(group._id),
                                                                    field._id,
                                                                    1,
                                                                )
                                                            }
                                                            aria-label="Move down"
                                                        >
                                                            <ArrowDown className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            asChild
                                                            aria-label="Edit"
                                                        >
                                                            <Link
                                                                href={`/dashboard/crm/settings/custom-fields/new?group=${group._id}&id=${field._id}`}
                                                            >
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </Link>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => onDelete(field._id)}
                                                            aria-label="Delete"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                                                        </Button>
                                                    </div>
                                                </ZoruTableCell>
                                            </ZoruTableRow>
                                        ))
                                    )}
                                </ZoruTableBody>
                            </Table>
                        </div>
                    </Card>
                );
            })}
        </>
    );
}
