'use client';

import { Card, Input, Label } from '@/components/zoruui';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { memo } from 'react';
import type { PayrollSettings } from '@/app/actions/crm-payroll-settings.actions.types';

function PayCycleSectionComponent({ settings }: { settings: PayrollSettings }) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-[15px] font-semibold text-zoru-ink">Pay Cycle</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="payFrequency">Pay Frequency</Label>
          <EnumFormField
            name="payFrequency"
            enumName="payFrequency"
            initialId={settings.payFrequency}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="currency">Currency</Label>
          <EnumFormField
            name="currency"
            enumName="payrollCurrency"
            initialId={settings.currency}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="taxRegime">Tax Regime</Label>
          <EnumFormField
            name="taxRegime"
            enumName="taxRegime"
            initialId={settings.taxRegime}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="workingDaysPerWeek">Working Days / Week</Label>
          <Input
            id="workingDaysPerWeek"
            name="workingDaysPerWeek"
            type="number"
            min="1" max="7"
            defaultValue={settings.workingDaysPerWeek}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="payslipTemplate">Payslip Template</Label>
          <EnumFormField
            name="payslipTemplate"
            enumName="payslipTemplate"
            initialId={settings.payslipTemplate}
          />
        </div>
      </div>
    </Card>
  );
}

export const PayCycleSection = memo(PayCycleSectionComponent);
