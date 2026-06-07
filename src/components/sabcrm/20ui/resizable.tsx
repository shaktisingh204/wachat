'use client';

/**
 * 20ui — Resizable split panels.
 *
 * A token-skinned wrapper around `react-resizable-panels` (v4). The library owns
 * the hard parts: pointer + keyboard resizing, min/max constraints, collapsing,
 * the WAI-ARIA `separator` wiring (`role`, `aria-orientation`, `aria-valuenow`,
 * `tabIndex`, `aria-controls`), and layout persistence. 20ui supplies the look —
 * a hairline divider that grows an accent track on hover / drag / keyboard focus,
 * plus an optional grip dot, with the correct treatment for both horizontal and
 * vertical groups.
 *
 * v4 API mapping (the names below mirror the older Ui20/shadcn surface so call
 * sites read the same, but they wrap the v4 primitives):
 *   - ResizablePanelGroup  ->  Group      (sets `orientation`; renders `data-group`)
 *   - ResizablePanel       ->  Panel
 *   - ResizableHandle      ->  Separator  (renders `role="separator"`, `aria-orientation`)
 *
 * Orientation note: the library gives a Separator the OPPOSITE `aria-orientation`
 * to its Group, since the divider line runs across the resize axis. So a
 * `orientation="horizontal"` group (panels left/right) yields separators with
 * `aria-orientation="vertical"` (a vertical line) — the CSS keys off that.
 *
 *   <ResizablePanelGroup orientation="horizontal">
 *     <ResizablePanel defaultSize="40%" minSize="20%">Sidebar</ResizablePanel>
 *     <ResizableHandle withHandle />
 *     <ResizablePanel>Detail</ResizablePanel>
 *   </ResizablePanelGroup>
 */

import * as React from 'react';
import { GripVertical } from 'lucide-react';
import {
  Group as RrpGroup,
  Panel as RrpPanel,
  Separator as RrpSeparator,
  type GroupProps,
  type PanelProps,
  type SeparatorProps,
} from 'react-resizable-panels';

import './resizable.css';

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * The group container. Wraps `Group`; defaults to a horizontal split. Spreads
 * the rest onto the underlying `<div data-group>` and merges `className`.
 */
export function ResizablePanelGroup({
  className,
  orientation = 'horizontal',
  ...rest
}: GroupProps): React.JSX.Element {
  return (
    <RrpGroup
      orientation={orientation}
      className={cx('u-resizable', className)}
      {...rest}
    />
  );
}

/**
 * A single resizable region. Thin pass-through over `Panel` (the library applies
 * the caller `className` to its inner flex child, so we forward it untouched) so
 * all of `minSize` / `maxSize` / `defaultSize` / `collapsible` / `panelRef` work.
 */
export function ResizablePanel({
  className,
  ...rest
}: PanelProps): React.JSX.Element {
  return <RrpPanel className={cx('u-resizable__panel', className)} {...rest} />;
}

export interface ResizableHandleProps extends SeparatorProps {
  /** Render a centred grip pill on the divider for a clearer drag affordance. */
  withHandle?: boolean;
}

/**
 * The draggable divider between two panels. Wraps `Separator`, which already
 * carries the full `role="separator"` ARIA contract and keyboard resizing, so we
 * only add presentation: a hit-area hairline, an accent track on
 * hover / drag / keyboard focus (driven by the library's `data-separator` state),
 * and an optional grip. The grip auto-rotates for vertical groups.
 */
export function ResizableHandle({
  withHandle = false,
  className,
  ...rest
}: ResizableHandleProps): React.JSX.Element {
  return (
    <RrpSeparator
      className={cx(
        'u-resizable__handle',
        withHandle && 'u-resizable__handle--grip',
        className,
      )}
      {...rest}
    >
      {withHandle ? (
        <span className="u-resizable__grip" aria-hidden="true">
          <GripVertical size={12} className="u-resizable__grip-icon" />
        </span>
      ) : null}
    </RrpSeparator>
  );
}

export default ResizablePanelGroup;
