import {
  Card,
  ZoruCardContent,
  Table,
  ZoruTableHeader,
  ZoruTableBody,
  ZoruTableRow,
  ZoruTableHead,
  ZoruTableCell,
} from '@/components/zoruui';
import { CreditCard } from 'lucide-react';
import { fmtCurrency, fmtDateTime } from '@/lib/worksuite/format';
import { PaymentData } from '../types';

export function PaymentHistory({ payments, currency }: { payments: PaymentData[], currency: string }) {
  if (!payments || payments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-wider text-muted-foreground px-1">
        <CreditCard className="h-4 w-4" />
        <span>Verified Payment Logs (Transactions)</span>
      </div>
      <Card>
        <ZoruCardContent className="p-0">
          <Table>
            <ZoruTableHeader className="bg-secondary/15">
              <ZoruTableRow>
                <ZoruTableHead className="font-mono text-[11px]">Txn ID</ZoruTableHead>
                <ZoruTableHead className="font-mono text-[11px]">Gateway</ZoruTableHead>
                <ZoruTableHead className="font-mono text-[11px]">Timestamp</ZoruTableHead>
                <ZoruTableHead className="font-mono text-[11px] text-right">Amount</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {payments.map((p, i) => (
                <ZoruTableRow key={i}>
                  <ZoruTableCell className="font-mono text-[12px] max-w-[120px] truncate">
                    {String(p.transaction_id || '')}
                  </ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11.5px] uppercase">
                    {String(p.gateway || '')}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12px] text-muted-foreground" suppressHydrationWarning>
                    {fmtDateTime(p.paid_at || p.createdAt)}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right font-mono text-[12.5px] font-bold text-foreground" suppressHydrationWarning>
                    {fmtCurrency(Number(p.amount || 0), currency)}
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </Table>
        </ZoruCardContent>
      </Card>
    </div>
  );
}
