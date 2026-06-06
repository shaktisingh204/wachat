'use server';

/**
 * Razorpay integration server actions.
 *
 * These are thin shims around `rustClient.wachatRazorpay.*` (the
 * `wachat-razorpay` crate mounted at `/v1/wachat/razorpay`). The crate owns
 * the project tenancy guard, the `projects.razorpaySettings` sub-doc, and all
 * HTTP to `api.razorpay.com` — so there is **no** in-process `razorpay` npm
 * SDK / `new Razorpay()` here anymore.
 *
 * Notes:
 *  - `getRazorpaySettings` returns the secret MASKED (`••••••••`) — the form
 *    must require re-entry to change it; never persist the masked value back.
 *  - Amounts are in RUPEES; the crate multiplies to paise, so never pre-multiply.
 */

import { revalidatePath } from 'next/cache';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions/project.actions';
import { getSession } from '@/app/actions/user.actions';
import { getErrorMessage } from '@/lib/utils';
import { rustClient } from '@/lib/rust-client';
import type { Contact } from '@/lib/definitions';
import { handleSendMessage } from './whatsapp.actions';

/** Masked placeholder the crate returns in place of a stored secret. */
const MASKED_SECRET = '••••••••';

/**
 * Read the project's Razorpay settings for the integration form.
 * `keySecret` comes back MASKED when configured (never the raw secret); the
 * form must require re-entry to change it.
 */
export async function getRazorpaySettings(
    projectId: string,
): Promise<{ keyId: string; keySecret: string; configured: boolean } | { error: string }> {
    if (!projectId) return { error: 'Project ID is missing.' };
    try {
        const r = await rustClient.wachatRazorpay.getSettings(projectId);
        return { keyId: r.keyId, keySecret: r.keySecret, configured: r.configured };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveRazorpaySettings(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { error: 'Project ID is missing.' };

    const keyId = (formData.get('keyId') as string)?.trim();
    const keySecret = (formData.get('keySecret') as string)?.trim();

    if (!keyId || !keySecret) {
        return { error: 'Both Key ID and Key Secret are required.' };
    }
    // The GET masks the stored secret; refuse to persist the placeholder back.
    if (keySecret === MASKED_SECRET) {
        return { error: 'Please re-enter your Key Secret to update it.' };
    }

    try {
        await rustClient.wachatRazorpay.putSettings(projectId, { keyId, keySecret });
        revalidatePath('/wachat/integrations/razorpay');
        return { message: 'Razorpay settings saved successfully!' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getRazorpayLogs(projectId: string): Promise<
    | { paymentLinks: any[]; transactions: any[] }
    | { error: string }
> {
    if (!projectId) return { error: 'Project ID is missing.' };
    try {
        const [transactionsRes, paymentLinksRes] = await Promise.all([
            rustClient.wachatRazorpay.listTransactions(projectId),
            rustClient.wachatRazorpay.listPaymentLinks(projectId),
        ]);
        return {
            transactions: transactionsRes.items ?? [],
            paymentLinks: paymentLinksRes.items ?? [],
        };
    } catch (e: any) {
        // Not-configured surfaces as a Rust 400 ("Razorpay not configured");
        // treat that as "no logs yet" so the page still renders cleanly.
        const msg = getErrorMessage(e);
        if (/not configured/i.test(msg)) {
            return { paymentLinks: [], transactions: [] };
        }
        return { error: msg };
    }
}

export async function handlePaymentRequest(
    prevState: any,
    formData: FormData,
): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Unauthorized' };

    const contactId = formData.get('contactId') as string;
    const amount = parseFloat(formData.get('amount') as string);
    const description = formData.get('description') as string;

    if (!contactId || !amount || !description) {
        return { error: 'Missing required fields.' };
    }
    // Amount is in RUPEES; the crate multiplies to paise. Don't pre-multiply.
    if (amount < 1) {
        return { error: 'Payment amount must be at least ₹1.' };
    }

    const { db } = await connectToDatabase();
    const contact = await db.collection<Contact>('contacts').findOne({ _id: new ObjectId(contactId) });
    if (!contact) {
        return { error: 'Contact not found.' };
    }

    const project = await getProjectById(contact.projectId.toString());
    if (!project) {
        return { error: 'Project not found.' };
    }

    let link: { id: string; shortUrl: string };
    try {
        // Razorpay expects Indian numbers without +91 — the crate strips it,
        // but we pass the raw waId so the crate owns the normalisation.
        link = await rustClient.wachatRazorpay.createPaymentLink(project._id.toString(), {
            amount,
            contact: contact.waId,
            description,
            name: contact.name,
            ...(contact.email ? { email: contact.email } : {}),
        });
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }

    const message = `Please complete your payment of ₹${amount} for "${description}" by clicking this link: ${link.shortUrl}`;

    const messageFormData = new FormData();
    messageFormData.append('contactId', contact._id.toString());
    messageFormData.append('projectId', contact.projectId.toString());
    messageFormData.append('phoneNumberId', contact.phoneNumberId);
    messageFormData.append('waId', contact.waId);
    messageFormData.append('messageText', message);

    const sendResult = await handleSendMessage(null, messageFormData);

    if (sendResult.error) {
        return { error: `Payment link created, but message failed to send. Please send this link manually: ${link.shortUrl}` };
    }

    return { message: 'Payment link sent successfully.' };
}
