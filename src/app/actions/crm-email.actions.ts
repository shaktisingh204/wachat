

'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmEmailSettings, CrmContact } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { getTransporter } from '@/lib/email-service';

export async function sendCrmEmail(prevState: any, formData: FormData): Promise<{ success: boolean; message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Access denied." };

    const to = formData.get('to') as string;
    const subject = formData.get('subject') as string;
    const body = formData.get('body') as string; // This will be HTML from a rich text editor

    if (!to || !subject || !body) {
        return { success: false, error: "To, subject, and body are required." };
    }
    
    try {
        const { db } = await connectToDatabase();
        const settings = await db.collection<WithId<CrmEmailSettings>>('crm_email_settings').findOne({ userId: session.user._id });
        if (!settings) throw new Error("Email provider not configured.");
        
        // --- Variable Interpolation ---
        const firstRecipient = to.split(',')[0].trim();
        const contact = await db.collection<CrmContact>('crm_contacts').findOne({ userId: session.user._id, email: firstRecipient });
        
        let interpolatedSubject = subject;
        let interpolatedBody = body;
        
        if (contact) {
            const variables = {
                'contact.name': contact.name,
                'contact.email': contact.email,
                'contact.company': contact.company || '',
                'user.name': session.user.name,
            };

            const regex = /{{\s*([\w.]+)\s*}}/g;
            interpolatedSubject = subject.replace(regex, (match, key) => variables[key as keyof typeof variables] || match);
            interpolatedBody = body.replace(regex, (match, key) => variables[key as keyof typeof variables] || match);
        }

        const transporter = await getTransporter();

        await transporter.sendMail({
            from: `"${settings.fromName}" <${settings.fromEmail}>`,
            to,
            subject: interpolatedSubject,
            html: interpolatedBody,
        });

        // Log the email as an activity (future step)
        // await addCrmNote(...)
        
        return { success: true, message: "Email sent successfully!" };
    } catch (e: any) {
        console.error("Failed to send email:", e);
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function saveCrmEmailSettings(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied or project not found." };
    
    try {
        const settings: Partial<CrmEmailSettings> = {
            provider: 'smtp',
            smtp: {
                host: formData.get('smtpHost') as string,
                port: parseInt(formData.get('smtpPort') as string, 10),
                secure: formData.get('smtpSecure') === 'on',
                user: formData.get('smtpUser') as string,
                pass: formData.get('smtpPass') as string,
            },
            fromName: formData.get('fromName') as string,
            fromEmail: formData.get('fromEmail') as string,
        };
        
        // Basic validation
        if (!settings.smtp.host || !settings.smtp.port || !settings.smtp.user || !settings.smtp.pass || !settings.fromName || !settings.fromEmail) {
            return { error: 'All SMTP and From fields are required.' };
        }

        const { db } = await connectToDatabase();
        
        await db.collection('crm_email_settings').updateOne(
            { userId: new ObjectId(session.user._id) },
            { $set: settings },
            { upsert: true }
        );

        revalidatePath('/dashboard/crm/settings');
        return { message: 'SMTP settings saved successfully!' };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveOAuthTokens({ userId, provider, accessToken, refreshToken, expiryDate }: {
    userId: string;
    provider: 'google' | 'outlook';
    accessToken: string;
    refreshToken: string;
    expiryDate: number;
}): Promise<{ success: boolean; error?: string }> {
     if (!userId || !ObjectId.isValid(userId)) {
        return { success: false, error: 'Invalid user ID.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        
        const updatePayload = {
            provider,
            [`${provider}OAuth`]: {
                accessToken,
                refreshToken,
                expiryDate,
            },
        };

        await db.collection('crm_email_settings').updateOne(
            { userId: new ObjectId(userId) },
            { $set: updatePayload, $setOnInsert: { userId: new ObjectId(userId) } },
            { upsert: true }
        );

        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function getCrmEmailSettings(userId: string): Promise<WithId<CrmEmailSettings> | null> {
    if (!userId || !ObjectId.isValid(userId)) return null;
    
    const session = await getSession();
    if (session?.user?._id.toString() !== userId) return null;

    try {
        const { db } = await connectToDatabase();
        const settings = await db.collection<CrmEmailSettings>('crm_email_settings').findOne({ userId: new ObjectId(userId) });
        return settings ? JSON.parse(JSON.stringify(settings)) : null;
    } catch(e) {
        console.error("Failed to fetch CRM email settings:", e);
        return null;
    }
}
