'use client';

import { Wallet } from 'lucide-react';
import { fmtDate, fmtINR } from '@/lib/utils';
import { ClayBadge, HrEntityPage } from '../_components/hr-entity-page';
import {
  getExpenseClaims,
  saveExpenseClaim,
  deleteExpenseClaim,
} from '@/app/actions/hr.actions';
import type { HrExpenseClaim } from '@/lib/hr-types';
import { fields } from './_config';

const STATUS_TONES: Record<string, 'neutral' | 'green' | 'amber' | 'red' | 'blue'> = {
  pending: 'amber',
  approved: 'green',
  rejected: 'red',
  reimbursed: 'blue',
};



export default function ExpenseClaimsPage() {
  return (
    <HrEntityPage<HrExpenseClaim & { _id: string }>
      title="Expense Claims"
      subtitle="Reimbursement requests from employees."
      icon={Wallet}
      singular="Claim"
      basePath="/dashboard/hrm/hr/expense-claims"
      rowLinksToDetail
      getAllAction={getExpenseClaims as any}
      saveAction={saveExpenseClaim}
      deleteAction={deleteExpenseClaim}
      kpis={[
        {
          label: 'Pending',
          compute: (rows) =>
            rows.filter((r) => String((r as any).status || 'pending') === 'pending').length,
          tone: 'amber',
        },
        {
          label: 'Approved',
          compute: (rows) =>
            rows.filter((r) => String((r as any).status) === 'approved').length,
          tone: 'green',
        },
        {
          label: 'Reimbursed',
          compute: (rows) =>
            rows.filter((r) => String((r as any).status) === 'reimbursed').length,
          tone: 'blue',
        },
        {
          label: 'Total claimed',
          compute: (rows) => {
            const total = rows.reduce(
              (a, r) => a + (Number((r as any).amount) || 0),
              0,
            );
            if (!total) return '—';
            return fmtINR(total, 'INR');
          },
        },
        {
          label: 'Avg claim',
          compute: (rows) => {
            if (rows.length === 0) return '—';
            const total = rows.reduce(
              (a, r) => a + (Number((r as any).amount) || 0),
              0,
            );
            if (!total) return '—';
            return fmtINR(total / rows.length, 'INR');
          },
        },
      ]}
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
          render: (row) => fmtDate(row.incurredAt),
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
      fields={fields}
    />
  );
}
