'use client';

import { Wallet } from 'lucide-react';
import { HrFormPage } from '../../_components/hr-form-page';
import { saveExpenseClaim } from '@/app/actions/hr.actions';
import { fields, sections } from '../_config';

export default function NewExpenseClaimPage() {
  return (
    <HrFormPage
      title="New Expense Claim"
      subtitle="Submit a reimbursement request."
      icon={Wallet}
      backHref="/dashboard/hrm/hr/expense-claims"
      singular="Claim"
      fields={fields}
      sections={sections}
      saveAction={saveExpenseClaim}
    />
  );
}
