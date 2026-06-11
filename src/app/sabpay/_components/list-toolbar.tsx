'use client';

import * as React from 'react';

export interface ListToolbarProps {
  /** Left slot — typically a `<SegmentedControl>` status filter. */
  left?: React.ReactNode;
  /** Alias for `left` so the filter can be passed as children instead. */
  children?: React.ReactNode;
  /** Right slot — actions (e.g. an Export button + the primary "Create …"). */
  actions?: React.ReactNode;
}

/**
 * The list-page header row every SabPay entity list shares: filter on the
 * left, actions on the right, wrapping gracefully on narrow widths. Matches
 * the flex row from `payments-client.tsx`.
 */
export function ListToolbar({ left, children, actions }: ListToolbarProps): React.JSX.Element {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
        {left ?? children}
      </div>
      {actions ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
