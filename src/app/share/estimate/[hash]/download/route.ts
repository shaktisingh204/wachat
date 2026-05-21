import { NextResponse } from 'next/server';
import { getPublicEstimateWithDetails } from '@/app/actions/public-estimate.actions';
import { htmlToPdf } from '@/lib/pdf-service';
import { renderEstimateHtml } from '@/lib/pdf-templates/estimate-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ hash: string }> },
): Promise<Response> {
  const { hash } = await params;
  const result = await getPublicEstimateWithDetails(hash);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  try {
    const html = renderEstimateHtml(
      result.estimate,
      result.company,
      result.items,
      result.client,
    );
    const pdf = await htmlToPdf(html);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="estimate-${result.estimate.estimateNumber || 'document'}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[estimate pdf] render failed:', e);
    return NextResponse.json({ error: 'PDF generation failed.' }, { status: 500 });
  }
}
