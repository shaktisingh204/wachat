'use client';

import { Card, Input, Label, Switch } from '@/components/zoruui';
import { memo } from 'react';
import type { PayrollSettings } from '@/app/actions/crm-payroll-settings.actions.types';

function StatutoryDeductionsSectionComponent({ settings }: { settings: PayrollSettings }) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-[15px] font-semibold text-zoru-ink">Statutory Deductions</h2>
      <div className="space-y-6">
        {/* PF */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[13px] font-medium text-zoru-ink">Provident Fund (PF)</span>
              <p className="text-[11px] text-zoru-ink-muted">Employee + employer contribution under EPF Act</p>
            </div>
            <Switch name="pfEnabled" defaultChecked={settings.pfEnabled} aria-label="Enable PF" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="pfEmployeeRate">Employee Rate (%)</Label>
              <Input id="pfEmployeeRate" name="pfEmployeeRate" type="number" min="0" max="100" step="0.01" defaultValue={settings.pfEmployeeRate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pfEmployerRate">Employer Rate (%)</Label>
              <Input id="pfEmployerRate" name="pfEmployerRate" type="number" min="0" max="100" step="0.01" defaultValue={settings.pfEmployerRate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pfWageCeiling">Wage Ceiling (₹)</Label>
              <Input id="pfWageCeiling" name="pfWageCeiling" type="number" min="0" defaultValue={settings.pfWageCeiling} />
            </div>
          </div>
        </div>

        {/* ESI */}
        <div className="space-y-3 border-t border-zoru-line pt-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[13px] font-medium text-zoru-ink">ESI (ESIC)</span>
              <p className="text-[11px] text-zoru-ink-muted">Employees' State Insurance contribution</p>
            </div>
            <Switch name="esiEnabled" defaultChecked={settings.esiEnabled} aria-label="Enable ESI" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="esiEmployeeRate">Employee Rate (%)</Label>
              <Input id="esiEmployeeRate" name="esiEmployeeRate" type="number" min="0" max="100" step="0.01" defaultValue={settings.esiEmployeeRate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="esiEmployerRate">Employer Rate (%)</Label>
              <Input id="esiEmployerRate" name="esiEmployerRate" type="number" min="0" max="100" step="0.01" defaultValue={settings.esiEmployerRate} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="esiWageCeiling">Wage Ceiling (₹)</Label>
              <Input id="esiWageCeiling" name="esiWageCeiling" type="number" min="0" defaultValue={settings.esiWageCeiling} />
            </div>
          </div>
        </div>

        {/* PT + TDS toggles */}
        <div className="grid gap-4 border-t border-zoru-line pt-5 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-zoru-ink">Professional Tax (PT)</div>
              <div className="text-[11px] text-zoru-ink-muted">State-level professional tax deduction</div>
            </div>
            <Switch name="ptEnabled" defaultChecked={settings.ptEnabled} aria-label="Enable PT" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-zoru-ink">TDS (Section 192)</div>
              <div className="text-[11px] text-zoru-ink-muted">Tax deducted at source on salary</div>
            </div>
            <Switch name="tdsEnabled" defaultChecked={settings.tdsEnabled} aria-label="Enable TDS" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export const StatutoryDeductionsSection = memo(StatutoryDeductionsSectionComponent);
