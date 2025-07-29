
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '.';
import type { SmsProviderSettings } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import twilio from 'twilio';

export async function saveSmsSettings(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { error: 'Project ID is missing.' };

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: 'Access denied or project not found.' };

    try {
        const settings: SmsProviderSettings = {
            twilio: {
                accountSid: formData.get('accountSid') as string,
                authToken: formData.get('authToken') as string,
                fromNumber: formData.get('fromNumber') as string,
            }
        };
        
        if (!settings.twilio.accountSid || !settings.twilio.authToken || !settings.twilio.fromNumber) {
            return { error: 'All Twilio fields are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { smsProviderSettings: settings } }
        );

        revalidatePath('/dashboard/sms/settings');
        return { message: 'Twilio settings saved successfully!' };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}
