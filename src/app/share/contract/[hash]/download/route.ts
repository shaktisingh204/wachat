import { NextResponse } from 'next/server';
import { getPublicContractWithDetails } from '@/app/actions/public-contract.actions';
import { htmlToPdf } from '@/lib/pdf-service';
import { renderContractHtml } from '@/lib/pdf-templates/contract-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<Response> {
  const { hash } = await params;
  const result = await getPublicContractWithDetails(hash);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  try {
    const html = renderContractHtml(result.contract, result.company, result.client, {
      company: result.signature.company,
      client: result.signature.client,
    });
    const pdf = await htmlToPdf(html);
    const slug = result.contract.contractNumber || result.contract.contractName || 'document';
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="contract-${slug.replace(/[^a-zA-Z0-9-_]+/g, '-')}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[contract pdf] render failed:', e);
    return NextResponse.json({ error: 'PDF generation failed.' }, { status: 500 });
  }
}
