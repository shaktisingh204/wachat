import { NextResponse } from 'next/server';
import { htmlToPdf } from '@/lib/pdf-service';
import { loadProposalForPdf } from '@/lib/pdf-templates/_authenticated-loaders';
import { renderProposalHtml } from '@/lib/pdf-templates/proposal-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const result = await loadProposalForPdf(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 'status' in result ? result.status : 404 },
    );
  }

  try {
    const html = renderProposalHtml(
      result.proposal,
      result.company,
      result.items,
      result.deal,
    );
    const pdf = await htmlToPdf(html);
    const slug = result.proposal.proposalNumber || result.proposal.title || id;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="proposal-${slug.replace(/[^a-zA-Z0-9-_]+/g, '-')}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[api/pdf/proposal] render failed:', e);
    return NextResponse.json({ error: 'PDF generation failed.' }, { status: 500 });
  }
}
