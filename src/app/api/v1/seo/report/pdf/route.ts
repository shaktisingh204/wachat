import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    try {
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();

        // Authenticated URL to render. In prod, use a dedicated print token or internal URL.
        // For MVP, assuming local access.
        const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        await page.goto(`${APP_URL}/dashboard/seo/${projectId}/audit/print`, { waitUntil: 'networkidle0' });

        const pdf = await page.pdf({ format: 'A4', printBackground: true });
        await browser.close();

        return new NextResponse(pdf as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="seo-report-${projectId}.pdf"`
            }
        });

    } catch (e: any) {
        console.error("PDF Gen Failed", e);
        return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
    }
}
