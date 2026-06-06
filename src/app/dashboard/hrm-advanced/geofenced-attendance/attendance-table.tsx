import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AttendanceRecord } from '@/lib/hrm-advanced-types';
import { Button } from '@/components/sabcrm/20ui/compat';

interface AttendanceTableProps {
  data: AttendanceRecord[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onEdit: (item: AttendanceRecord) => void;
  onDelete: (id: string) => void;
}

export function AttendanceTable({ data, selectedIds, onSelectionChange, onEdit, onDelete }: AttendanceTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 53, // Estimated row height
    overscan: 5,
  });

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    onSelectionChange(newSelection);
  };

  const toggleAll = () => {
    if (selectedIds.size === data.length) {
      onSelectionChange(new Set());
    } else {
      const allIds = data.map(item => item._id).filter(Boolean) as string[];
      onSelectionChange(new Set(allIds));
    }
  };

  return (
    <div className="rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] overflow-hidden">
      {/* Table Header Wrapper to keep it sticky or separate from the scrolling body */}
      <div className="overflow-x-auto border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]/50">
        <div className="flex items-center px-4 py-3 font-medium text-sm text-[var(--st-text-secondary)]">
          <div className="w-[50px] flex-shrink-0">
            <input
              type="checkbox"
              checked={data.length > 0 && selectedIds.size === data.length}
              onChange={toggleAll}
              className="rounded border-[var(--st-border)]"
            />
          </div>
          <div className="flex-1 px-2">Employee</div>
          <div className="flex-1 px-2">Date</div>
          <div className="flex-1 px-2">Check-In</div>
          <div className="flex-1 px-2">Check-Out</div>
          <div className="flex-1 px-2">Geofenced</div>
          <div className="flex-1 px-2 text-right">Actions</div>
        </div>
      </div>

      <div 
        ref={parentRef} 
        style={{ height: '400px', overflow: 'auto' }}
        className="w-full"
      >
        <div 
          style={{ 
            height: `${rowVirtualizer.getTotalSize()}px`, 
            width: '100%', 
            position: 'relative' 
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = data[virtualRow.index];
            const isSelected = item._id ? selectedIds.has(item._id) : false;
            
            // Client-side date formatting to avoid hydration mismatch
            const formattedDate = item.date ? new Date(item.date).toLocaleDateString() : '';

            return (
              <div
                key={item._id || virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={`border-b border-[var(--st-border)] flex items-center px-4 hover:bg-[var(--st-bg)] transition-colors ${isSelected ? 'bg-[var(--st-bg)]' : ''}`}
              >
                <div className="w-[50px] flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => item._id && toggleSelection(item._id)}
                    className="rounded border-[var(--st-border)]"
                  />
                </div>
                <div className="flex-1 truncate px-2">{item.employeeId}</div>
                <div className="flex-1 truncate px-2" suppressHydrationWarning>{formattedDate}</div>
                <div className="flex-1 truncate px-2">{item.checkInTime}</div>
                <div className="flex-1 truncate px-2">{item.checkOutTime || '-'}</div>
                <div className="flex-1 truncate px-2">{item.isGeofenced ? 'Yes' : 'No'}</div>
                <div className="flex-1 flex justify-end gap-2 px-2">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(item)}>Edit</Button>
                  <Button variant="ghost" size="sm" className="text-[var(--st-text)] hover:text-[var(--st-text)]" onClick={() => item._id && onDelete(item._id)}>Del</Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
