'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import { PageData } from '@/lib/builder/builder-types';

export async function savePageData(pageData: PageData) {
    const session = await getSession();
    if (!session?.user) {
        throw new Error("Unauthorized");
    }

    const { db } = await connectToDatabase();
    
    // Ensure the page belongs to the user
    await db.collection('pages').updateOne(
        { id: pageData.id, userId: session.user._id.toString() },
        { 
            $set: {
                title: pageData.title,
                elements: pageData.elements,
                settings: pageData.settings,
                updatedAt: new Date()
            }
        },
        { upsert: true }
    );

    return { success: true };
}
