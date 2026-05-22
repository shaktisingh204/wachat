import { resolvePublicToken } from '@/app/actions/worksuite/public.actions';
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
import { fmtCurrency, fmtDate, fmtDateTime } from '@/lib/worksuite/format';
import { InvalidLinkCard } from '../../_components/invalid-link';
import { InvoicePayForm } from './_form';
import { CreditCard, Database } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicInvoicePage({ params }: PageProps) {
  const { token } = await params;
  const result = await resolvePublicToken(token);
  if (!result || result.resource.type !== 'invoice') {
    return <InvalidLinkCard />;
  }
  const { invoice, payments } = result.resource as {
    invoice: Record<string, unknown>;
    payments: Array<Record<string, unknown>>;
  };
  const total = Number(invoice.total || 0);
  const paid = Number(invoice.amountPaid || 0);
  const due = Math.max(0, total - paid);
  const currency = String(invoice.currency || 'INR');
  const isPaid = invoice.status === 'paid' || due <= 0;

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      {/* LEFT COLUMN: Specification & Documentation (60%) */}
      <div className="flex flex-col gap-6 lg:col-span-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="rounded bg-secondary border border-border px-2 py-0.5 font-mono text-[11px] font-bold text-blue-600 uppercase">
              GET
            </span>
            <span className="font-mono text-[13px] text-foreground tracking-tight">
              /v1/invoices/{token.slice(0, 8)}...
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground font-mono">
            {String(invoice.invoiceNumber || invoice.invoice_number || 'INV-SPECIFICATION')}
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Below are the financial balances and historical transaction states for invoice audit.
          </p>
        </div>

        {/* INVOICE BALANCE METRICS */}
        <Card>
          <ZoruCardHeader className="border-b border-border py-3 bg-secondary/50">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <ZoruCardTitle className="text-[12px] font-mono uppercase tracking-wider text-muted-foreground">
                Invoice Ledger Variables
              </ZoruCardTitle>
            </div>
          </ZoruCardHeader>
          <ZoruCardContent className="p-0">
            <Table>
              <ZoruTableHeader className="bg-secondary/20">
                <ZoruTableRow>
                  <ZoruTableHead className="font-mono text-[11.5px]">Ledger Node</ZoruTableHead>
                  <ZoruTableHead className="font-mono text-[11.5px]">Type</ZoruTableHead>
                  <ZoruTableHead className="font-mono text-[11.5px] text-right">Balance</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">issue_date</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">date</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] font-medium">{fmtDate(invoice.invoiceDate || invoice.issue_date)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">due_date</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">date</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] font-medium">{fmtDate(invoice.dueDate || invoice.due_date)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">invoice_total</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">currency</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] font-medium">{fmtCurrency(total, currency)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">amount_paid</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">currency</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[12.5px] font-medium text-success-ink bg-success/5">{fmtCurrency(paid, currency)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">balance_due</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">currency</ZoruTableCell>
                  <ZoruTableCell className="text-right text-[13px] font-bold text-foreground bg-secondary/40">{fmtCurrency(due, currency)}</ZoruTableCell>
                </ZoruTableRow>
                <ZoruTableRow>
                  <ZoruTableCell className="font-mono text-[12.5px]">payment_status</ZoruTableCell>
                  <ZoruTableCell className="font-mono text-[11px] text-muted-foreground">string</ZoruTableCell>
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

        {/* PAYMENT HISTORY */}
        {payments.length ? (
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
                        <ZoruTableCell className="font-mono text-[12px] max-w-[120px] truncate">{String(p.transaction_id || '')}</ZoruTableCell>
                        <ZoruTableCell className="font-mono text-[11.5px] uppercase">{String(p.gateway || '')}</ZoruTableCell>
                        <ZoruTableCell className="text-[12px] text-muted-foreground">{fmtDateTime(p.paid_at || p.createdAt)}</ZoruTableCell>
                        <ZoruTableCell className="text-right font-mono text-[12.5px] font-bold text-foreground">{fmtCurrency(Number(p.amount || 0), currency)}</ZoruTableCell>
                      </ZoruTableRow>
                    ))}
                  </ZoruTableBody>
                </Table>
              </ZoruCardContent>
            </Card>
          </div>
        ) : null}
      </div>

      {/* RIGHT COLUMN: Active Request Form & JSON Runner (40%) */}
      <div className="lg:col-span-2">
        <div className="sticky top-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="rounded bg-secondary border border-border px-2 py-0.5 font-mono text-[11px] font-bold text-green-600 uppercase">
              POST
            </span>
            <span className="font-mono text-[13px] text-foreground tracking-tight">
              /v1/invoices/{token.slice(0, 8)}.../pay
            </span>
          </div>

          {isPaid ? (
            <Card className="border-success/20 bg-success/5">
              <ZoruCardContent className="py-8 text-center flex flex-col items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success-ink border border-success/20 font-mono text-xs">
                  200
                </div>
                <div>
                  <h3 className="text-[14px] font-bold font-mono uppercase text-success-ink tracking-tight">
                    // LEDGER.BALANCED
                  </h3>
                  <p className="mt-1 text-[12.5px] text-muted-foreground font-sans">
                    This invoice has been fully settled and paid. Thank you!
                  </p>
                </div>
                <div className="mt-4 w-full rounded border border-border bg-background p-3 text-left font-mono text-[11px] leading-relaxed shadow-inner">
                  <span className="text-muted-foreground">{"{"}</span>
                  <div className="pl-4">
                    <span className="text-blue-600">&quot;status&quot;</span>: <span className="text-green-600">&quot;paid&quot;</span>,
                    <br />
                    <span className="text-blue-600">&quot;balance_due&quot;</span>: <span className="text-amber-600">0.00</span>,
                    <br />
                    <span className="text-blue-600">&quot;success&quot;</span>: <span className="text-green-600">true</span>
                  </div>
                  <span className="text-muted-foreground">{"}"}</span>
                </div>
              </ZoruCardContent>
            </Card>
          ) : (
            <InvoicePayForm
              token={token}
              due={due}
              currency={currency}
            />
          )}
        </div>
      </div>
    </div>
  );
}
