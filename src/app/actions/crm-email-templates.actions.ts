
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmEmailTemplate } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';

export async function getCrmEmailTemplates(): Promise<WithId<CrmEmailTemplate>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const templates = await db.collection<CrmEmailTemplate>('crm_email_templates')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ updatedAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(templates));
    } catch (e) {
        console.error("Failed to fetch CRM email templates:", e);
        return [];
    }
}

export async function saveCrmEmailTemplate(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    const templateId = formData.get('templateId') as string | null;
    const isEditing = !!templateId;

    try {
        const templateData: Partial<Omit<CrmEmailTemplate, '_id'>> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            subject: formData.get('subject') as string,
            body: formData.get('body') as string,
            updatedAt: new Date(),
        };

        if (!templateData.name || !templateData.subject || !templateData.body) {
            return { error: 'Name, subject, and body are required.' };
        }

        const { db } = await connectToDatabase();
        if (isEditing && ObjectId.isValid(templateId)) {
            await db.collection('crm_email_templates').updateOne(
                { _id: new ObjectId(templateId), userId: new ObjectId(session.user._id) },
                { $set: templateData }
            );
        } else {
            templateData.createdAt = new Date();
            await db.collection('crm_email_templates').insertOne(templateData as CrmEmailTemplate);
        }
        
        revalidatePath('/dashboard/crm/settings');
        return { message: 'Email template saved successfully.' };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteCrmEmailTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(templateId)) return { success: false, error: 'Invalid Template ID.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_email_templates').deleteOne({ 
            _id: new ObjectId(templateId), 
            userId: new ObjectId(session.user._id) 
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Template not found or you do not have permission to delete it.' };
        }
        
        revalidatePath('/dashboard/crm/settings');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}
