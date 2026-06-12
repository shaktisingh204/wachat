/**
 * SabCRM Finance — Expense-claim detail (`/sabcrm/finance/expenses/[id]`).
 *
 * Server entry: fetches the claim and (when the employee is a real CRM
 * person record) the resolved employee contact in parallel, then hands
 * everything to the detail client. The claim has no line items or
 * lineage — the detail surface is a focused approval view (status rail,
 * claim fields, SabFiles receipt, approver audit).
 */

import * as React from 'react';

import { getSabcrmExpenseFull } from '@/app/actions/sabcrm-finance-expenses.actions';
import { getSabcrmFinancePartyContact } from '@/app/actions/sabcrm-finance-invoices.actions';
import { ExpenseDetailClient } from './expense-detail-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Expense claim — SabCRM Finance',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

const isRecordId = (s: string): boolean => /^[0-9a-fA-F]{24}$/.test(s);

export default async function SabcrmFinanceExpenseDetailPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;

  const claimRes = await getSabcrmExpenseFull(id);
  if (!claimRes.ok) {
    return (
      <ExpenseDetailClient claim={null} employee={null} error={claimRes.error} />
    );
  }

  const employeeId = claimRes.data.employee_id;
  const contactRes = isRecordId(employeeId)
    ? await getSabcrmFinancePartyContact(employeeId)
    : null;

  return (
    <ExpenseDetailClient
      claim={claimRes.data}
      employee={contactRes?.ok ? contactRes.data : null}
      error={null}
    />
  );
}
