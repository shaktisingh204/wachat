/**
 * Bank Transactions list — `/dashboard/crm/banking/bank-transactions`
 *
 * Server component. Pre-fetches KPIs + initial rows, passes them to
 * `<BankTransactionsListClient>` which owns all interactive state
 * (filters, checkboxes, bulk actions, export).
 */

import Link from 'next/link';
import { Plus } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getCrmBankTransactions,
  getCrmBankTransactionListKpis,
} from '@/app/actions/crm-bank-transactions.actions';
import { BankTransactionsListClient } from './_components/bank-transactions-list-client';

export const dynamic = 'force-dynamic';

interface SearchParams {
  q?: string;
  status?: string;
  type?: string;
  accountId?: string;
  from?: string;
  to?: string;
}

export default async function BankTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const status = (sp.status ?? '').trim();
  const type = (sp.type ?? '').trim();
  const accountId = (sp.accountId ?? '').trim();
  const from = (sp.from ?? '').trim();
  const to = (sp.to ?? '').trim();

  const [{ items, total }, kpis] = await Promise.all([
    getCrmBankTransactions({
      q: q || undefined,
      status: status ? (status as 'pending' | 'cleared' | 'reconciled' | 'archived') : undefined,
      type: type ? (type as 'debit' | 'credit') : undefined,
      accountId: accountId || undefined,
      from: from || undefined,
      to: to || undefined,
      limit: 500,
    }),
    getCrmBankTransactionListKpis(),
  ]);

  return (
    <EntityListShell
      title="Bank Transactions"
      subtitle="Extended ledger — deposits, withdrawals, transfers. Auto-populated by payments and refunds."
      primaryAction={
        <Button asChild>
          <Link href="/dashboard/crm/banking/bank-transactions/new">
            <Plus className="h-4 w-4" />
            Add transaction
          </Link>
        </Button>
      }
    >
      <BankTransactionsListClient
        initialRows={items}
        initialTotal={total}
        kpis={kpis}
        initialQuery={q}
        initialStatus={status}
        initialType={type}
        initialAccountId={accountId}
        initialFrom={from}
        initialTo={to}
      />
    </EntityListShell>
  );
}
