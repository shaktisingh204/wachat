import { NextResponse } from 'next/server';
import { htmlToPdf } from '@/lib/pdf-service';
import { loadInvoiceForPdf } from '@/lib/pdf-templates/_authenticated-loaders';
import { renderInvoiceHtml } from '@/lib/pdf-templates/invoice-template';

/**
 * Authenticated invoice PDF download. Ownership is enforced inside
 * `loadInvoiceForPdf` via `getSession()` — anything that isn't owned by
 * the current tenant returns 404.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const result = await loadInvoiceForPdf(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 'status' in result ? result.status : 404 },
    );
  }

  try {
    const html = renderInvoiceHtml(
      result.invoice,
      result.company,
      result.items,
      result.client,
      result.payments,
    );
    const pdf = await htmlToPdf(html);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${result.invoice.invoiceNumber || id}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[api/pdf/invoice] render failed:', e);
    return NextResponse.json({ error: 'PDF generation failed.' }, { status: 500 });
  }
}
