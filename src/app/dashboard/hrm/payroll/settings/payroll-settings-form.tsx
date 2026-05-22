'use client';

import { Button, Card, Input, Label, Switch, useZoruToast } from '@/components/zoruui';
import {
  useActionState,
  useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Save,
  LoaderCircle } from 'lucide-react';

import { EnumFormField } from '@/components/crm/enum-form-field';
import { savePayrollSettings, type PayrollSettings } from '@/app/actions/crm-payroll-settings.actions';

const initialState: { message?: string; error?: string } = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      Save settings
    </Button>
  );
}

export function PayrollSettingsForm({ settings }: { settings: PayrollSettings }) {
  const [state, formAction] = useActionState(savePayrollSettings, initialState);
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state?.message) toast({ title: 'Saved', description: state.message });
    if (state?.error) toast({ title: 'Error', description: state.error, variant: 'destructive' });
  }, [state, toast]);

  return (
    <form action={formAction} className="flex flex-col gap-6">

      {/* ── Pay Cycle ── */}
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

      {/* ── Statutory Deductions ── */}
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

      {/* ── Attendance & OT ── */}
      <Card className="p-6">
        <h2 className="mb-4 text-[15px] font-semibold text-zoru-ink">Attendance & Overtime</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="lateMarkingGraceMins">Late-marking Grace (minutes)</Label>
            <Input id="lateMarkingGraceMins" name="lateMarkingGraceMins" type="number" min="0" max="120" defaultValue={settings.lateMarkingGraceMins} />
            <p className="text-[11px] text-zoru-ink-muted">Employees arriving within this window are not marked late.</p>
          </div>
          <div className="flex items-center gap-4 rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
            <div className="flex-1">
              <div className="text-[13px] font-medium text-zoru-ink">Overtime Tracking</div>
              <div className="text-[11px] text-zoru-ink-muted">Track and pay hours beyond the standard shift.</div>
            </div>
            <Switch name="overtimeEnabled" defaultChecked={settings.overtimeEnabled} aria-label="Enable overtime" />
          </div>
        </div>
      </Card>

      {/* ── Approvals & Notifications ── */}
      <Card className="p-6">
        <h2 className="mb-4 text-[15px] font-semibold text-zoru-ink">Approvals & Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-zoru-ink">Require payroll approval</div>
              <div className="text-[11px] text-zoru-ink-muted">Payroll runs must be approved before disbursement.</div>
            </div>
            <Switch name="approvalRequired" defaultChecked={settings.approvalRequired} aria-label="Require approval" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="approverUserId">Approver User ID</Label>
            <Input id="approverUserId" name="approverUserId" defaultValue={settings.approverUserId} placeholder="User ObjectId (leave blank for owner)" />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-zoru-line bg-zoru-bg px-4 py-3">
            <div>
              <div className="text-[13px] font-medium text-zoru-ink">Notify employees on payslip generation</div>
              <div className="text-[11px] text-zoru-ink-muted">Send email / push when a payslip is locked.</div>
            </div>
            <Switch name="notifyOnPayslip" defaultChecked={settings.notifyOnPayslip} aria-label="Notify on payslip" />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <SaveButton />
      </div>
    </form>
  );
}
