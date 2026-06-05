'use client';

/**
 * 20ui — Table primitives + DataTable.
 *
 * Two layers:
 *
 * 1. Low-level primitives (`Table`, `THead`, `TBody`, `TFoot`, `Tr`, `Th`, `Td`,
 *    `TCaption`) — thin, typed wrappers over the native table elements styled with
 *    the shared tokens: hairline rows, optional sticky header, hover row, compact
 *    density, optional zebra. A `Th` can be `sortable` and reflects its state with
 *    `aria-sort` plus an animated caret. Use these when you want full control over
 *    markup (grouped headers, custom cells, spanning rows).
 *
 * 2. `DataTable<T>` — a small, dependency-free table that renders the primitives
 *    from a `columns` + `rows` description. It handles client-side sorting (click a
 *    sortable header to cycle asc, desc, none), an empty state (reuses the 20ui
 *    EmptyState look), optional row click, and optional row selection via a leading
 *    checkbox column. No external table library — fast and self-contained.
 *
 * A11y: native `<table>` semantics throughout; sortable headers are real buttons
 * inside the `<th>` so they are keyboard reachable, and the `<th>` carries
 * `aria-sort`. The select-all checkbox uses `indeterminate` for partial selection.
 */

import * as React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Inbox, type LucideIcon } from 'lucide-react';

import './table.css';

/* ========================================================================== */
/* Primitives                                                                 */
/* ========================================================================== */

export type TableDensity = 'comfortable' | 'compact';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Row height / padding preset. `compact` tightens vertical rhythm. */
  density?: TableDensity;
  /** Tint every other body row for easier line tracking. */
  zebra?: boolean;
  /** Highlight the body row under the cursor. */
  hover?: boolean;
  /** Pin the `<thead>` to the top of the nearest scroll container. */
  stickyHeader?: boolean;
}

/**
 * The styled `<table>` root. Wrap it in a scroll container yourself if you want
 * `stickyHeader` to engage (e.g. `<div style={{ maxHeight, overflow: 'auto' }}>`).
 */
export const Table = React.forwardRef<HTMLTableElement, TableProps>(function Table(
  { density = 'comfortable', zebra = false, hover = true, stickyHeader = false, className, children, ...rest },
  ref,
) {
  const cls = [
    'u-table',
    `u-table--${density}`,
    zebra && 'u-table--zebra',
    hover && 'u-table--hover',
    stickyHeader && 'u-table--sticky',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <table ref={ref} className={cls} {...rest}>
      {children}
    </table>
  );
});

export function THead({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element {
  return (
    <thead className={['u-thead', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </thead>
  );
}

export function TBody({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element {
  return (
    <tbody className={['u-tbody', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </tbody>
  );
}

export function TFoot({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableSectionElement>): React.JSX.Element {
  return (
    <tfoot className={['u-tfoot', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </tfoot>
  );
}

export interface TrProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Render the row as selected (accent tint + `aria-selected`). */
  selected?: boolean;
}

export const Tr = React.forwardRef<HTMLTableRowElement, TrProps>(function Tr(
  { selected, className, children, ...rest },
  ref,
) {
  return (
    <tr
      ref={ref}
      className={['u-tr', selected && 'is-selected', className].filter(Boolean).join(' ')}
      aria-selected={selected || undefined}
      {...rest}
    >
      {children}
    </tr>
  );
});

export type CellAlign = 'left' | 'center' | 'right';
export type SortDirection = 'asc' | 'desc';

export interface ThProps extends Omit<React.ThHTMLAttributes<HTMLTableCellElement>, 'onClick'> {
  align?: CellAlign;
  /** Make this header interactive: renders a button + reflects `aria-sort`. */
  sortable?: boolean;
  /** Current sort direction for this column, or `null`/`undefined` when unsorted. */
  sortDirection?: SortDirection | null;
  /** Fired when a sortable header is activated (click / Enter / Space). */
  onSort?: () => void;
  /** Make the cell width fit its content / a fixed value (a column width hint). */
  width?: number | string;
}

/**
 * A header cell. When `sortable`, the label becomes a button and the `<th>`
 * carries `aria-sort` ("ascending" | "descending" | "none"), with a caret that
 * flips to show the active direction.
 */
export const Th = React.forwardRef<HTMLTableCellElement, ThProps>(function Th(
  { align = 'left', sortable = false, sortDirection, onSort, width, className, children, style, ...rest },
  ref,
) {
  const ariaSort: React.AriaAttributes['aria-sort'] = sortable
    ? sortDirection === 'asc'
      ? 'ascending'
      : sortDirection === 'desc'
        ? 'descending'
        : 'none'
    : undefined;

  const cls = [
    'u-th',
    `u-th--${align}`,
    sortable && 'u-th--sortable',
    sortDirection && 'is-sorted',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const mergedStyle = width != null ? { width, ...style } : style;

  return (
    <th ref={ref} scope="col" className={cls} aria-sort={ariaSort} style={mergedStyle} {...rest}>
      {sortable ? (
        <button type="button" className="u-th__sort" onClick={onSort}>
          <span className="u-th__label">{children}</span>
          <SortCaret direction={sortDirection ?? null} />
        </button>
      ) : (
        <span className="u-th__label">{children}</span>
      )}
    </th>
  );
});

/** The directional caret shown in a sortable header. Decorative. */
function SortCaret({ direction }: { direction: SortDirection | null }): React.JSX.Element {
  const Icon: LucideIcon = direction === 'asc' ? ChevronUp : direction === 'desc' ? ChevronDown : ChevronsUpDown;
  return <Icon size={13} className="u-th__caret" aria-hidden="true" />;
}

export interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: CellAlign;
  /** Truncate overflowing content to a single line with an ellipsis. */
  truncate?: boolean;
}

export const Td = React.forwardRef<HTMLTableCellElement, TdProps>(function Td(
  { align = 'left', truncate = false, className, children, ...rest },
  ref,
) {
  const cls = ['u-td', `u-td--${align}`, truncate && 'u-td--truncate', className]
    .filter(Boolean)
    .join(' ');
  return (
    <td ref={ref} className={cls} {...rest}>
      {truncate ? <span className="u-td__inner">{children}</span> : children}
    </td>
  );
});

export function TCaption({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLTableCaptionElement>): React.JSX.Element {
  return (
    <caption className={['u-tcaption', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </caption>
  );
}

/* ========================================================================== */
/* DataTable                                                                  */
/* ========================================================================== */

export interface DataTableColumn<T> {
  /** Stable column id. Also the default accessor for string/number sorting. */
  key: string;
  /** Header content. */
  header: React.ReactNode;
  /** Custom cell renderer. Defaults to `(row as Record)[key]`. */
  render?: (row: T, index: number) => React.ReactNode;
  /** Allow client-side sorting on this column. */
  sortable?: boolean;
  /** Override the value used when sorting (defaults to the `key` accessor). */
  sortValue?: (row: T) => string | number | boolean | null | undefined;
  /** A column width hint (e.g. 120 or "20%"). */
  width?: number | string;
  /** Cell + header alignment. */
  align?: CellAlign;
}

export interface DataTableProps<T>
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick' | 'children'> {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  /** Stable row id — used for React keys and selection. */
  getRowId: (row: T, index: number) => string;
  /** Fired when a body row is clicked. Makes rows keyboard-activatable too. */
  onRowClick?: (row: T, index: number) => void;
  /** Shown when `rows` is empty. Defaults to a neutral EmptyState look. */
  empty?: React.ReactNode;
  /** Pass the primitive density through. */
  density?: TableDensity;
  zebra?: boolean;
  hover?: boolean;
  stickyHeader?: boolean;
  /** Enable a leading checkbox column. Controlled via `selectedIds` + `onSelectionChange`. */
  selectable?: boolean;
  /** The currently selected row ids (controlled). */
  selectedIds?: ReadonlyArray<string>;
  /** Fired with the next full set of selected ids. */
  onSelectionChange?: (ids: string[]) => void;
  /** Accessible name for the select-all / per-row checkboxes (e.g. "lead"). */
  selectItemLabel?: string;
}

interface SortState {
  key: string;
  direction: SortDirection;
}

function defaultAccessor<T>(row: T, key: string): unknown {
  return (row as Record<string, unknown>)[key];
}

function compareValues(a: unknown, b: unknown): number {
  // Nullish sorts last regardless of direction-flip below.
  const aNil = a == null || a === '';
  const bNil = b == null || b === '';
  if (aNil && bNil) return 0;
  if (aNil) return 1;
  if (bNil) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? -1 : 1;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * A self-contained data table. Renders the 20ui primitives from a column/row
 * description, sorts on the client when a sortable header is activated, and shows
 * an EmptyState when there are no rows.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  empty,
  density = 'comfortable',
  zebra = false,
  hover = true,
  stickyHeader = false,
  selectable = false,
  selectedIds,
  onSelectionChange,
  selectItemLabel = 'row',
  className,
  ...rest
}: DataTableProps<T>): React.JSX.Element {
  const [sort, setSort] = React.useState<SortState | null>(null);

  const columnByKey = React.useMemo(() => {
    const map = new Map<string, DataTableColumn<T>>();
    for (const col of columns) map.set(col.key, col);
    return map;
  }, [columns]);

  const sortedRows = React.useMemo(() => {
    if (!sort) return rows;
    const col = columnByKey.get(sort.key);
    if (!col) return rows;
    const accessor = col.sortValue ?? ((row: T) => defaultAccessor(row, col.key));
    const dir = sort.direction === 'asc' ? 1 : -1;
    // Stable sort: decorate with the original index, compare, then strip.
    return rows
      .map((row, index) => ({ row, index }))
      .sort((x, y) => {
        const cmp = compareValues(accessor(x.row), accessor(y.row));
        return cmp !== 0 ? cmp * dir : x.index - y.index;
      })
      .map((d) => d.row);
  }, [rows, sort, columnByKey]);

  const cycleSort = React.useCallback((key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null; // third click clears the sort
    });
  }, []);

  // ----- Selection -----
  const selectedSet = React.useMemo(() => new Set(selectedIds ?? []), [selectedIds]);
  const rowIds = React.useMemo(() => sortedRows.map((r, i) => getRowId(r, i)), [sortedRows, getRowId]);
  const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedSet.has(id));
  const someSelected = rowIds.some((id) => selectedSet.has(id));
  const selectAllRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const toggleAll = (): void => {
    if (!onSelectionChange) return;
    if (allSelected) {
      const next = (selectedIds ?? []).filter((id) => !rowIds.includes(id));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedIds ?? []);
      for (const id of rowIds) next.add(id);
      onSelectionChange([...next]);
    }
  };

  const toggleOne = (id: string): void => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds ?? []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange([...next]);
  };

  const colSpan = columns.length + (selectable ? 1 : 0);

  const cls = ['u-datatable', className].filter(Boolean).join(' ');

  return (
    <div className={cls} {...rest}>
      <Table
        density={density}
        zebra={zebra}
        hover={hover && !!onRowClick ? true : hover}
        stickyHeader={stickyHeader}
      >
        <THead>
          <Tr>
            {selectable ? (
              <Th className="u-th--checkbox" align="center">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  className="u-table__checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={`Select all ${selectItemLabel}s`}
                />
              </Th>
            ) : null}
            {columns.map((col) => (
              <Th
                key={col.key}
                align={col.align}
                width={col.width}
                sortable={col.sortable}
                sortDirection={sort?.key === col.key ? sort.direction : null}
                onSort={col.sortable ? () => cycleSort(col.key) : undefined}
              >
                {col.header}
              </Th>
            ))}
          </Tr>
        </THead>
        <TBody>
          {sortedRows.length === 0 ? (
            <tr className="u-tr u-tr--empty">
              <td className="u-td u-td--empty" colSpan={colSpan}>
                {empty ?? <DataTableEmpty />}
              </td>
            </tr>
          ) : (
            sortedRows.map((row, index) => {
              const id = getRowId(row, index);
              const isSelected = selectedSet.has(id);
              const clickable = Boolean(onRowClick);
              return (
                <Tr
                  key={id}
                  selected={isSelected}
                  className={clickable ? 'u-tr--clickable' : undefined}
                  onClick={clickable ? () => onRowClick?.(row, index) : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            onRowClick?.(row, index);
                          }
                        }
                      : undefined
                  }
                  tabIndex={clickable ? 0 : undefined}
                  role={clickable ? 'button' : undefined}
                >
                  {selectable ? (
                    <Td className="u-td--checkbox" align="center">
                      <input
                        type="checkbox"
                        className="u-table__checkbox"
                        checked={isSelected}
                        // Stop the row's click handler from also firing.
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleOne(id)}
                        aria-label={`Select ${selectItemLabel}`}
                      />
                    </Td>
                  ) : null}
                  {columns.map((col) => (
                    <Td key={col.key} align={col.align}>
                      {col.render ? col.render(row, index) : String(defaultAccessor(row, col.key) ?? '')}
                    </Td>
                  ))}
                </Tr>
              );
            })
          )}
        </TBody>
      </Table>
    </div>
  );
}

/** The default empty state for a `DataTable` — matches the 20ui EmptyState look. */
function DataTableEmpty(): React.JSX.Element {
  return (
    <div className="u-table-empty">
      <span className="u-table-empty__chip" aria-hidden="true">
        <Inbox size={20} />
      </span>
      <p className="u-table-empty__title">Nothing here yet</p>
      <p className="u-table-empty__desc">There are no records to show. New rows will appear here.</p>
    </div>
  );
}

export default Table;
