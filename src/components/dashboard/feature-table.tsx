'use client';

import * as React from 'react';
import { Table, THead, TBody, Tr, Th, Td } from '@/components/sabcrm/20ui/compat';
import { Button } from '@/components/sabcrm/20ui/compat';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { EmptyState } from '@/components/sabcrm/20ui/compat';
import { Skeleton } from '@/components/sabcrm/20ui/compat';

interface FeatureTableProps<T> {
  columns: { header: string; cell: (row: T) => React.ReactNode; className?: string }[];
  data: T[];
  isLoading?: boolean;
  emptyIcon?: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  emptyAction?: React.ReactNode;
  // Pagination
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  // Export
  onExportCsv?: () => void;
}

export function FeatureTable<T>({
  columns,
  data,
  isLoading,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  currentPage,
  totalPages,
  totalItems,
  onPageChange,
  onExportCsv,
}: FeatureTableProps<T>) {
  if (isLoading && data.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-4 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden">
        <EmptyState
          icon={emptyIcon}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
          className="border-0"
        />
      </div>
    );
  }

  return (
    <div className="rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] overflow-hidden flex flex-col">
      {onExportCsv && (
        <div className="flex items-center justify-end border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]/50 p-2">
          <Button variant="ghost" size="sm" onClick={onExportCsv} className="h-8 text-xs">
            <Download className="mr-2 h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>
      )}
      
      <div className="overflow-x-auto">
        <Table className="w-full text-[13px]">
          <THead className="border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
            <Tr className="hover:bg-transparent">
              {columns.map((col, i) => (
                <Th key={i} className={col.className}>
                  {col.header}
                </Th>
              ))}
            </Tr>
          </THead>
          <TBody className="divide-y divide-[var(--st-border)]">
            {data.map((row, i) => (
              <Tr key={i} className="transition-colors hover:bg-[var(--st-bg-secondary)]">
                {columns.map((col, j) => (
                  <Td key={j} className={col.className}>
                    {col.cell(row)}
                  </Td>
                ))}
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      {(totalPages && totalPages > 1) ? (
        <div className="flex items-center justify-between gap-3 border-t border-[var(--st-border)] p-4">
          <span className="text-[11.5px] tabular-nums text-[var(--st-text-secondary)]">
            Page {currentPage} of {totalPages} {totalItems !== undefined && `· ${totalItems.toLocaleString()} items`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(Math.max(1, (currentPage || 1) - 1))}
              disabled={(currentPage || 1) <= 1 || isLoading}
            >
              <ChevronLeft className="mr-1 h-4 w-4" /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(Math.min(totalPages, (currentPage || 1) + 1))}
              disabled={(currentPage || 1) >= totalPages || isLoading}
            >
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
