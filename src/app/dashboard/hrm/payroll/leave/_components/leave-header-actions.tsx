'use client';

import { Button } from '@/components/sabcrm/20ui/compat';
import { CalendarDays, CalendarOff, Plus, Settings as SettingsIcon, Tags, } from 'lucide-react';

/**
 * <LeaveHeaderActions> — sticky primary-action cluster for the leave
 * list header. Owns the link group that navigates to Balance / Calendar
 * / Types / Settings plus the Apply-leave CTA.
 */

import * as React from 'react';
import Link from 'next/link';

export function LeaveHeaderActions(): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard/hrm/payroll/leave/balance">
          <CalendarOff className="h-3.5 w-3.5" /> Balance
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard/hrm/payroll/leave/calendar">
          <CalendarDays className="h-3.5 w-3.5" /> Calendar
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard/hrm/payroll/leave/types">
          <Tags className="h-3.5 w-3.5" /> Types
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href="/dashboard/hrm/payroll/leave/settings">
          <SettingsIcon className="h-3.5 w-3.5" /> Settings
        </Link>
      </Button>
      <Button size="sm" asChild>
        <Link href="/dashboard/hrm/payroll/leave/new">
          <Plus className="h-3.5 w-3.5" /> Apply leave
        </Link>
      </Button>
    </div>
  );
}
