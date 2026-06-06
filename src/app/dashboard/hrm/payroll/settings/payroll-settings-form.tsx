'use client';

import { Button, useToast } from '@/components/sabcrm/20ui';
import { useActionState, useEffect, useOptimistic } from 'react';
import { useFormStatus } from 'react-dom';
import { Save, LoaderCircle } from 'lucide-react';
import { savePayrollSettings, type PayrollSettings } from '@/app/actions/crm-payroll-settings.actions';
import { PayCycleSection } from './components/pay-cycle-section';
import { StatutoryDeductionsSection } from './components/statutory-deductions-section';
import { AttendanceOvertimeSection } from './components/attendance-overtime-section';
import { ApprovalsNotificationsSection } from './components/approvals-notifications-section';

const initialState: { message?: string; error?: string; timestamp?: number } = {};

function SaveButton({ isOptimistic }: { isOptimistic: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="min-w-[140px]">
      {pending || isOptimistic ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      {pending || isOptimistic ? 'Saving...' : 'Save settings'}
    </Button>
  );
}

export function PayrollSettingsForm({ settings }: { settings: PayrollSettings }) {
  const [state, formAction] = useActionState(savePayrollSettings, initialState);
  const { toast } = useToast();
  
  // We use useOptimistic here to immediately reflect saving state 
  // before the server action completely finishes
  const [optimisticState, addOptimisticState] = useOptimistic(
    { isSaving: false },
    (state, isSaving: boolean) => ({ ...state, isSaving })
  );

  useEffect(() => {
    if (state?.message) {
      toast({ 
        title: 'Settings Saved Successfully', 
        description: state.message || 'Your payroll configuration has been updated.',
        
      });
    }
    if (state?.error) {
      toast({ 
        title: 'Failed to Save Settings', 
        description: state.error || 'Please check your inputs and try again.', 
        variant: 'destructive',
      });
    }
  }, [state, toast]);

  return (
    <form action={(formData) => {
      addOptimisticState(true);
      formAction(formData);
    }} className="flex flex-col gap-6">
      <PayCycleSection settings={settings} />
      <StatutoryDeductionsSection settings={settings} />
      <AttendanceOvertimeSection settings={settings} />
      <ApprovalsNotificationsSection settings={settings} />
      
      <div className="flex items-center justify-between sticky bottom-4 z-10 p-4 bg-[var(--st-bg-secondary)]/80 backdrop-blur-md rounded-lg border border-[var(--st-border)] shadow-sm">
        <div className="text-sm text-[var(--st-text-secondary)]">
          {optimisticState.isSaving ? 'Updating configuration...' : 'Make sure to save your changes.'}
        </div>
        <SaveButton isOptimistic={optimisticState.isSaving} />
      </div>
    </form>
  );
}
