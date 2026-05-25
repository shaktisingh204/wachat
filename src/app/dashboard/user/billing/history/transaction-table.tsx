import {
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruBadge,
} from '@/components/zoruui';
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
    <div className="border border-zoru-line rounded-md bg-zoru-surface/50 overflow-hidden shadow-[var(--zoru-shadow-sm)]">
      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead className="text-zoru-ink-muted">Date</ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted">Description</ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted">Amount</ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted">Type</ZoruTableHead>
            <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody className={isLoading ? "opacity-50 transition-opacity" : "transition-opacity"}>
          {transactions.length > 0 ? (
            transactions.map(t => (
              <ZoruTableRow key={t._id.toString()}>
                <ZoruTableCell className="text-zoru-ink whitespace-nowrap">{format(new Date(t.createdAt), 'PPpp')}</ZoruTableCell>
                <ZoruTableCell className="text-zoru-ink">{t.reason}</ZoruTableCell>
                <ZoruTableCell className="text-zoru-ink font-semibold whitespace-nowrap">₹{(t.amount / 100).toFixed(2)}</ZoruTableCell>
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
                  <Receipt className="h-12 w-12 text-zoru-ink-muted" />
                  <p className="text-zoru-ink-muted">No transactions found.</p>
                </div>
              </ZoruTableCell>
            </ZoruTableRow>
          )}
        </ZoruTableBody>
      </ZoruTable>
    </div>
  );
}
