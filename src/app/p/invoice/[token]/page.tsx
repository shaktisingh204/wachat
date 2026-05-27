import { resolvePublicToken } from '@/app/actions/worksuite/public.actions';
import { InvalidLinkCard } from '../../_components/invalid-link';
import { InvoicePayForm } from './_form';
import { InvoiceHeader } from './_components/InvoiceHeader';
import { InvoiceLedger } from './_components/InvoiceLedger';
import { PaymentHistory } from './_components/PaymentHistory';
import { PaymentSuccess } from './_components/PaymentSuccess';
import { InvoiceData, PaymentData } from './types';

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

  const invoice = result.resource.invoice as unknown as InvoiceData;
  const payments = result.resource.payments as unknown as PaymentData[];
  
  const total = Number(invoice.total || 0);
  const paid = Number(invoice.amountPaid || 0);
  const due = Math.max(0, total - paid);
  const currency = String(invoice.currency || 'INR');
  const isPaid = invoice.status === 'paid' || due <= 0;

  return (
    <div className="grid gap-8 lg:grid-cols-5">
      {/* LEFT COLUMN: Specification & Documentation (60%) */}
      <div className="flex flex-col gap-6 lg:col-span-3">
        <InvoiceHeader token={token} invoice={invoice} />
        
        <InvoiceLedger 
          invoice={invoice} 
          total={total} 
          paid={paid} 
          due={due} 
          currency={currency} 
          isPaid={isPaid} 
        />

        <PaymentHistory payments={payments} currency={currency} />
      </div>

      {/* RIGHT COLUMN: Active Request Form & JSON Runner (40%) */}
      <div className="lg:col-span-2 print:hidden">
        <div className="sticky top-6 flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="rounded bg-zoru-surface-2 border border-zoru-line px-2 py-0.5 font-mono text-[11px] font-bold text-zoru-ink uppercase">
              POST
            </span>
            <span className="font-mono text-[13px] text-zoru-ink tracking-tight">
              /v1/invoices/{token.slice(0, 8)}.../pay
            </span>
          </div>

          {isPaid ? (
            <PaymentSuccess />
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
