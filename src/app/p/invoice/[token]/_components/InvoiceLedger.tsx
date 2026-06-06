import { Card, CardBody, CardHeader, CardTitle, Badge, Table, THead, TBody, Tr, Th, Td } from '@/components/sabcrm/20ui/compat';
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
      <CardHeader className="border-b border-[var(--st-border)] py-3 bg-[var(--st-bg-muted)]/50">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-[var(--st-text-secondary)]" />
          <CardTitle className="text-[12px] font-mono uppercase tracking-wider text-[var(--st-text-secondary)]">
            Invoice Ledger Variables
          </CardTitle>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        <Table>
          <THead className="bg-[var(--st-bg-muted)]/20">
            <Tr>
              <Th className="font-mono text-[11.5px]">Ledger Node</Th>
              <Th className="font-mono text-[11.5px]">Type</Th>
              <Th className="font-mono text-[11.5px] text-right">Balance</Th>
            </Tr>
          </THead>
          <TBody>
            <Tr>
              <Td className="font-mono text-[12.5px]">issue_date</Td>
              <Td className="font-mono text-[11px] text-[var(--st-text-secondary)]">date</Td>
              <Td className="text-right text-[12.5px] font-medium" suppressHydrationWarning>
                {fmtDate(invoice.invoiceDate || invoice.issue_date)}
              </Td>
            </Tr>
            <Tr>
              <Td className="font-mono text-[12.5px]">due_date</Td>
              <Td className="font-mono text-[11px] text-[var(--st-text-secondary)]">date</Td>
              <Td className="text-right text-[12.5px] font-medium" suppressHydrationWarning>
                {fmtDate(invoice.dueDate || invoice.due_date)}
              </Td>
            </Tr>
            <Tr>
              <Td className="font-mono text-[12.5px]">invoice_total</Td>
              <Td className="font-mono text-[11px] text-[var(--st-text-secondary)]">currency</Td>
              <Td className="text-right text-[12.5px] font-medium" suppressHydrationWarning>{fmtCurrency(total, currency)}</Td>
            </Tr>
            <Tr>
              <Td className="font-mono text-[12.5px]">amount_paid</Td>
              <Td className="font-mono text-[11px] text-[var(--st-text-secondary)]">currency</Td>
              <Td className="text-right text-[12.5px] font-medium text-success-ink bg-success/5" suppressHydrationWarning>{fmtCurrency(paid, currency)}</Td>
            </Tr>
            <Tr>
              <Td className="font-mono text-[12.5px]">balance_due</Td>
              <Td className="font-mono text-[11px] text-[var(--st-text-secondary)]">currency</Td>
              <Td className="text-right text-[13px] font-bold text-[var(--st-text)] bg-[var(--st-bg-muted)]/40" suppressHydrationWarning>{fmtCurrency(due, currency)}</Td>
            </Tr>
            <Tr>
              <Td className="font-mono text-[12.5px]">payment_status</Td>
              <Td className="font-mono text-[11px] text-[var(--st-text-secondary)]">string</Td>
              <Td className="text-right">
                <Badge variant={isPaid ? 'success' : 'warning'}>
                  {String(invoice.status || (isPaid ? 'PAID' : 'UNPAID')).toUpperCase()}
                </Badge>
              </Td>
            </Tr>
          </TBody>
        </Table>
      </CardBody>
    </Card>
  );
}
