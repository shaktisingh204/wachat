'use client';

/**
 * GridPagination — the classic paged footer for {@link RecordGrid}.
 *
 * Page-size select (25 / 50 / 100), prev/next, and an "x–y of total" range
 * readout. Fully controlled: the caller owns `page` / `pageSize` state and
 * slices its records accordingly (pass this component via RecordGrid's
 * `footer` slot).
 */

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { IconButton } from '../../button';
import { Select } from '../../select';
import { cn } from '../lib/cn';

import './record-grid.css';

const DEFAULT_PAGE_SIZES = [25, 50, 100];

export interface GridPaginationProps {
  /** Current page, 1-based. */
  page: number;
  pageSize: number;
  /** Total records across all pages. */
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  /** Selectable page sizes. Defaults to 25 / 50 / 100. */
  pageSizeOptions?: number[];
  className?: string;
}

export function GridPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  className,
}: GridPaginationProps): React.JSX.Element {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const clampedPage = Math.min(Math.max(1, page), pageCount);
  const from = total === 0 ? 0 : (clampedPage - 1) * pageSize + 1;
  const to = Math.min(clampedPage * pageSize, total);

  const sizeOptions = React.useMemo(
    () =>
      pageSizeOptions.map((n) => ({ value: String(n), label: String(n) })),
    [pageSizeOptions],
  );

  return (
    <div className={cn('rg-pager', className)}>
      <div className="rg-pager-size">
        <span className="rg-pager-label">Rows per page</span>
        <Select
          size="sm"
          value={String(pageSize)}
          onChange={(v) => {
            if (v != null) onPageSizeChange(Number(v));
          }}
          options={sizeOptions}
          aria-label="Rows per page"
        />
      </div>
      <div className="rg-pager-nav">
        <span className="rg-pager-range" aria-live="polite">
          {from}&ndash;{to} of {total.toLocaleString()}
        </span>
        <IconButton
          label="Previous page"
          icon={ChevronLeft}
          variant="ghost"
          size="sm"
          disabled={clampedPage <= 1}
          onClick={() => onPageChange(clampedPage - 1)}
        />
        <IconButton
          label="Next page"
          icon={ChevronRight}
          variant="ghost"
          size="sm"
          disabled={clampedPage >= pageCount}
          onClick={() => onPageChange(clampedPage + 1)}
        />
      </div>
    </div>
  );
}

export default GridPagination;
