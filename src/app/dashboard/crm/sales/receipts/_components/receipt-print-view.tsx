import type { CrmPaymentReceiptDoc } from '@/lib/rust-client/crm-payment-receipts';

interface ReceiptPrintViewProps {
  receipt: CrmPaymentReceiptDoc;
  customerLabel?: string;
}

function fmtMoney(value: number | undefined, currency: string): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function fmtDate(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US', { timeZone: 'UTC' });
}

function modeLabel(mode: string | undefined): string {
  if (!mode) return '—';
  const map: Record<string, string> = {
    cash: 'Cash',
    cheque: 'Cheque',
    upi: 'UPI',
    neft: 'NEFT',
    rtgs: 'RTGS',
    imps: 'IMPS',
    card: 'Card',
    wallet: 'Wallet',
  };
  return map[mode] ?? mode;
}

export function ReceiptPrintView({ receipt, customerLabel }: ReceiptPrintViewProps) {
  const currency = receipt.currency || 'INR';
  const applied = receipt.applyTo ?? [];
  const totalSettled = applied.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const advance = Math.max(0, (Number(receipt.amount) || 0) - totalSettled);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 p-8 print:p-0">
      <header className="flex items-start justify-between border-b border-[var(--st-border)] pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--st-text)]">Payment Receipt</h1>
          <p className="mt-2 text-[14px] text-[var(--st-text-secondary)]">
            Receipt # <span className="font-medium text-[var(--st-text)]">{receipt.receiptNo || '—'}</span>
            {' '}·{' '}
            Date: <span className="font-medium text-[var(--st-text)]">{fmtDate(receipt.date)}</span>
          </p>
        </div>
        <div className="text-right">
          <div className="text-[13px] uppercase tracking-wide text-[var(--st-text-secondary)]">Amount Received</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--st-text)]">
            {fmtMoney(receipt.amount, currency)}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-8">
        <section>
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Received From
          </h2>
          <p className="text-[14px] font-medium text-[var(--st-text)]">
            {customerLabel ?? receipt.clientId}
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Payment Details
          </h2>
          <dl className="grid grid-cols-[100px_1fr] gap-y-2 text-[13px]">
            <dt className="text-[var(--st-text-secondary)]">Mode</dt>
            <dd className="font-medium text-[var(--st-text)]">{modeLabel(receipt.mode)}</dd>
            
            {(receipt.chequeNo || receipt.txnId || receipt.reference) ? (
              <>
                <dt className="text-[var(--st-text-secondary)]">Reference</dt>
                <dd className="font-medium text-[var(--st-text)]">
                  {receipt.chequeNo || receipt.txnId || receipt.reference}
                </dd>
              </>
            ) : null}

            {receipt.bankAccountId ? (
              <>
                <dt className="text-[var(--st-text-secondary)]">Bank A/c</dt>
                <dd className="font-medium text-[var(--st-text)]">{receipt.bankAccountId}</dd>
              </>
            ) : null}
          </dl>
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
          Application Details
        </h2>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--st-border)] text-left">
              <th className="py-2 font-medium text-[var(--st-text-secondary)]">Invoice Number</th>
              <th className="py-2 text-right font-medium text-[var(--st-text-secondary)]">Amount Applied</th>
            </tr>
          </thead>
          <tbody>
            {applied.length === 0 ? (
              <tr>
                <td colSpan={2} className="py-4 text-center text-[13px] italic text-[var(--st-text-secondary)]">
                  No invoices applied. This receipt records an advance payment.
                </td>
              </tr>
            ) : (
              applied.map((row, i) => (
                <tr key={i} className="border-b border-[var(--st-border)]/40">
                  <td className="py-2">{row.invoiceId}</td>
                  <td className="py-2 text-right tabular-nums">{fmtMoney(row.amount, currency)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="flex justify-end">
        <dl className="w-full max-w-sm space-y-2 text-[13px]">
          <div className="flex justify-between">
            <span className="text-[var(--st-text-secondary)]">Total Applied</span>
            <span className="tabular-nums font-medium text-[var(--st-text)]">{fmtMoney(totalSettled, currency)}</span>
          </div>
          
          {advance > 0 ? (
            <div className="flex justify-between">
              <span className="text-[var(--st-text-secondary)]">Excess as Advance</span>
              <span className="tabular-nums font-medium text-[var(--st-text)]">{fmtMoney(advance, currency)}</span>
            </div>
          ) : null}

          {(receipt.tdsDeducted || receipt.bankCharges) ? (
            <>
              <div className="my-2 border-t border-[var(--st-border)]"></div>
              {receipt.tdsDeducted ? (
                <div className="flex justify-between">
                  <span className="text-[var(--st-text-secondary)]">TDS Deducted</span>
                  <span className="tabular-nums">{fmtMoney(receipt.tdsDeducted, currency)}</span>
                </div>
              ) : null}
              {receipt.bankCharges ? (
                <div className="flex justify-between">
                  <span className="text-[var(--st-text-secondary)]">Bank Charges</span>
                  <span className="tabular-nums">{fmtMoney(receipt.bankCharges, currency)}</span>
                </div>
              ) : null}
            </>
          ) : null}
        </dl>
      </section>

      {receipt.notes ? (
        <section className="pt-4">
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
            Notes
          </h2>
          <p className="whitespace-pre-wrap text-[13px] text-[var(--st-text)]">{receipt.notes}</p>
        </section>
      ) : null}

      <footer className="mt-16 flex justify-end">
        <div className="text-center text-[13px]">
          <div className="mb-8 w-48 border-b border-[var(--st-border)]"></div>
          <div className="text-[var(--st-text-secondary)] uppercase tracking-wider text-[11px] font-semibold">Authorized Signatory</div>
        </div>
      </footer>
    </div>
  );
}
