'use client';

import { Card, Input, Label, Switch } from '@/components/sabcrm/20ui/compat';
import { memo } from 'react';
import type { PayrollSettings } from '@/app/actions/crm-payroll-settings.actions.types';

function ApprovalsNotificationsSectionComponent({ settings }: { settings: PayrollSettings }) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-[15px] font-semibold text-[var(--st-text)]">Approvals & Notifications</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-3">
          <div>
            <div className="text-[13px] font-medium text-[var(--st-text)]">Require payroll approval</div>
            <div className="text-[11px] text-[var(--st-text-secondary)]">Payroll runs must be approved before disbursement.</div>
          </div>
          <Switch name="approvalRequired" defaultChecked={settings.approvalRequired} aria-label="Require approval" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="approverUserId">Approver User ID</Label>
          <Input id="approverUserId" name="approverUserId" defaultValue={settings.approverUserId} placeholder="User ObjectId (leave blank for owner)" />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-3">
          <div>
            <div className="text-[13px] font-medium text-[var(--st-text)]">Notify employees on payslip generation</div>
            <div className="text-[11px] text-[var(--st-text-secondary)]">Send email / push when a payslip is locked.</div>
          </div>
          <Switch name="notifyOnPayslip" defaultChecked={settings.notifyOnPayslip} aria-label="Notify on payslip" />
        </div>
      </div>
    </Card>
  );
}

export const ApprovalsNotificationsSection = memo(ApprovalsNotificationsSectionComponent);
