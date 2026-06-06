import { Table, TBody, Td, Th, THead, Tr, Badge } from '@/components/sabcrm/20ui';
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
    <div className="border border-[var(--st-border)] rounded-md bg-[var(--st-bg-secondary)]/50 overflow-hidden shadow-[var(--st-shadow-sm)]">
      <Table>
        <THead>
          <Tr>
            <Th className="text-[var(--st-text-secondary)]">Date</Th>
            <Th className="text-[var(--st-text-secondary)]">Description</Th>
            <Th className="text-[var(--st-text-secondary)]">Amount</Th>
            <Th className="text-[var(--st-text-secondary)]">Type</Th>
            <Th className="text-[var(--st-text-secondary)]">Status</Th>
          </Tr>
        </THead>
        <TBody className={isLoading ? "opacity-50 transition-opacity" : "transition-opacity"}>
          {transactions.length > 0 ? (
            transactions.map(t => (
              <Tr key={t._id.toString()}>
                <Td className="text-[var(--st-text)] whitespace-nowrap">{format(new Date(t.createdAt), 'PPpp')}</Td>
                <Td className="text-[var(--st-text)]">{t.reason}</Td>
                <Td className="text-[var(--st-text)] font-semibold whitespace-nowrap">₹{(t.amount / 100).toFixed(2)}</Td>
                <Td>
                  <Badge variant={t.type === 'CREDIT' ? 'default' : 'secondary'}>
                    {t.type}
                  </Badge>
                </Td>
                <Td><Badge variant={getStatusVariant(t.status)}>{t.status}</Badge></Td>
              </Tr>
            ))
          ) : (
            <Tr>
              <Td colSpan={5} className="h-48 text-center">
                <div className="flex flex-col items-center gap-4">
                  <Receipt className="h-12 w-12 text-[var(--st-text-secondary)]" />
                  <p className="text-[var(--st-text-secondary)]">No transactions found.</p>
                </div>
              </Td>
            </Tr>
          )}
        </TBody>
      </Table>
    </div>
  );
}
