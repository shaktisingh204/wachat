import {
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruBadge,
} from '@/components/sabcrm/20ui/compat';
import { Receipt } from 'lucide-react';
import type { WalletTransaction } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { format } from 'date-fns';
import { useId } from 'react';

interface TransactionTableProps {
  transactions: WithId<WalletTransaction>[];
  isLoading: boolean;
}

export function TransactionTable({ transactions, isLoading }: TransactionTableProps) {
  const tableId = useId();

  const getStatusVariant = (status: string) => {
    if (status === 'SUCCESS') return 'default';
    if (status === 'PENDING') return 'secondary';
    return 'destructive';
  }

  return (
    <div className="border border-[var(--st-border)] rounded-md bg-[var(--st-bg-secondary)]/50 overflow-hidden shadow-[var(--zoru-shadow-sm)]">
      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead className="text-[var(--st-text-secondary)]">Date</ZoruTableHead>
            <ZoruTableHead className="text-[var(--st-text-secondary)]">Description</ZoruTableHead>
            <ZoruTableHead className="text-[var(--st-text-secondary)]">Amount</ZoruTableHead>
            <ZoruTableHead className="text-[var(--st-text-secondary)]">Type</ZoruTableHead>
            <ZoruTableHead className="text-[var(--st-text-secondary)]">Status</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody className={isLoading ? "opacity-50 transition-opacity" : "transition-opacity"}>
          {transactions.length > 0 ? (
            transactions.map(t => (
              <ZoruTableRow key={t._id.toString()}>
                <ZoruTableCell className="text-[var(--st-text)] whitespace-nowrap">{format(new Date(t.createdAt), 'PPpp')}</ZoruTableCell>
                <ZoruTableCell className="text-[var(--st-text)]">{t.reason}</ZoruTableCell>
                <ZoruTableCell className="text-[var(--st-text)] font-semibold whitespace-nowrap">₹{(t.amount / 100).toFixed(2)}</ZoruTableCell>
                <ZoruTableCell>
                  <ZoruBadge variant={t.type === 'CREDIT' ? 'default' : 'secondary'}>
                    {t.type}
                  </ZoruBadge>
                </ZoruTableCell>
                <ZoruTableCell><ZoruBadge variant={getStatusVariant(t.status)}>{t.status}</ZoruBadge></ZoruTableCell>
              </ZoruTableRow>
            ))
          ) : (
            <ZoruTableRow>
              <ZoruTableCell colSpan={5} className="h-48 text-center">
                <div className="flex flex-col items-center gap-4">
                  <Receipt className="h-12 w-12 text-[var(--st-text-secondary)]" />
                  <p className="text-[var(--st-text-secondary)]">No transactions found.</p>
                </div>
              </ZoruTableCell>
            </ZoruTableRow>
          )}
        </ZoruTableBody>
      </ZoruTable>
    </div>
  );
}
