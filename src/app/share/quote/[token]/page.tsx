import * as React from 'react';
import { notFound } from 'next/navigation';

import { getPublicQuote } from '@/app/actions/sabcrm-quotedoc.actions';
import { QuoteSignClient } from './quote-sign-client';

/**
 * Public, unauthenticated quote document + e-signature page.
 *
 * Lives under `/share/*` (the public layout) — NOT under `/sabcrm`, which
 * force-redirects logged-out users. The opaque token in the path IS the
 * credential; `getPublicQuote` verifies + re-validates it server-side.
 *
 * The print-ready quote HTML (a full `<!doctype html>` document produced by
 * `renderQuoteHtml`) is embedded in a sandboxed `<iframe srcDoc>` so its
 * `<style>` block is isolated from the share-page chrome and "Print" prints
 * exactly the document.
 */

export const dynamic = 'force-dynamic';

type Params = Promise<{ token: string }>;

async function QuoteContainer({ token }: { token: string }) {
  const quote = await getPublicQuote(token);
  if (!quote) notFound();

  return (
    <QuoteSignClient
      token={token}
      quotationNo={quote.quotationNo}
      currency={quote.currency}
      amount={quote.amount}
      clientName={quote.clientName}
      html={quote.html}
      accepted={quote.accepted}
      acceptedAt={quote.acceptedAt}
      acceptedBy={quote.acceptedBy}
      payUrl={quote.payUrl}
    />
  );
}

export default async function PublicQuotePage({ params }: { params: Params }) {
  const { token } = await params;
  return (
    <React.Suspense
      fallback={
        <div className="py-16 text-center text-sm text-[var(--st-text)]">
          Loading quote…
        </div>
      }
    >
      <QuoteContainer token={token} />
    </React.Suspense>
  );
}
