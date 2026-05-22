'use client';

import {
  Button,
  Card,
  Checkbox,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  Pencil,
  Trash2,
  LoaderCircle } from 'lucide-react';

/**
 * Table portion of <SettingsEntityShell> — extracted to keep the
 * shell under the 600-line budget. Renders the bordered table with
 * select-all + row checkboxes + render-per-column + edit / delete
 * row actions.
 */

import * as React from 'react';

import type { SettingsColumn } from '@/components/crm/settings-entity-shell-field';

export interface SettingsEntityTableProps<T extends { _id: string }> {
    rows: T[];
    columns: SettingsColumn<T>[];
    isLoading: boolean;
    search: string;
    singular: string;
    selected: Set<string>;
    onToggleAll: () => void;
    onToggleOne: (id: string) => void;
    onEdit: (row: T) => void;
    onDelete: (id: string) => void;
    extraRowActions?: (row: T) => React.ReactNode;
}

export function SettingsEntityTable<T extends { _id: string; [k: string]: any }>(
    props: SettingsEntityTableProps<T>,
) {
    const {
        rows,
        columns,
        isLoading,
        search,
        singular,
        selected,
        onToggleAll,
        onToggleOne,
        onEdit,
        onDelete,
        extraRowActions,
    } = props;

    return (
        <Card className="p-0">
            <div className="overflow-x-auto rounded-lg">
                <Table>
                    <ZoruTableHeader>
                        <ZoruTableRow className="hover:bg-transparent">
                            <ZoruTableHead className="w-[40px]">
                                <Checkbox
                                    checked={
                                        rows.length > 0 &&
                                        selected.size === rows.length
                                    }
                                    onCheckedChange={onToggleAll}
                                    aria-label="Select all"
                                />
                            </ZoruTableHead>
                            {columns.map((c) => (
                                <ZoruTableHead key={c.key} className={c.className}>
                                    {c.label}
                                </ZoruTableHead>
                            ))}
                            <ZoruTableHead className="w-[140px] text-right">
                                Actions
                            </ZoruTableHead>
                        </ZoruTableRow>
                    </ZoruTableHeader>
                    <ZoruTableBody>
                        {isLoading && rows.length === 0 ? (
                            <ZoruTableRow>
                                <ZoruTableCell
                                    colSpan={columns.length + 2}
                                    className="h-20 text-center text-[13px] text-zoru-ink-muted"
                                >
                                    <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ) : rows.length === 0 ? (
                            <ZoruTableRow>
                                <ZoruTableCell
                                    colSpan={columns.length + 2}
                                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                                >
                                    {search
                                        ? `No ${singular.toLowerCase()} matched “${search}”.`
                                        : `No ${singular.toLowerCase()} yet — click New to get started.`}
                                </ZoruTableCell>
                            </ZoruTableRow>
                        ) : (
                            rows.map((row) => {
                                const isChecked = selected.has(row._id);
                                return (
                                    <ZoruTableRow key={row._id}>
                                        <ZoruTableCell>
                                            <Checkbox
                                                checked={isChecked}
                                                onCheckedChange={() =>
                                                    onToggleOne(row._id)
                                                }
                                                aria-label="Select row"
                                            />
                                        </ZoruTableCell>
                                        {columns.map((c) => (
                                            <ZoruTableCell
                                                key={c.key}
                                                className="text-[13px] text-zoru-ink"
                                            >
                                                {c.render
                                                    ? (c.render(row) as React.ReactNode)
                                                    : ((row as Record<string, unknown>)[
                                                          c.key
                                                      ] as React.ReactNode) ?? '—'}
                                            </ZoruTableCell>
                                        ))}
                                        <ZoruTableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {extraRowActions?.(row)}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    aria-label="Edit"
                                                    onClick={() => onEdit(row)}
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    aria-label="Delete"
                                                    onClick={() => onDelete(row._id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
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
        </Card>
    );
}
