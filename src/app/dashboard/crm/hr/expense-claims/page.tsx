'use client';

import { Wallet } from 'lucide-react';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getExpenseClaims,
  saveExpenseClaim,
  deleteExpenseClaim,
} from '@/app/actions/hr.actions';
import type { HrExpenseClaim } from '@/lib/hr-types';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red' | 'blue'> = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  reimbursed: 'blue',
};

function formatDate(value: unknown): React.ReactNode {
  if (!value) return <span className="text-clay-ink-muted">—</span>;
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return <span className="text-clay-ink-muted">—</span>;
  return d.toISOString().slice(0, 10);
}

export default function ExpenseClaimsPage() {
  return (
    <HrEntityPage<HrExpenseClaim & { _id: string }>
      title="Expense Claims"
      subtitle="Reimbursement requests from employees."
      icon={Wallet}
      singular="Expense Claim"
      getAllAction={getExpenseClaims as any}
      saveAction={saveExpenseClaim}
      deleteAction={deleteExpenseClaim}
      columns={[
        { key: 'title', label: 'Title' },
        {
          key: 'amount',
          label: 'Amount',
          render: (row) => (
            <span>
              {row.amount} {row.currency || ''}
            </span>
          ),
        },
        {
          key: 'incurredAt',
          label: 'Incurred',
          render: (row) => formatDate(row.incurredAt),
        },
        { key: 'category', label: 'Category' },
        {
          key: 'status',
          label: 'Status',
          render: (row) => (
            <ClayBadge tone={STATUS_TONES[row.status] || 'neutral'} dot>
              {row.status}
            </ClayBadge>
          ),
        },
      ]}
      fields={[
        { name: 'employeeId', label: 'Employee ID', required: true },
        { name: 'title', label: 'Title', required: true, fullWidth: true },
        { name: 'amount', label: 'Amount', type: 'number', required: true },
        { name: 'currency', label: 'Currency', defaultValue: 'INR' },
        { name: 'category', label: 'Category' },
        { name: 'incurredAt', label: 'Incurred At', type: 'date', required: true },
        { name: 'receiptUrl', label: 'Receipt URL' },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          options: [
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'reimbursed', label: 'Reimbursed' },
          ],
          defaultValue: 'pending',
        },
      ]}
    />
  );
}
