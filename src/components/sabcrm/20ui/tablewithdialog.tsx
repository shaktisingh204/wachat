'use client';

/**
 * 20ui — TableWithDialog.
 *
 * A `DataTable<T>` whose body rows open a detail `Modal` when clicked (or
 * activated from the keyboard). Use this for entity lists where each row's
 * expanded detail is too rich to render inline — for example a leads table
 * whose rows open a full contact card.
 *
 * This module does NOT reimplement the table or the dialog. It composes the
 * canonical `DataTable` (which already gives sorting, selection, an empty state,
 * and keyboard-activatable rows: `tabIndex`, `role="button"`, Enter to open) and
 * the canonical `Modal` (which already traps + restores focus, closes on Escape /
 * overlay click, and locks body scroll). All it adds is the wiring: clicking a
 * row stores that row's id, which opens the modal with `renderDialog(row)`.
 *
 * The active row is tracked by id (not array index) so that re-sorting or
 * mutating `rows` while the dialog is open never swaps the content under the
 * user. If the active row disappears from `rows`, the dialog closes itself.
 */

import * as React from 'react';

import { DataTable, type DataTableColumn, type DataTableProps, type TableDensity } from './table';
import { Modal, type ModalSize } from './modal';

// Re-export the column type under a module-local alias so consumers can type
// their columns without also importing from './table'.
export type { DataTableColumn as TableWithDialogColumn } from './table';

export interface TableWithDialogProps<T>
  extends Omit<
    DataTableProps<T>,
    // We own row clicks (they open the dialog), so the caller can't pass one.
    'onRowClick' | 'children'
  > {
  /** Column descriptions, forwarded to the underlying `DataTable`. */
  columns: Array<DataTableColumn<T>>;
  /** The rows to render. */
  rows: T[];
  /** Stable row id — used for React keys, selection, and tracking the open row. */
  getRowId: (row: T, index: number) => string;
  /** Render the dialog body for the row the user opened. */
  renderDialog: (row: T) => React.ReactNode;
  /** Accessible dialog title for the active row. Defaults to "Details". */
  dialogTitle?: (row: T) => React.ReactNode;
  /** Optional supporting copy under the dialog title. */
  dialogDescription?: (row: T) => React.ReactNode;
  /** Optional sticky footer (typically action buttons) for the active row. */
  dialogFooter?: (row: T) => React.ReactNode;
  /** Width preset for the detail dialog. */
  dialogSize?: ModalSize;
  /** Density forwarded to the underlying table. */
  density?: TableDensity;
}

/**
 * A DataTable whose rows open a detail Modal on click / keyboard activation.
 *
 * @example
 * // <TableWithDialog
 * //   columns={[{ key: 'name', header: 'Name' }, { key: 'company', header: 'Company' }]}
 * //   rows={leads}
 * //   getRowId={(l) => l.id}
 * //   dialogTitle={(l) => l.name}            // e.g. "Acme renewal"
 * //   renderDialog={(l) => <LeadDetail lead={l} />}
 * // />
 */
export function TableWithDialog<T>({
  columns,
  rows,
  getRowId,
  renderDialog,
  dialogTitle,
  dialogDescription,
  dialogFooter,
  dialogSize = 'md',
  density,
  className,
  ...rest
}: TableWithDialogProps<T>): React.JSX.Element {
  // Track the open row by its stable id, not by array index, so sorting or
  // mutating `rows` while the dialog is open never swaps the content.
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // Resolve the active row each render from the current `rows`. If it has been
  // removed (filtered / deleted), `active` becomes null and the effect below
  // closes the dialog.
  const active = React.useMemo<T | null>(() => {
    if (activeId == null) return null;
    const idx = rows.findIndex((row, i) => getRowId(row, i) === activeId);
    return idx === -1 ? null : rows[idx];
  }, [activeId, rows, getRowId]);

  // If the open row vanished from `rows`, drop the stale id so we don't keep a
  // dangling reference (and so a later row reusing that id can't pop the dialog
  // back open).
  React.useEffect(() => {
    if (activeId != null && active === null) {
      setActiveId(null);
    }
  }, [activeId, active]);

  const handleRowClick = React.useCallback(
    (row: T, index: number) => {
      setActiveId(getRowId(row, index));
    },
    [getRowId],
  );

  const handleClose = React.useCallback(() => {
    setActiveId(null);
  }, []);

  const cls = ['u-table-with-dialog', className].filter(Boolean).join(' ');

  return (
    <div className={cls}>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={getRowId}
        onRowClick={handleRowClick}
        density={density}
        {...rest}
      />

      <Modal
        open={active !== null}
        onClose={handleClose}
        size={dialogSize}
        title={active != null && dialogTitle ? dialogTitle(active) : 'Details'}
        description={active != null && dialogDescription ? dialogDescription(active) : undefined}
        footer={active != null && dialogFooter ? dialogFooter(active) : undefined}
      >
        {active != null ? renderDialog(active) : null}
      </Modal>
    </div>
  );
}

export default TableWithDialog;
