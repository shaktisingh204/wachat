'use client';

/**
 * 20ui — Pagination.
 *
 * A page navigator: Prev / Next plus numbered page buttons with ellipsis
 * truncation (e.g. 1 … 4 5 6 … 20). The current page is the accent button and
 * carries `aria-current="page"`; ellipses are inert text, not buttons. Built
 * from native `<button>`s inside a `<nav aria-label="Pagination">`, so it is
 * fully keyboard accessible for free (Tab between controls, Enter / Space to
 * activate). A `compact` size shrinks the controls for dense toolbars.
 *
 * Pages are 1-based. `onPageChange` only fires for a page that differs from the
 * current one and sits inside [1, pageCount].
 */

import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

import './pagination.css';

export type PaginationSize = 'md' | 'compact';

export interface PaginationProps
  extends Omit<React.HTMLAttributes<HTMLElement>, 'onChange'> {
  /** Current page, 1-based. */
  page: number;
  /** Total number of pages. */
  pageCount: number;
  /** Fired with the next page when the user picks a different, in-range page. */
  onPageChange: (page: number) => void;
  /** How many page buttons to show on each side of the current page. Default 1. */
  siblingCount?: number;
  /** Always render the first + last page buttons (with ellipses). Default true. */
  showEdges?: boolean;
  /** Control density. `compact` shrinks every control. Default `md`. */
  size?: PaginationSize;
  /** Accessible name for the nav landmark. Default "Pagination". */
  label?: string;
}

/** Marker for a gap rendered as an ellipsis rather than a page button. */
type Gap = 'gap-start' | 'gap-end';
type PageItem = number | Gap;

function range(start: number, end: number): number[] {
  const out: number[] = [];
  for (let i = start; i <= end; i += 1) out.push(i);
  return out;
}

/**
 * Build the visible item list. Always shows the current page with `siblingCount`
 * neighbours on each side; when `showEdges`, the first/last page are pinned and
 * collapsed gaps become a single ellipsis. The window width is constant, so the
 * control never jumps as the user pages through.
 */
function buildItems(
  page: number,
  pageCount: number,
  siblingCount: number,
  showEdges: boolean,
): PageItem[] {
  // Window of pages around the current one: siblings + current + first/last.
  const totalNumbers = siblingCount * 2 + 3; // first, last, current, 2*siblings
  const totalSlots = totalNumbers + 2; // + two potential ellipses

  if (!showEdges || pageCount <= totalSlots) {
    return range(1, pageCount);
  }

  const leftSibling = Math.max(page - siblingCount, 1);
  const rightSibling = Math.min(page + siblingCount, pageCount);

  // Show an ellipsis only when there is at least one hidden page on that side.
  const showLeftGap = leftSibling > 2;
  const showRightGap = rightSibling < pageCount - 1;

  const firstPage = 1;
  const lastPage = pageCount;

  if (!showLeftGap && showRightGap) {
    const leftCount = 3 + 2 * siblingCount;
    return [...range(1, leftCount), 'gap-end', lastPage];
  }

  if (showLeftGap && !showRightGap) {
    const rightCount = 3 + 2 * siblingCount;
    return [firstPage, 'gap-start', ...range(pageCount - rightCount + 1, pageCount)];
  }

  // Gaps on both sides.
  return [
    firstPage,
    'gap-start',
    ...range(leftSibling, rightSibling),
    'gap-end',
    lastPage,
  ];
}

export const Pagination = React.forwardRef<HTMLElement, PaginationProps>(
  function Pagination(
    {
      page,
      pageCount,
      onPageChange,
      siblingCount = 1,
      showEdges = true,
      size = 'md',
      label = 'Pagination',
      className,
      ...rest
    },
    ref,
  ) {
    // Clamp the active page into range so we never highlight a nonexistent page.
    const safeCount = Math.max(1, Math.floor(pageCount));
    const current = Math.min(Math.max(1, Math.floor(page)), safeCount);

    const goTo = React.useCallback(
      (next: number): void => {
        if (next < 1 || next > safeCount || next === current) return;
        onPageChange(next);
      },
      [safeCount, current, onPageChange],
    );

    const items = React.useMemo(
      () => buildItems(current, safeCount, Math.max(0, siblingCount), showEdges),
      [current, safeCount, siblingCount, showEdges],
    );

    const atStart = current <= 1;
    const atEnd = current >= safeCount;
    const iconSize = size === 'compact' ? 14 : 16;

    const cls = [
      'u-pagination',
      size === 'compact' && 'u-pagination--compact',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <nav ref={ref} className={cls} aria-label={label} {...rest}>
        <ul className="u-pagination__list">
          <li>
            <button
              type="button"
              className="u-page u-page--nav"
              onClick={() => goTo(current - 1)}
              disabled={atStart}
              aria-label="Go to previous page"
            >
              <ChevronLeft size={iconSize} aria-hidden="true" />
              <span className="u-page__nav-label">Prev</span>
            </button>
          </li>

          {items.map((item, i) => {
            if (item === 'gap-start' || item === 'gap-end') {
              return (
                <li key={`${item}-${i}`} aria-hidden="true">
                  <span className="u-page u-page--gap">
                    <MoreHorizontal size={iconSize} aria-hidden="true" />
                  </span>
                </li>
              );
            }
            const isCurrent = item === current;
            return (
              <li key={item}>
                <button
                  type="button"
                  className={['u-page', isCurrent && 'is-current'].filter(Boolean).join(' ')}
                  onClick={() => goTo(item)}
                  aria-current={isCurrent ? 'page' : undefined}
                  aria-label={isCurrent ? `Page ${item}, current page` : `Go to page ${item}`}
                >
                  {item}
                </button>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              className="u-page u-page--nav"
              onClick={() => goTo(current + 1)}
              disabled={atEnd}
              aria-label="Go to next page"
            >
              <span className="u-page__nav-label">Next</span>
              <ChevronRight size={iconSize} aria-hidden="true" />
            </button>
          </li>
        </ul>
      </nav>
    );
  },
);

export default Pagination;
