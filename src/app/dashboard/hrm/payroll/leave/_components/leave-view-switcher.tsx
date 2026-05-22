'use client';

import { Button } from '@/components/zoruui';
import { CalendarDays, List as ListIcon } from 'lucide-react';

/**
 * <LeaveViewSwitcher> — small table/calendar toggle for the leave list
 * header. Mirrors the §1D pattern used in the invoices list.
 */

import * as React from 'react';

import type { LeaveViewMode } from './types';

interface LeaveViewSwitcherProps {
  view: LeaveViewMode;
  onChange: (next: LeaveViewMode) => void;
}

export function LeaveViewSwitcher({
  view,
  onChange,
}: LeaveViewSwitcherProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-1 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-0.5">
      <Button
        type="button"
        size="sm"
        variant={view === 'table' ? 'default' : 'ghost'}
        onClick={() => onChange('table')}
        aria-pressed={view === 'table'}
        aria-label="Table view"
      >
        <ListIcon className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={view === 'calendar' ? 'default' : 'ghost'}
        onClick={() => onChange('calendar')}
        aria-pressed={view === 'calendar'}
        aria-label="Calendar view"
      >
        <CalendarDays className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
