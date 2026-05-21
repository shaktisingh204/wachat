import { NextResponse } from 'next/server';
import { htmlToPdf } from '@/lib/pdf-service';
import { loadContractForPdf } from '@/lib/pdf-templates/_authenticated-loaders';
import { renderContractHtml } from '@/lib/pdf-templates/contract-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const result = await loadContractForPdf(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 'status' in result ? result.status : 404 },
    );
  }

  try {
    const html = renderContractHtml(result.contract, result.company, result.client, {
      company: result.signature.company,
      client: result.signature.client,
    });
    const pdf = await htmlToPdf(html);
    const slug = result.contract.contractNumber || result.contract.contractName || id;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="contract-${slug.replace(/[^a-zA-Z0-9-_]+/g, '-')}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[api/pdf/contract] render failed:', e);
    return NextResponse.json({ error: 'PDF generation failed.' }, { status: 500 });
  }
}
