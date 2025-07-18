

'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import { getErrorMessage } from '@/lib/utils';

export async function saveRazorpaySettings(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { error: 'Project ID is missing.' };
    
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: 'Access denied or project not found.' };

    try {
        const settings = {
            keyId: formData.get('keyId') as string,
            keySecret: formData.get('keySecret') as string,
        };

        if (!settings.keyId || !settings.keySecret) {
            return { error: 'Both Key ID and Key Secret are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { razorpaySettings: settings } }
        );

        revalidatePath('/dashboard/integrations');
        return { message: 'Razorpay settings saved successfully!' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}
