
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { SabChatSettings } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function saveSabChatSettings(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };
    
    const settingsString = formData.get('settings') as string;
    if (!settingsString) return { error: 'No settings provided.' };

    try {
        const settings: SabChatSettings = JSON.parse(settingsString);

        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { sabChatSettings: settings } }
        );
        
        revalidatePath('/dashboard/sabchat/widget');
        return { message: 'sabChat settings saved successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}
