'use client';

import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TrainingCourse } from '@/lib/hrm-advanced-types';
import { Checkbox } from '@/components/sabcrm/20ui/compat';
import { Button } from '@/components/sabcrm/20ui/compat';
import { Edit2, Trash2 } from 'lucide-react';

interface VirtualizedCourseListProps {
  courses: TrainingCourse[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onEdit: (course: TrainingCourse) => void;
  onDelete: (id: string) => void;
  isPending: boolean;
}

export function VirtualizedCourseList({
  courses,
  selectedIds,
  onToggleSelect,
  onEdit,
  onDelete,
  isPending
}: VirtualizedCourseListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: courses.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Estimated row height
    overscan: 5,
  });

  if (courses.length === 0) {
    return (
      <div className="p-8 text-center text-[var(--st-text-secondary)]">
        No courses found. Adjust your search or create a new course.
      </div>
    );
  }

  return (
    <div 
      ref={parentRef} 
      className="max-h-[600px] overflow-auto relative w-full"
      style={{
        contain: 'strict',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const course = courses[virtualRow.index];
          const isSelected = course._id ? selectedIds.has(course._id) : false;

          return (
            <div
              key={course._id || virtualRow.index}
              className={`absolute top-0 left-0 w-full grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-4 p-4 border-b items-center transition-colors hover:bg-[var(--st-bg-muted)]/30 ${
                isSelected ? 'bg-[var(--st-text)]/5' : ''
              }`}
              style={{
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="flex items-center">
                <Checkbox 
                  checked={isSelected}
                  onCheckedChange={() => course._id && onToggleSelect(course._id)}
                  aria-label={`Select ${course.title}`}
                />
              </div>
              <div className="font-medium truncate" title={course.title}>
                {course.title}
              </div>
              <div className="text-[var(--st-text-secondary)] truncate text-sm" title={course.description || ''}>
                {course.description || '-'}
              </div>
              <div className="text-right tabular-nums">
                {course.enrolledCount.toLocaleString()}
              </div>
              <div className="text-right tabular-nums">
                {course.durationHours}
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => onEdit(course)}
                  disabled={isPending}
                >
                  <Edit2 className="w-4 h-4 text-[var(--st-text-secondary)]" />
                  <span className="sr-only">Edit</span>
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => course._id && onDelete(course._id)}
                  disabled={isPending}
                  className="hover:text-[var(--st-text)] hover:bg-[var(--st-text)]/10"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
