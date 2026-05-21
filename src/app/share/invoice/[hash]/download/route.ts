import { NextResponse } from 'next/server';
import { getPublicInvoiceWithDetails } from '@/app/actions/public-invoice.actions';
import { htmlToPdf } from '@/lib/pdf-service';
import { renderInvoiceHtml } from '@/lib/pdf-templates/invoice-template';

/**
 * Public invoice PDF download.
 *
 * Same trust model as `/share/invoice/[hash]`: the 32-char publicHash
 * IS the auth token. No session, no CORS — just hash → fetch → render.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<Response> {
  const { hash } = await params;
  const result = await getPublicInvoiceWithDetails(hash);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  try {
    const html = renderInvoiceHtml(
      result.invoice,
      result.company,
      result.items,
      result.client,
      result.payments.map((p) => ({
        date: p.date,
        amount: p.amount,
        mode: p.mode,
        reference: p.reference,
        notes: p.notes,
      })),
    );
    const pdf = await htmlToPdf(html);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${result.invoice.invoiceNumber || 'document'}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[invoice pdf] render failed:', e);
    return NextResponse.json({ error: 'PDF generation failed.' }, { status: 500 });
  }
}
