import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

/**
 * Serves pages published via the SabFlow "Dynamic Web Page > Publish Page" action.
 * Increments a view counter on each read.
 */
export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    const { slug } = await context.params;
    if (!slug) {
        return NextResponse.json({ error: 'Slug is required.' }, { status: 400 });
    }

    try {
        const { db } = await connectToDatabase();
        const page = await db.collection('sabflow_pages').findOneAndUpdate(
            { slug },
            { $inc: { views: 1 } },
            { returnDocument: 'after' }
        );
        const doc = (page as any)?.value ?? page;
        if (!doc) {
            return NextResponse.json({ error: 'Page not found.' }, { status: 404 });
        }

        const title = String(doc.title ?? 'Untitled');
        const content = String(doc.content ?? '');
        const safeTitle = title.replace(/</g, '&lt;');

        const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${safeTitle}</title>
</head>
<body>
${content}
</body>
</html>`;

        return new NextResponse(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'public, max-age=60, s-maxage=300',
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed to load page.' }, { status: 500 });
    }
}
