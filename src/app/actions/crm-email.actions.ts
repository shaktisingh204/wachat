

'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { EmailSettings, CrmContact } from '@/lib/definitions';
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
        const settings = await db.collection<WithId<EmailSettings>>('email_settings').findOne({ userId: new ObjectId(session.user._id) });
        if (!settings) throw new Error("Email provider not configured.");
        
        // --- Variable Interpolation ---
        const firstRecipient = to.split(',')[0].trim();
        const contact = await db.collection<CrmContact>('crm_contacts').findOne({ userId: new ObjectId(session.user._id), email: firstRecipient });
        
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
