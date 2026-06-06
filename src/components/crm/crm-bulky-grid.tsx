'use client';

import * as React from 'react';
import {
  Table,
  ZoruTableHeader,
  ZoruTableBody,
  ZoruTableRow,
  ZoruTableHead,
  ZoruTableCell,
  Button,
  DropdownMenu,
  ZoruDropdownMenuTrigger,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuCheckboxItem,
  Card,
  Input,
} from '@/components/sabcrm/20ui/compat';
import { Settings2, ArrowUpDown, ChevronDown, Check, X, Edit2 } from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T, isEditing: boolean, updateField: (val: any) => void) => React.ReactNode;
  editRender?: (row: T, value: any, onChange: (val: any) => void) => React.ReactNode;
}

interface CrmBulkyGridProps<T extends { _id: string | any }> {
  columns: ColumnDef<T>[];
  data: T[];
  selectedIds: Set<string>;
  onSelectOne: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  
  // Sorting state
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnKey: string) => void;

  // Density mode: 'comfortable' (48px), 'compact' (36px), 'dense' (28px)
  density?: 'comfortable' | 'compact' | 'dense';

  // Spreadsheet inline-edit settings
  inlineEditRowId?: string | null;
  editBuffer?: Partial<T>;
  onStartInlineEdit?: (row: T) => void;
  onCancelInlineEdit?: () => void;
  onSaveInlineEdit?: (id: string, updatedData: Partial<T>) => Promise<void>;
  onUpdateEditBuffer?: (field: keyof T, value: any) => void;
  isLoading?: boolean;
}

export function CrmBulkyGrid<T extends { _id: string | any }>({
  columns,
  data,
  selectedIds,
  onSelectOne,
  onSelectAll,
  sortColumn,
  sortDirection,
  onSort,
  density = 'comfortable',
  inlineEditRowId,
  editBuffer,
  onStartInlineEdit,
  onCancelInlineEdit,
  onSaveInlineEdit,
  onUpdateEditBuffer,
  isLoading = false,
}: CrmBulkyGridProps<T>) {
  // Column visibility state
  const [visibleColumns, setVisibleColumns] = React.useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    columns.forEach((c) => {
      initial[c.key] = true;
    });
    return initial;
  });

  // Toggle visible columns
  const toggleColumnVisibility = (key: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Row height classes mapping
  const densityClasses = {
    comfortable: 'h-12 py-3 px-4 text-[13px]',
    compact: 'h-9 py-2 px-3 text-[12.5px]',
    dense: 'h-7 py-1 px-2 text-[12px]',
  };

  const handleSave = async (id: string) => {
    if (onSaveInlineEdit && editBuffer) {
      await onSaveInlineEdit(id, editBuffer);
    }
  };

  const activeColumns = columns.filter((col) => visibleColumns[col.key] !== false);

  return (
    <Card className="p-0 border border-zoru-line overflow-hidden bg-zoru-surface">
      {/* Grid Settings Bar */}
      <div className="flex items-center justify-between border-b border-zoru-line px-4 py-2.5 bg-zoru-surface-2/50">
        <span className="text-[12px] font-medium text-zoru-ink-muted">
          Showing {data.length} records
        </span>
        <div className="flex items-center gap-2">
          {/* Column selector */}
          <DropdownMenu>
            <ZoruDropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12.0px]">
                <Settings2 className="h-3.5 w-3.5" />
                Columns
                <ChevronDown className="h-3 w-3 opacity-60" />
              </Button>
            </ZoruDropdownMenuTrigger>
            <ZoruDropdownMenuContent align="end" className="w-[200px]">
              <ZoruDropdownMenuLabel className="text-[11.5px] uppercase tracking-wider text-zoru-ink-muted px-2 py-1">
                Toggle Columns
              </ZoruDropdownMenuLabel>
              <ZoruDropdownMenuSeparator />
              {columns.map((c) => (
                <ZoruDropdownMenuCheckboxItem
                  key={c.key}
                  checked={visibleColumns[c.key]}
                  onCheckedChange={() => toggleColumnVisibility(c.key)}
                  className="text-[12.5px] cursor-pointer"
                >
                  {c.header}
                </ZoruDropdownMenuCheckboxItem>
              ))}
            </ZoruDropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Grid Table */}
      <div className="w-full overflow-x-auto">
        <Table className="min-w-full">
          <ZoruTableHeader className="border-b border-zoru-line bg-zoru-surface-2/30">
            <ZoruTableRow className="hover:bg-transparent">
              <ZoruTableHead className="w-10 px-4 text-center">
                <input
                  type="checkbox"
                  className="rounded border-zoru-line text-zoru-ink focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                  checked={
                    data.length > 0 &&
                    data.every((r) => selectedIds.has(r._id.toString()))
                  }
                  onChange={(e) => onSelectAll(e.target.checked)}
                />
              </ZoruTableHead>
              {activeColumns.map((col) => (
                <ZoruTableHead
                  key={col.key}
                  className="text-zoru-ink-muted font-semibold text-left select-none text-[12px] py-3 px-4"
                >
                  <div
                    className={`flex items-center gap-1.5 ${
                      col.sortable && onSort ? 'cursor-pointer hover:text-zoru-ink' : ''
                    }`}
                    onClick={() => col.sortable && onSort && onSort(col.key)}
                  >
                    {col.header}
                    {col.sortable && (
                      <ArrowUpDown className="h-3 w-3 opacity-60" />
                    )}
                  </div>
                </ZoruTableHead>
              ))}
              <ZoruTableHead className="w-16 px-4" />
            </ZoruTableRow>
          </ZoruTableHeader>

          <ZoruTableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <ZoruTableRow key={idx} className="animate-pulse border-b border-zoru-line">
                  <ZoruTableCell colSpan={activeColumns.length + 2} className="py-4">
                    <div className="h-6 w-full rounded bg-zoru-surface-2" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ))
            ) : data.length > 0 ? (
              data.map((row) => {
                const id = row._id.toString();
                const isEditing = inlineEditRowId === id;

                return (
                  <ZoruTableRow
                    key={id}
                    className={`border-b border-zoru-line transition-colors ${
                      isEditing ? 'bg-zoru-surface-2/40' : 'hover:bg-zoru-surface-2/10'
                    }`}
                  >
                    {/* Selection Checkbox */}
                    <ZoruTableCell className="px-4 text-center">
                      <input
                        type="checkbox"
                        className="rounded border-zoru-line text-zoru-ink focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                        checked={selectedIds.has(id)}
                        onChange={() => onSelectOne(id)}
                        disabled={isEditing}
                      />
                    </ZoruTableCell>

                    {/* Columns Render */}
                    {activeColumns.map((col) => {
                      const cellValue = row[col.key as keyof T];
                      const bufferValue = editBuffer ? editBuffer[col.key as keyof T] : undefined;

                      return (
                        <ZoruTableCell
                          key={col.key}
                          className={`${densityClasses[density]} font-normal`}
                        >
                          {isEditing ? (
                            col.editRender ? (
                              col.editRender(
                                row,
                                bufferValue,
                                (val) => onUpdateEditBuffer && onUpdateEditBuffer(col.key as keyof T, val)
                              )
                            ) : (
                              <Input
                                size="sm"
                                className="h-8 max-w-xs text-[12.5px]"
                                value={String(bufferValue ?? '')}
                                onChange={(e) =>
                                  onUpdateEditBuffer &&
                                  onUpdateEditBuffer(col.key as keyof T, e.target.value)
                                }
                              />
                            )
                          ) : col.render ? (
                            col.render(
                              row,
                              false,
                              (val) => onUpdateEditBuffer && onUpdateEditBuffer(col.key as keyof T, val)
                            )
                          ) : (
                            <span className="text-zoru-ink">{String(cellValue ?? '')}</span>
                          )}
                        </ZoruTableCell>
                      );
                    })}

                    {/* Spreadsheet Inline Edit Trigger Buttons */}
                    <ZoruTableCell className="px-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-zoru-success-ink hover:bg-zoru-success/15"
                            onClick={() => handleSave(id)}
                            aria-label="Save changes"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-zoru-danger-ink hover:bg-zoru-danger/15"
                            onClick={onCancelInlineEdit}
                            aria-label="Cancel editing"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        onStartInlineEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-zoru-surface-2 text-zoru-ink-muted"
                            onClick={() => onStartInlineEdit(row)}
                            aria-label="Edit record inline"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        )
                      )}
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })
            ) : (
              <ZoruTableRow>
                <ZoruTableCell
                  colSpan={activeColumns.length + 2}
                  className="py-12 text-center text-[13px] text-zoru-ink-muted"
                >
                  No records found. Try modifying your search or filter settings.
                </ZoruTableCell>
              </ZoruTableRow>
            )}
          </ZoruTableBody>
        </Table>
      </div>
    </Card>
  );
}
