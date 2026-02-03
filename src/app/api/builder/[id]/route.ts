
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    try {
        const { id } = params;
        const { db } = await connectToDatabase();

        const page = await db.collection('pages').findOne({ id });

        if (!page) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 });
        }

        return NextResponse.json(page);
    } catch (error) {
        console.error('Failed to load page:', error);
        return NextResponse.json({ error: 'Failed to load page' }, { status: 500 });
    }
}
