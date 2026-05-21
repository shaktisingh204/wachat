import { NextResponse } from 'next/server';
import { getPublicProposalWithDetails } from '@/app/actions/public-proposal.actions';
import { htmlToPdf } from '@/lib/pdf-service';
import { renderProposalHtml } from '@/lib/pdf-templates/proposal-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<Response> {
  const { hash } = await params;
  const result = await getPublicProposalWithDetails(hash);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  try {
    const html = renderProposalHtml(
      result.proposal,
      result.company,
      result.items,
      result.deal,
    );
    const pdf = await htmlToPdf(html);
    const slug = result.proposal.proposalNumber || result.proposal.title || 'document';
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="proposal-${slug}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[proposal pdf] render failed:', e);
    return NextResponse.json({ error: 'PDF generation failed.' }, { status: 500 });
  }
}
