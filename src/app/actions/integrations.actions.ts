

'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import { getErrorMessage } from '@/lib/utils';
import Razorpay from 'razorpay';
import type { Project, WhatsAppWidgetSettings } from '@/lib/definitions';

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

export async function createRazorpayPaymentLink(
    project: WithId<Project>,
    amount: number,
    description: string,
    contact: { waId: string, name: string, email?: string }
): Promise<{ short_url: string, id: string } | { error: string }> {
    const settings = project.razorpaySettings;
    if (!settings?.keyId || !settings?.keySecret) {
        return { error: 'Razorpay is not configured for this project.' };
    }
    
    if(amount < 1) {
        return { error: 'Payment amount must be at least ₹1.' };
    }

    try {
        const instance = new Razorpay({
            key_id: settings.keyId,
            key_secret: settings.keySecret,
        });

        const options = {
            amount: amount * 100, // amount in the smallest currency unit
            currency: "INR",
            accept_partial: false,
            description,
            customer: {
                name: contact.name,
                contact: contact.waId.substring(contact.waId.length - 10), // Assuming Indian numbers
                ...(contact.email && { email: contact.email })
            },
            notify: {
                sms: true,
                email: !!contact.email
            },
            reminder_enable: true,
            callback_url: "https://sabnode.com/payment-success",
            callback_method: "get" as "get"
        };

        const paymentLink = await instance.paymentLink.create(options);
        return { short_url: paymentLink.short_url, id: paymentLink.id };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

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
