import { Card, CardBody, Table, THead, TBody, Tr, Th, Td } from '@/components/sabcrm/20ui/compat';
import { CreditCard } from 'lucide-react';
import { fmtCurrency, fmtDateTime } from '@/lib/worksuite/format';
import { PaymentData } from '../types';

export function PaymentHistory({ payments, currency }: { payments: PaymentData[], currency: string }) {
  if (!payments || payments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-wider text-[var(--st-text-secondary)] px-1">
        <CreditCard className="h-4 w-4" />
        <span>Verified Payment Logs (Transactions)</span>
      </div>
      <Card>
        <CardBody className="p-0">
          <Table>
            <THead className="bg-[var(--st-bg-muted)]/15">
              <Tr>
                <Th className="font-mono text-[11px]">Txn ID</Th>
                <Th className="font-mono text-[11px]">Gateway</Th>
                <Th className="font-mono text-[11px]">Timestamp</Th>
                <Th className="font-mono text-[11px] text-right">Amount</Th>
              </Tr>
            </THead>
            <TBody>
              {payments.map((p, i) => (
                <Tr key={i}>
                  <Td className="font-mono text-[12px] max-w-[120px] truncate">
                    {String(p.transaction_id || '')}
                  </Td>
                  <Td className="font-mono text-[11.5px] uppercase">
                    {String(p.gateway || '')}
                  </Td>
                  <Td className="text-[12px] text-[var(--st-text-secondary)]" suppressHydrationWarning>
                    {fmtDateTime(p.paid_at || p.createdAt)}
                  </Td>
                  <Td className="text-right font-mono text-[12.5px] font-bold text-[var(--st-text)]" suppressHydrationWarning>
                    {fmtCurrency(Number(p.amount || 0), currency)}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
