'use client';

import { Button, useZoruToast } from '@/components/zoruui';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { Save, LoaderCircle } from 'lucide-react';
import { savePayrollSettings, type PayrollSettings } from '@/app/actions/crm-payroll-settings.actions';
import { PayCycleSection } from './components/pay-cycle-section';
import { StatutoryDeductionsSection } from './components/statutory-deductions-section';
import { AttendanceOvertimeSection } from './components/attendance-overtime-section';
import { ApprovalsNotificationsSection } from './components/approvals-notifications-section';

const initialState: { message?: string; error?: string } = {};

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-w-[140px]">
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      {pending ? 'Saving...' : 'Save settings'}
    </Button>
  );
}

export function PayrollSettingsForm({ settings }: { settings: PayrollSettings }) {
  const [state, formAction] = useActionState(savePayrollSettings, initialState);
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state?.message) {
      toast({ 
        title: 'Settings Saved Successfully', 
        description: state.message,
      });
    }
    if (state?.error) {
      toast({ 
        title: 'Failed to Save Settings', 
        description: state.error, 
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <PayCycleSection settings={settings} />
      <StatutoryDeductionsSection settings={settings} />
      <AttendanceOvertimeSection settings={settings} />
      <ApprovalsNotificationsSection settings={settings} />
      <div className="flex justify-end sticky bottom-4 z-10 p-4 bg-zoru-surface/80 backdrop-blur-md rounded-lg border border-zoru-line shadow-sm">
        <SaveButton />
      </div>
    </form>
  );
}
