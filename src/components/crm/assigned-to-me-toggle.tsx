'use client';

/**
 * <AssignedToMeToggle />
 *
 * Small filter chip that toggles "Show only items assigned to me".
 * Resolves the current user's employee id once via `getMyEmployeeId()`
 * and exposes it (or `null`) via the `onToggle` callback. List pages
 * then filter their already-loaded rows client-side — no extra query.
 *
 * Pages that don't want a callback can read `data-active` off the
 * button for styling.
 */

import * as React from 'react';
import { UserCheck } from 'lucide-react';
import { Button, Badge, cn } from '@/components/zoruui';
import { getMyEmployeeId } from '@/app/actions/crm-assignment.actions';

export interface AssignedToMeToggleProps {
  /** Called with the user's employee id when active, or `null` when off. */
  onToggle: (myEmployeeId: string | null) => void;
  /** Optional count badge — e.g. number of "my" rows visible right now. */
  count?: number;
  /** Initial state. */
  defaultActive?: boolean;
  className?: string;
}

export function AssignedToMeToggle({
  onToggle,
  count,
  defaultActive = false,
  className,
}: AssignedToMeToggleProps) {
  const [active, setActive] = React.useState(defaultActive);
  const [myId, setMyId] = React.useState<string | null>(null);
  const [resolved, setResolved] = React.useState(false);

  // Resolve the current user's employee id once.
  React.useEffect(() => {
    let cancelled = false;
    void getMyEmployeeId().then((id) => {
      if (cancelled) return;
      setMyId(id);
      setResolved(true);
      if (defaultActive) onToggle(id);
    });
    return () => {
      cancelled = true;
    };
    // We deliberately don't depend on `onToggle` / `defaultActive` to
    // avoid re-resolving on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClick = React.useCallback(() => {
    const next = !active;
    setActive(next);
    onToggle(next ? myId : null);
  }, [active, myId, onToggle]);

  // Hide entirely when the user has no employee record — the filter
  // would always return zero rows.
  if (resolved && !myId) return null;

  return (
    <ZoruButton
      type="button"
      variant={active ? 'default' : 'outline'}
      size="sm"
      onClick={handleClick}
      data-active={active}
      className={cn('h-9 text-[13px]', className)}
    >
      <UserCheck className="mr-1.5 h-3.5 w-3.5" />
      Assigned to me
      {active && typeof count === 'number' ? (
        <ZoruBadge variant="ghost" className="ml-2">
          {count}
        </ZoruBadge>
      ) : null}
    </ZoruButton>
  );
}

export default AssignedToMeToggle;
