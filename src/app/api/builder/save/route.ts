
import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { PageData } from '@/lib/builder/builder-types';

export async function POST(request: Request) {
    try {
        const pageData: PageData = await request.json();

        if (!pageData.id) {
            return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        await db.collection('pages').updateOne(
            { id: pageData.id },
            { $set: pageData },
            { upsert: true }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to save page:', error);
        return NextResponse.json({ error: 'Failed to save page' }, { status: 500 });
    }
}
