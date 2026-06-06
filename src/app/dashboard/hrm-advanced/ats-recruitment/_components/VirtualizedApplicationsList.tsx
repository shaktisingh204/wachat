'use client';

import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ATSApplication } from '@/lib/hrm-advanced-types';
import { Button } from '@/components/sabcrm/20ui';
import { Checkbox } from '@/components/sabcrm/20ui';
import { Badge } from '@/components/sabcrm/20ui';
import { Edit, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  applications: ATSApplication[];
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  onEdit: (app: ATSApplication) => void;
  onDelete: (id: string) => void;
  isClient: boolean;
}

export default function VirtualizedApplicationsList({
  applications,
  selectedIds,
  toggleSelection,
  selectAll,
  onEdit,
  onDelete,
  isClient
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: applications.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // approximate row height
    overscan: 5,
  });

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'New': return 'bg-[var(--st-bg-muted)] text-[var(--st-text)]';
      case 'Screening': return 'bg-[var(--st-bg-muted)] text-[var(--st-text)]';
      case 'Interview': return 'bg-[var(--st-bg-muted)] text-[var(--st-text)]';
      case 'Offer': return 'bg-[var(--st-bg-muted)] text-[var(--st-text)]';
      case 'Hired': return 'bg-[var(--st-bg-muted)] text-[var(--st-text)]';
      case 'Rejected': return 'bg-[var(--st-bg-muted)] text-[var(--st-text)]';
      default: return 'bg-[var(--st-bg-muted)] text-[var(--st-text)]';
    }
  };

  const allSelected = applications.length > 0 && selectedIds.size === applications.length;

  return (
    <div className="border rounded-md">
      {/* Header */}
      <div className="flex bg-[var(--st-bg-muted)]/50 p-4 border-b font-medium text-sm text-[var(--st-text-secondary)] items-center sticky top-0 z-10">
        <div className="w-[50px] flex-shrink-0">
          <Checkbox 
            checked={allSelected}
            onCheckedChange={selectAll}
            aria-label="Select all"
          />
        </div>
        <div className="flex-1 min-w-[150px]">Candidate</div>
        <div className="flex-1 min-w-[150px]">Role</div>
        <div className="flex-1 min-w-[100px]">Status</div>
        <div className="flex-1 min-w-[150px]">Applied Date</div>
        <div className="w-[100px] text-right flex-shrink-0">Actions</div>
      </div>

      {/* Body */}
      <div 
        ref={parentRef} 
        className="h-[500px] overflow-auto"
        style={{ contain: 'strict' }}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const app = applications[virtualRow.index];
            const isSelected = selectedIds.has(app._id!);
            return (
              <div
                key={app._id}
                className={`absolute top-0 left-0 w-full flex items-center p-4 border-b hover:bg-[var(--st-bg-muted)]/50 transition-colors ${isSelected ? 'bg-[var(--st-bg-muted)]/50' : ''}`}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="w-[50px] flex-shrink-0">
                  <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => toggleSelection(app._id!)}
                  />
                </div>
                <div className="flex-1 min-w-[150px] font-medium">{app.candidateName}</div>
                <div className="flex-1 min-w-[150px] text-[var(--st-text-secondary)]">{app.role}</div>
                <div className="flex-1 min-w-[100px]">
                  <Badge variant="secondary" className={getStatusColor(app.status)}>
                    {app.status}
                  </Badge>
                </div>
                <div className="flex-1 min-w-[150px] text-[var(--st-text-secondary)]">
                  {isClient && app.appliedDate ? format(new Date(app.appliedDate), 'MMM d, yyyy') : app.appliedDate}
                </div>
                <div className="w-[100px] text-right flex-shrink-0 space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(app)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(app._id!)} className="text-[var(--st-text)] hover:text-[var(--st-text)]">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
          {applications.length === 0 && (
            <div className="p-8 text-center text-[var(--st-text-secondary)] w-full">
              No applications found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
