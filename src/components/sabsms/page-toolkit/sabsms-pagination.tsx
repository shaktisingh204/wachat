"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

import {
  Button,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from "@/components/zoruui";

const PAGE_SIZES = [25, 50, 100, 250] as const;

export interface SabsmsPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function SabsmsPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: SabsmsPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(total, (page + 1) * pageSize);
  const canPrev = page > 0;
  const canNext = page + 1 < totalPages;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <span>
        {total === 0
          ? "No results"
          : `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`}
      </span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">Rows</span>
          <ZoruSelect
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange?.(parseInt(v, 10))}
          >
            <ZoruSelectTrigger className="h-8 w-[80px]">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {PAGE_SIZES.map((s) => (
                <ZoruSelectItem key={s} value={String(s)}>
                  {s}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
        <div className="flex items-center gap-1">
          <ZoruButton
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!canPrev}
            onClick={() => onPageChange?.(0)}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!canPrev}
            onClick={() => onPageChange?.(Math.max(0, page - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </ZoruButton>
          <span className="px-2 text-xs">
            Page {page + 1} of {totalPages}
          </span>
          <ZoruButton
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!canNext}
            onClick={() => onPageChange?.(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={!canNext}
            onClick={() => onPageChange?.(totalPages - 1)}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </ZoruButton>
        </div>
      </div>
    </div>
  );
}
