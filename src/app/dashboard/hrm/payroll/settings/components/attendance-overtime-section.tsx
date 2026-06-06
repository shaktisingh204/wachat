'use client';

import { Card, Input, Label, Switch } from '@/components/sabcrm/20ui';
import { memo } from 'react';
import type { PayrollSettings } from '@/app/actions/crm-payroll-settings.actions.types';

function AttendanceOvertimeSectionComponent({ settings }: { settings: PayrollSettings }) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-[15px] font-semibold text-[var(--st-text)]">Attendance & Overtime</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="lateMarkingGraceMins">Late-marking Grace (minutes)</Label>
          <Input id="lateMarkingGraceMins" name="lateMarkingGraceMins" type="number" min="0" max="120" defaultValue={settings.lateMarkingGraceMins} />
          <p className="text-[11px] text-[var(--st-text-secondary)]">Employees arriving within this window are not marked late.</p>
        </div>
        <div className="flex items-center gap-4 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-3">
          <div className="flex-1">
            <div className="text-[13px] font-medium text-[var(--st-text)]">Overtime Tracking</div>
            <div className="text-[11px] text-[var(--st-text-secondary)]">Track and pay hours beyond the standard shift.</div>
          </div>
          <Switch name="overtimeEnabled" defaultChecked={settings.overtimeEnabled} aria-label="Enable overtime" />
        </div>
      </div>
    </Card>
  );
}

export const AttendanceOvertimeSection = memo(AttendanceOvertimeSectionComponent);
