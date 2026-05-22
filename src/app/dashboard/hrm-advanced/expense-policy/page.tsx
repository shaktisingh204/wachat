'use client';

import React from 'react';
import { EntityCrudPage } from '@/components/crm/entity-crud-page';
import { getExpenseClaims, saveExpenseClaim, deleteExpenseClaim } from '@/app/actions/hrm-advanced/expense-policy';
import { ExpenseClaim } from '@/lib/hrm-advanced-types';

export default function Page() {
  return (
    <EntityCrudPage<ExpenseClaim>
      title="Expense Policy Engine"
      description="Manage and approve employee expenses"
      entityName="Claim"
      fetchFn={getExpenseClaims}
      saveFn={saveExpenseClaim}
      deleteFn={deleteExpenseClaim}
      formFields={[
      { name: 'employeeId', label: 'Employee ID', type: 'text' },
      { name: 'amount', label: 'Amount', type: 'number' },
      { name: 'category', label: 'Category', type: 'text' },
      { name: 'status', label: 'Status', type: 'select', options: ['Pending', 'Approved', 'Rejected'] },
      { name: 'dateSubmitted', label: 'Date Submitted', type: 'date' }
    ]}
      columns={[
      { header: 'Employee', accessorKey: 'employeeId' },
      { header: 'Category', accessorKey: 'category' },
      { header: 'Amount', accessorKey: 'amount', render: (val) => `$${val}` },
      { header: 'Status', accessorKey: 'status' }
    ]}
      defaultValues={{ status: 'Pending', amount: 0 }}
    />
  );
}
