import {
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  Badge,
  Table,
  ZoruTableHeader,
  ZoruTableBody,
  ZoruTableRow,
  ZoruTableHead,
  ZoruTableCell,
} from '@/components/zoruui';
import { Database } from 'lucide-react';
import { fmtCurrency, fmtDate } from '@/lib/worksuite/format';
import { InvoiceData } from '../types';

export function InvoiceLedger({
  invoice,
  total,
  paid,
  due,
  currency,
  isPaid
}: {
  invoice: InvoiceData;
  total: number;
  paid: number;
  due: number;
  currency: string;
  isPaid: boolean;
}) {
  return (
    <Card>
      <ZoruCardHeader className="border-b border-zoru-line py-3 bg-zoru-surface-2/50">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-zoru-ink-muted" />
          <ZoruCardTitle className="text-[12px] font-mono uppercase tracking-wider text-zoru-ink-muted">
            Invoice Ledger Variables
          </ZoruCardTitle>
        </div>
      </ZoruCardHeader>
      <ZoruCardContent className="p-0">
        <Table>
          <ZoruTableHeader className="bg-zoru-surface-2/20">
            <ZoruTableRow>
              <ZoruTableHead className="font-mono text-[11.5px]">Ledger Node</ZoruTableHead>
              <ZoruTableHead className="font-mono text-[11.5px]">Type</ZoruTableHead>
              <ZoruTableHead className="font-mono text-[11.5px] text-right">Balance</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            <ZoruTableRow>
              <ZoruTableCell className="font-mono text-[12.5px]">issue_date</ZoruTableCell>
              <ZoruTableCell className="font-mono text-[11px] text-zoru-ink-muted">date</ZoruTableCell>
              <ZoruTableCell className="text-right text-[12.5px] font-medium" suppressHydrationWarning>
                {fmtDate(invoice.invoiceDate || invoice.issue_date)}
              </ZoruTableCell>
            </ZoruTableRow>
            <ZoruTableRow>
              <ZoruTableCell className="font-mono text-[12.5px]">due_date</ZoruTableCell>
              <ZoruTableCell className="font-mono text-[11px] text-zoru-ink-muted">date</ZoruTableCell>
              <ZoruTableCell className="text-right text-[12.5px] font-medium" suppressHydrationWarning>
                {fmtDate(invoice.dueDate || invoice.due_date)}
              </ZoruTableCell>
            </ZoruTableRow>
            <ZoruTableRow>
              <ZoruTableCell className="font-mono text-[12.5px]">invoice_total</ZoruTableCell>
              <ZoruTableCell className="font-mono text-[11px] text-zoru-ink-muted">currency</ZoruTableCell>
              <ZoruTableCell className="text-right text-[12.5px] font-medium" suppressHydrationWarning>{fmtCurrency(total, currency)}</ZoruTableCell>
            </ZoruTableRow>
            <ZoruTableRow>
              <ZoruTableCell className="font-mono text-[12.5px]">amount_paid</ZoruTableCell>
              <ZoruTableCell className="font-mono text-[11px] text-zoru-ink-muted">currency</ZoruTableCell>
              <ZoruTableCell className="text-right text-[12.5px] font-medium text-success-ink bg-success/5" suppressHydrationWarning>{fmtCurrency(paid, currency)}</ZoruTableCell>
            </ZoruTableRow>
            <ZoruTableRow>
              <ZoruTableCell className="font-mono text-[12.5px]">balance_due</ZoruTableCell>
              <ZoruTableCell className="font-mono text-[11px] text-zoru-ink-muted">currency</ZoruTableCell>
              <ZoruTableCell className="text-right text-[13px] font-bold text-zoru-ink bg-zoru-surface-2/40" suppressHydrationWarning>{fmtCurrency(due, currency)}</ZoruTableCell>
            </ZoruTableRow>
            <ZoruTableRow>
              <ZoruTableCell className="font-mono text-[12.5px]">payment_status</ZoruTableCell>
              <ZoruTableCell className="font-mono text-[11px] text-zoru-ink-muted">string</ZoruTableCell>
              <ZoruTableCell className="text-right">
                <Badge variant={isPaid ? 'success' : 'warning'}>
                  {String(invoice.status || (isPaid ? 'PAID' : 'UNPAID')).toUpperCase()}
                </Badge>
              </ZoruTableCell>
            </ZoruTableRow>
          </ZoruTableBody>
        </Table>
      </ZoruCardContent>
    </Card>
  );
}
