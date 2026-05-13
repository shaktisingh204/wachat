/**
 * Create payroll run — `/dashboard/hrm/payroll/payroll/new` (canonical).
 *
 * Server-component shell — the form is the shared `<PayrollRunForm>`
 * used by Edit too. Action: `savePayrollRunAction` (Rust client),
 * redirects to the canonical run-detail page on success. No custom
 * fields — `'payrollRun'` is not a registered `WsCustomFieldBelongsTo`
 * target.
 */

import { Banknote } from 'lucide-react';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';
import { PayrollRunForm } from '@/app/dashboard/crm/hr-payroll/payroll/_components/payroll-run-form';

export const dynamic = 'force-dynamic';

export default function NewPayrollRunPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New payroll run"
        subtitle="Define the pay period — compute, approve, and disburse it from the run detail page."
        icon={Banknote}
      />
      <PayrollRunForm />
    </div>
  );
}
