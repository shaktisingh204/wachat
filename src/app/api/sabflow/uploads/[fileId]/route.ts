import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

/**
 * Serves binary files uploaded via the SabFlow "File Uploader" action.
 */
export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ fileId: string }> }
) {
    const { fileId } = await context.params;
    if (!fileId) {
        return NextResponse.json({ error: 'fileId is required.' }, { status: 400 });
    }

    try {
        const { db } = await connectToDatabase();
        const doc = await db.collection('sabflow_uploads').findOne({ fileId });
        if (!doc) {
            return NextResponse.json({ error: 'File not found.' }, { status: 404 });
        }

        const binary = (doc.data as any)?.buffer ?? doc.data;
        const buf: Buffer = Buffer.isBuffer(binary) ? binary : Buffer.from(binary);
        const contentType = String(doc.contentType || 'application/octet-stream');
        // Wrap in a Blob to satisfy NextResponse BodyInit typing
        const body = new Blob([new Uint8Array(buf)], { type: contentType });

        return new NextResponse(body, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': String(buf.byteLength),
                'Content-Disposition': `inline; filename="${encodeURIComponent(String(doc.filename || fileId))}"`,
                'Cache-Control': 'public, max-age=3600',
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed to load file.' }, { status: 500 });
    }
}
