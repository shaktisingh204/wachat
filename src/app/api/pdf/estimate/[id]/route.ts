import { NextResponse } from 'next/server';
import { htmlToPdf } from '@/lib/pdf-service';
import { loadEstimateForPdf } from '@/lib/pdf-templates/_authenticated-loaders';
import { renderEstimateHtml } from '@/lib/pdf-templates/estimate-template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const result = await loadEstimateForPdf(id);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 'status' in result ? result.status : 404 },
    );
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
        'Content-Disposition': `inline; filename="estimate-${result.estimate.estimateNumber || id}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e) {
    console.error('[api/pdf/estimate] render failed:', e);
    return NextResponse.json({ error: 'PDF generation failed.' }, { status: 500 });
  }
}
