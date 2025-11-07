
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import type { WhatsAppWidgetSettings } from '@/lib/definitions';

export async function saveWidgetSettings(
    prevState: any,
    formData: FormData
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId || !ObjectId.isValid(projectId)) {
        return { error: "Invalid project ID." };
    }

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    try {
        const settings: Partial<WhatsAppWidgetSettings> = {
            phoneNumber: formData.get('phoneNumber') as string,
            prefilledMessage: formData.get('prefilledMessage') as string,
            position: formData.get('position') as 'bottom-left' | 'bottom-right',
            buttonColor: formData.get('buttonColor') as string,
            headerTitle: formData.get('headerTitle') as string,
            headerSubtitle: formData.get('headerSubtitle') as string,
            headerAvatarUrl: formData.get('headerAvatarUrl') as string,
            welcomeMessage: formData.get('welcomeMessage') as string,
            ctaText: formData.get('ctaText') as string,
            borderRadius: parseInt(formData.get('borderRadius') as string, 10),
            padding: parseInt(formData.get('padding') as string, 10),
            textColor: formData.get('textColor') as string,
            buttonTextColor: formData.get('buttonTextColor') as string,
        };

        const { db } = await connectToDatabase();
        await db.collection('projects').updateOne(
            { _id: new ObjectId(projectId) },
            { $set: { widgetSettings: settings } }
        );

        revalidatePath(`/dashboard/integrations/whatsapp-widget-generator`);
        return { message: "Widget settings saved successfully." };

    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}
