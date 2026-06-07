'use client';

/**
 * SabCRM — Twenty record-table footer pagination.
 *
 * A controlled, presentational stepper rendered under the flat table view on
 * `/sabcrm/[objectSlug]`. It owns no query state: the page passes the current
 * `page`/`limit` and the server-reported `total`, and this component raises the
 * desired next page / page-size back up so the page re-lists.
 *
 *   - "{total} records" count (singular-aware via the object's labels).
 *   - A "1–50 of 240" range hint for the current window.
 *   - A page-size <select> (25 / 50 / 100).
 *   - Prev / Next steppers, disabled at the boundaries (derived from `total`).
 *
 * Twenty look only (`.st-*` + pagination.css) — no Ui20 / Tailwind / clay.
 */

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Select } from '@/components/sabcrm/20ui';

export const PAGE_SIZE_OPTIONS: readonly number[] = [25, 50, 100];

export interface SabcrmPaginationProps {
  /** 1-based current page. */
  page: number;
  /** Page size (rows per page). */
  limit: number;
  /** Server-reported total record count for the active query. */
  total: number;
  /** Rows actually on screen (the current page's length). */
  pageCount: number;
  /** Lowercase singular noun for "1 record". */
  singular: string;
  /** Lowercase plural noun for "N records". */
  plural: string;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
}

export function SabcrmPagination({
  page,
  limit,
  total,
  pageCount,
  singular,
  plural,
  onPageChange,
  onLimitChange,
}: SabcrmPaginationProps): React.JSX.Element {
  // Total pages derived from `total`; never below 1 so the controls stay sane
  // even before the first count lands.
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const firstRow = total === 0 ? 0 : (safePage - 1) * limit + 1;
  // The window end uses the live page length so it stays honest if the final
  // page is short or the count is momentarily stale.
  const lastRow = total === 0 ? 0 : Math.min(total, firstRow + Math.max(pageCount, 0) - 1);

  const atFirst = safePage <= 1;
  const atLast = safePage >= totalPages;

  return (
    <nav className="st-pagination" aria-label="Table pagination">
      <span className="st-pagination__count">
        <strong>{total.toLocaleString()}</strong> {total === 1 ? singular : plural}
      </span>

      {total > 0 && (
        <span className="st-pagination__range">
          {firstRow.toLocaleString()}–{lastRow.toLocaleString()} of{' '}
          {total.toLocaleString()}
        </span>
      )}

      <span className="st-pagination__spacer" />

      <span className="st-pagination__sizer">
        Rows
        <Select
          className="st-pagination__select"
          size="sm"
          value={String(limit)}
          aria-label="Rows per page"
          onChange={(v) => v != null && onLimitChange(Number(v))}
          options={PAGE_SIZE_OPTIONS.map((opt) => ({
            value: String(opt),
            label: String(opt),
          }))}
        />
      </span>

      <div className="st-pagination__nav">
        <button
          type="button"
          className="st-pagination__btn"
          disabled={atFirst}
          aria-label="Previous page"
          onClick={() => onPageChange(safePage - 1)}
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <span className="st-pagination__range" aria-live="polite">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          className="st-pagination__btn"
          disabled={atLast}
          aria-label="Next page"
          onClick={() => onPageChange(safePage + 1)}
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </nav>
  );
}
