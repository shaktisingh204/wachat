import React, { useRef } from 'react';
import { format } from 'date-fns';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Card, Input, Checkbox, Button } from '@/components/sabcrm/20ui/compat';
import { wsToISODate } from '@/lib/worksuite/time-types';

interface HoursGridProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filteredTasks: string[];
  selectedTasks: Set<string>;
  toggleTaskSelection: (id: string) => void;
  toggleSelectAll: () => void;
  canEdit: boolean;
  isSaving: boolean;
  weekDays: Date[];
  groupedTasks: Map<string, Record<string, number>>;
  handleCellBlur: (taskId: string, dateKey: string, raw: string) => void;
  handleAddTask: () => void;
  handleBulkDeleteTasks: () => void;
  columnTotals: number[];
  grandTotal: number;
  status: string;
}

export function HoursGrid({
  searchQuery,
  setSearchQuery,
  filteredTasks,
  selectedTasks,
  toggleTaskSelection,
  toggleSelectAll,
  canEdit,
  isSaving,
  weekDays,
  groupedTasks,
  handleCellBlur,
  handleAddTask,
  handleBulkDeleteTasks,
  columnTotals,
  grandTotal,
  status,
}: HoursGridProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filteredTasks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 5,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0
    ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
    : 0;

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[16px] text-[var(--st-text)]">Hours Grid</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--st-text-secondary)]" />
            <Input
              placeholder="Filter tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[200px] pl-9"
            />
          </div>
          {canEdit && selectedTasks.size > 0 && (
            <Button variant="destructive" onClick={handleBulkDeleteTasks} disabled={isSaving}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected
            </Button>
          )}
          {canEdit && (
            <Button variant="outline" onClick={handleAddTask} disabled={isSaving}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          )}
        </div>
      </div>

      <div ref={parentRef} className="overflow-x-auto overflow-y-auto max-h-[500px] rounded-lg border border-[var(--st-border)]">
        <table className="w-full min-w-[900px] text-[13px] border-collapse relative">
          <thead className="sticky top-0 z-10 bg-[var(--st-bg-muted)] shadow-sm">
            <tr className="border-b border-[var(--st-border)]">
              <th className="px-3 py-2 text-center w-[40px]">
                <Checkbox
                  checked={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0}
                  onCheckedChange={toggleSelectAll}
                  disabled={!canEdit}
                />
              </th>
              <th className="px-3 py-2 text-left text-[12px] font-medium text-[var(--st-text-secondary)] min-w-[200px]">
                Task / Description
              </th>
              {weekDays.map((d) => (
                <th
                  key={d.toISOString()}
                  className="border-l border-[var(--st-border)] px-3 py-2 text-center text-[12px] font-medium text-[var(--st-text)]"
                >
                  <div>{format(d, 'EEE')}</div>
                  <div className="text-[11px] text-[var(--st-text-secondary)]">{format(d, 'MMM d')}</div>
                </th>
              ))}
              <th className="border-l border-[var(--st-border)] px-3 py-2 text-center text-[12px] font-medium text-[var(--st-text-secondary)]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {paddingTop > 0 && <tr><td colSpan={10} style={{ height: `${paddingTop}px` }} /></tr>}
            
            {virtualItems.map((virtualRow) => {
              const taskId = filteredTasks[virtualRow.index];
              const rowHours = groupedTasks.get(taskId) || {};
              const rowTotal = weekDays.reduce((sum, d) => sum + (rowHours[wsToISODate(d)] || 0), 0);

              return (
                <tr key={taskId} className="border-b border-[var(--st-border)] last:border-b-0 hover:bg-[var(--st-bg-secondary)]/50">
                  <td className="px-3 py-2 text-center">
                    <Checkbox
                      checked={selectedTasks.has(taskId)}
                      onCheckedChange={() => toggleTaskSelection(taskId)}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="px-3 py-2 text-[13px] text-[var(--st-text)] font-medium">
                    {taskId === 'default' ? 'Hours logged (General)' : taskId}
                  </td>
                  {weekDays.map((d) => {
                    const key = wsToISODate(d);
                    return (
                      <td key={d.toISOString()} className="border-l border-[var(--st-border)] px-2 py-1.5 text-center">
                        <Input
                          type="number"
                          min={0}
                          max={24}
                          step={0.5}
                          disabled={!canEdit || isSaving}
                          defaultValue={rowHours[key] || ''}
                          onBlur={(e) => handleCellBlur(taskId, key, e.target.value)}
                          className="w-16 mx-auto h-8 text-center text-[13px]"
                        />
                      </td>
                    );
                  })}
                  <td className="border-l border-[var(--st-border)] px-3 py-2 text-center font-semibold text-[var(--st-text)]">
                    {rowTotal.toFixed(1)}h
                  </td>
                </tr>
              );
            })}

            {paddingBottom > 0 && <tr><td colSpan={10} style={{ height: `${paddingBottom}px` }} /></tr>}
          </tbody>
          <tfoot className="sticky bottom-0 z-10 bg-[var(--st-bg-muted)] shadow-[0_-1px_0_0_rgba(0,0,0,0.1)]">
            <tr className="border-t border-[var(--st-border)]">
              <td colSpan={2} className="px-3 py-3 text-[12px] font-medium text-[var(--st-text-secondary)] text-right">
                Daily Total
              </td>
              {columnTotals.map((h, i) => (
                <td
                  key={i}
                  className="border-l border-[var(--st-border)] px-3 py-3 text-center text-[13px] font-semibold text-[var(--st-text)]"
                >
                  {h.toFixed(1)}h
                </td>
              ))}
              <td className="border-l border-[var(--st-border)] px-3 py-3 text-center text-[13px] font-bold text-[var(--st-text)]">
                {grandTotal.toFixed(1)}h
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {!canEdit && (
        <p className="mt-3 text-[12px] text-[var(--st-text-secondary)]">
          Timesheet is {status} — editing is disabled.
        </p>
      )}
    </Card>
  );
}
