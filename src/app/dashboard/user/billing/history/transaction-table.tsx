import { Table, TBody, Td, Th, THead, Tr, Badge, EmptyState, type BadgeTone } from '@/components/sabcrm/20ui';
import { Receipt } from 'lucide-react';
import type { WalletTransaction } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { format } from 'date-fns';

interface TransactionTableProps {
  transactions: WithId<WalletTransaction>[];
  isLoading: boolean;
}

export function TransactionTable({ transactions, isLoading }: TransactionTableProps) {
  const getStatusTone = (status: string): BadgeTone => {
    if (status === 'SUCCESS') return 'success';
    if (status === 'PENDING') return 'warning';
    return 'danger';
  };

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={Receipt}
        title="No transactions found"
        description="Adjust your filters or check back after your next purchase."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
      <Table>
        <THead>
          <Tr>
            <Th>Date</Th>
            <Th>Description</Th>
            <Th>Amount</Th>
            <Th>Type</Th>
            <Th>Status</Th>
          </Tr>
        </THead>
        <TBody className={isLoading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
          {transactions.map((t) => (
            <Tr key={t._id.toString()}>
              <Td className="whitespace-nowrap">{format(new Date(t.createdAt), 'PPpp')}</Td>
              <Td>{t.reason}</Td>
              <Td className="whitespace-nowrap font-semibold">₹{(t.amount / 100).toFixed(2)}</Td>
              <Td>
                <Badge tone={t.type === 'CREDIT' ? 'accent' : 'neutral'}>{t.type}</Badge>
              </Td>
              <Td>
                <Badge tone={getStatusTone(t.status)}>{t.status}</Badge>
              </Td>
            </Tr>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
