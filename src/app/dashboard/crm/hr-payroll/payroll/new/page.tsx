/**
 * Create payroll run — `/dashboard/crm/hr-payroll/payroll/new`.
 *
 * Server component shell — the form is the shared `<PayrollRunForm>`
 * used by Edit too. No custom fields (the payroll-run entity is not
 * registered as a custom-field belongs-to target).
 */

import { Banknote } from 'lucide-react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
import { PayrollRunForm } from '../_components/payroll-run-form';

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
