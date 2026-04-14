import { resolvePublicToken } from '@/app/actions/worksuite/public.actions';
import { ClayBadge, ClayCard } from '@/components/clay';
import { fmtCurrency, fmtDate, fmtDateTime } from '@/lib/worksuite/format';
import { InvalidLinkCard } from '../../_components/invalid-link';
import { InvoicePayForm } from './_form';

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
    <div className="flex flex-col gap-5">
      <ClayCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11.5px] uppercase tracking-wide text-clay-ink-muted">
              Invoice
            </p>
            <h1 className="text-[18px] font-semibold text-clay-ink">
              {String(invoice.invoiceNumber || invoice.invoice_number || '')}
            </h1>
            <p className="mt-1 text-[12.5px] text-clay-ink-muted">
              Issued {fmtDate(invoice.invoiceDate || invoice.issue_date)} · Due{' '}
              {fmtDate(invoice.dueDate || invoice.due_date)}
            </p>
          </div>
          <ClayBadge tone={isPaid ? 'green' : 'amber'} dot>
            {String(invoice.status || (isPaid ? 'paid' : 'unpaid'))}
          </ClayBadge>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Stat label="Total" value={fmtCurrency(total, currency)} />
          <Stat label="Paid" value={fmtCurrency(paid, currency)} />
          <Stat
            label="Balance due"
            value={fmtCurrency(due, currency)}
            strong
          />
        </div>
      </ClayCard>

      {payments.length ? (
        <ClayCard>
          <h2 className="mb-2 text-[15px] font-semibold text-clay-ink">
            Payment history
          </h2>
          <div className="divide-y divide-clay-border">
            {payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-[13px] font-medium text-clay-ink">
                    {fmtCurrency(Number(p.amount || 0), currency)}
                  </p>
                  <p className="text-[11.5px] text-clay-ink-muted">
                    {String(p.gateway || '')} · {fmtDateTime(p.paid_at || p.createdAt)}
                  </p>
                </div>
                <p className="text-[11.5px] text-clay-ink-muted">
                  {String(p.transaction_id || '')}
                </p>
              </div>
            ))}
          </div>
        </ClayCard>
      ) : null}

      {isPaid ? (
        <ClayCard>
          <p className="text-[13px] text-clay-ink">
            This invoice has been fully paid. Thank you!
          </p>
        </ClayCard>
      ) : (
        <InvoicePayForm
          token={token}
          due={due}
          currency={currency}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-clay-md border border-clay-border bg-clay-surface-2 p-3">
      <p className="text-[11.5px] text-clay-ink-muted">{label}</p>
      <p
        className={
          strong
            ? 'mt-1 text-[16px] font-semibold text-clay-ink'
            : 'mt-1 text-[14px] font-medium text-clay-ink'
        }
      >
        {value}
      </p>
    </div>
  );
}
