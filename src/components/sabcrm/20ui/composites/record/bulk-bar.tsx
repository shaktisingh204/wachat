'use client';

/**
 * BulkBar — the floating selection-actions bar for {@link RecordGrid}.
 *
 * Appears (bottom-center, elevated) while a selection is non-empty: shows the
 * count, a slot for action buttons (`children`), and a clear button. Renders
 * nothing when `count` is 0, so callers can mount it unconditionally.
 *
 * Tokens only; styles live in record-grid.css under the `.rg-bulkbar-*`
 * classes (scoped to the 20ui roots).
 */

import * as React from 'react';
import { X } from 'lucide-react';

import { IconButton } from '../../button';
import { cn } from '../lib/cn';

import './record-grid.css';

export interface BulkBarProps {
  /** Number of selected records. The bar hides itself when 0. */
  count: number;
  /** Clears the selection (wired to the trailing X button). */
  onClear: () => void;
  /** Action buttons (e.g. Delete, Export, Assign). */
  children?: React.ReactNode;
  /** Noun for the count line; defaults to "selected". */
  label?: string;
  className?: string;
}

export function BulkBar({
  count,
  onClear,
  children,
  label = 'selected',
  className,
}: BulkBarProps): React.JSX.Element | null {
  if (count <= 0) return null;

  return (
    <div
      className={cn('rg-bulkbar', className)}
      role="toolbar"
      aria-label="Bulk actions"
    >
      <span className="rg-bulkbar-count" aria-live="polite">
        {count} {label}
      </span>
      {children ? <div className="rg-bulkbar-actions">{children}</div> : null}
      <IconButton
        label="Clear selection"
        icon={X}
        variant="ghost"
        size="sm"
        onClick={onClear}
      />
    </div>
  );
}

export default BulkBar;
