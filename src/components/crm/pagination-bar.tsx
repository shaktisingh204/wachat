'use client';

import { ZoruButton, ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import {
  useRouter,
  useSearchParams,
  usePathname } from 'next/navigation';
import { ChevronLeft,
  ChevronRight } from 'lucide-react';

/**
 * <PaginationBar> — reusable list-pagination control.
 *
 * Designed for "page+limit"-style lists. The Rust BFF list endpoints
 * return bare arrays without a `total` count (see `crm-leads` handler
 * comment), so this component is `hasMore`-driven: it never renders
 * a "page X of Y" — only Prev / Next + a page-size dropdown.
 *
 * URL-based by default: writes `?page=` and `?limit=` to the query
 * string via `next/navigation`. Consumers that want local state can
 * pass `controlled={{ page, limit, onChange }}` instead.
 */

import * as React from 'react';

export interface PaginationBarProps {
  page: number;
  limit: number;
  hasMore: boolean;
  /** Optional total — when provided, shows "1–20 of 142". */
  total?: number;
  /** Page-size options. Default `[10, 20, 50, 100]`. */
  pageSizes?: number[];
  /**
   * Controlled mode. When set, the bar calls `onChange` instead of
   * writing to the URL. Use when the caller manages its own state.
   */
  controlled?: {
    onChange: (next: { page: number; limit: number }) => void;
  };
  className?: string;
}

const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

export function PaginationBar({
  page,
  limit,
  hasMore,
  total,
  pageSizes = DEFAULT_PAGE_SIZES,
  controlled,
  className,
}: PaginationBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const setQuery = React.useCallback(
    (next: { page?: number; limit?: number }) => {
      if (controlled) {
        controlled.onChange({
          page: next.page ?? page,
          limit: next.limit ?? limit,
        });
        return;
      }
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (next.page != null) params.set('page', String(next.page));
      if (next.limit != null) {
        params.set('limit', String(next.limit));
        // Resetting limit always jumps to page 1 — otherwise a smaller
        // page on the same page number can land on empty.
        params.set('page', '1');
      }
      const q = params.toString();
      router.push(q ? `${pathname}?${q}` : pathname);
    },
    [controlled, page, limit, sp, pathname, router],
  );

  const prevDisabled = page <= 1;
  const nextDisabled = !hasMore;

  const rangeText = (() => {
    const from = (page - 1) * limit + 1;
    const toRaw = (page - 1) * limit + limit;
    if (typeof total === 'number') {
      const to = Math.min(toRaw, total);
      return total === 0 ? '0 results' : `${from}–${to} of ${total}`;
    }
    return hasMore ? `${from}–${toRaw}` : `${from}+`;
  })();

  return (
    <div
      className={
        'flex flex-wrap items-center justify-between gap-3 border-t border-zoru-line px-3 py-2.5 ' +
        (className ?? '')
      }
    >
      <div className="flex items-center gap-2 text-[12px] text-zoru-ink-muted">
        <span>Rows per page</span>
        <ZoruSelect
          value={String(limit)}
          onValueChange={(v) => setQuery({ limit: Number(v) })}
        >
          <ZoruSelectTrigger className="h-8 w-[80px] text-[12px]">
            <ZoruSelectValue />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            {pageSizes.map((n) => (
              <ZoruSelectItem key={n} value={String(n)}>
                {n}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </ZoruSelect>
      </div>

      <div className="flex items-center gap-3 text-[12px] text-zoru-ink-muted">
        <span>{rangeText}</span>
        <div className="flex items-center gap-1">
          <ZoruButton
            size="sm"
            variant="outline"
            disabled={prevDisabled}
            onClick={() => setQuery({ page: Math.max(1, page - 1) })}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </ZoruButton>
          <ZoruButton
            size="sm"
            variant="outline"
            disabled={nextDisabled}
            onClick={() => setQuery({ page: page + 1 })}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </ZoruButton>
        </div>
      </div>
    </div>
  );
}

export default PaginationBar;
