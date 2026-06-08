import {
  Table,
  TBody,
  TCaption,
  Td,
  Th,
  THead,
  Tr,
  Badge,
  EmptyState,
  Button,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { Receipt, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { WalletTransaction } from '@/lib/definitions';
import type { WithId } from 'mongodb';
import { format } from 'date-fns';

interface TransactionTableProps {
  transactions: WithId<WalletTransaction>[];
  isLoading: boolean;
  /** Optional: render a "Clear filters" action in the empty state. */
  onClearFilters?: () => void;
  filtersActive?: boolean;
}

export function TransactionTable({
  transactions,
  isLoading,
  onClearFilters,
  filtersActive,
}: TransactionTableProps) {
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
        description={
          filtersActive
            ? 'No transactions match your filters. Try clearing them to see everything.'
            : 'Your wallet top-ups and plan purchases will appear here.'
        }
        action={
          filtersActive && onClearFilters ? (
            <Button variant="outline" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)]">
      <Table>
        <TCaption className="sr-only">
          List of wallet transactions with date, description, amount, type, and status.
        </TCaption>
        <THead>
          <Tr>
            <Th>Date</Th>
            <Th>Description</Th>
            <Th align="right">Amount</Th>
            <Th>Type</Th>
            <Th>Status</Th>
          </Tr>
        </THead>
        <TBody className={isLoading ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
          {transactions.map((t) => {
            const isCredit = t.type === 'CREDIT';
            return (
              <Tr key={t._id.toString()}>
                <Td className="whitespace-nowrap text-[var(--st-text-secondary)]">
                  {format(new Date(t.createdAt), 'PPp')}
                </Td>
                <Td className="text-[var(--st-text)]">{t.reason}</Td>
                <Td
                  align="right"
                  className="whitespace-nowrap font-semibold tabular-nums text-[var(--st-text)]"
                >
                  {isCredit ? '+' : '−'}₹{(t.amount / 100).toFixed(2)}
                </Td>
                <Td>
                  <Badge tone={isCredit ? 'success' : 'neutral'} kind="soft">
                    {isCredit ? (
                      <ArrowDownLeft className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    )}
                    {t.type}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone={getStatusTone(t.status)} dot>
                    {t.status}
                  </Badge>
                </Td>
              </Tr>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
