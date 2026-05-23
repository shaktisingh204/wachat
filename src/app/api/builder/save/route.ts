import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { PageData } from '@/lib/builder/builder-types';
import { getSession } from '@/app/actions/user.actions';

export async function POST(request: Request) {
    try {
        const session = await getSession();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const pageData: PageData = await request.json();

        if (!pageData.id) {
            return NextResponse.json({ error: 'Page ID is required' }, { status: 400 });
        }

        const { db } = await connectToDatabase();

        // Enforce that the user is saving their own page
        const userId = session.user._id.toString();
        const pageToSave = { ...pageData, userId };

        await db.collection('pages').updateOne(
            { id: pageData.id, userId },
            { $set: pageToSave },
            { upsert: true }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to save page:', error);
        return NextResponse.json({ error: 'Failed to save page' }, { status: 500 });
    }
}
