import { NextResponse } from 'next/server';
import { htmlToPdf } from '@/lib/pdf-service';
import { loadCreditNoteForPdf } from '@/lib/pdf-templates/_authenticated-loaders';
import { renderCreditNoteHtml } from '@/lib/pdf-templates/credit-note-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const result = await loadCreditNoteForPdf(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 'status' in result ? result.status : 404 },
    );
  }

  try {
    const html = renderCreditNoteHtml(
      result.creditNote,
      result.company,
      result.items,
      result.client,
      result.originalInvoice,
    );
    const pdf = await htmlToPdf(html);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="credit-note-${result.creditNote.creditNoteNumber || id}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[api/pdf/credit-note] render failed:', e);
    return NextResponse.json({ error: 'PDF generation failed.' }, { status: 500 });
  }
}
