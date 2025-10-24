
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById, getSession } from '.';
import type { SmsProviderSettings, Project, SmsCampaign, SmsContact } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import twilio from 'twilio';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

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

export async function getSmsContacts(projectId: string): Promise<WithId<SmsContact>[]> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const contacts = await db.collection<SmsContact>('sms_contacts')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(contacts));
    } catch (e) {
        console.error("Failed to get SMS contacts:", e);
        return [];
    }
}

export async function addSmsContact(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { error: 'Project ID is missing.' };
    
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: 'Access denied.' };

    try {
        const newContact = {
            projectId: new ObjectId(projectId),
            name: formData.get('name') as string,
            phone: (formData.get('phone') as string).replace(/\D/g, ''),
            createdAt: new Date(),
        };

        if (!newContact.name || !newContact.phone) {
            return { error: 'Name and phone number are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('sms_contacts').insertOne(newContact);
        
        revalidatePath('/dashboard/sms/contacts');
        return { message: 'SMS contact added successfully.' };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function importSmsContacts(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    if (!projectId) return { error: 'Project ID is missing.' };
    
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: 'Access denied.' };
    
    const contactFile = formData.get('contactFile') as File;
    if (!contactFile || contactFile.size === 0) {
        return { error: 'A file is required.' };
    }
    
    const { db } = await connectToDatabase();

    const processContacts = (contacts: any[]): Promise<number> => {
        return new Promise<number>(async (resolve, reject) => {
            if (contacts.length === 0) return resolve(0);
            
            const phoneKey = Object.keys(contacts[0])[0];
            const nameKey = Object.keys(contacts[0])[1];
            if (!phoneKey || !nameKey) return reject(new Error('File must have at least two columns: phone and name.'));

            const bulkOps = contacts.map(row => {
                const phone = String(row[phoneKey] || '').replace(/\D/g, '');
                const name = String(row[nameKey] || '').trim();
                if (!phone || !name) return null;

                return {
                    updateOne: {
                        filter: { phone, projectId: new ObjectId(projectId) },
                        update: {
                            $set: { name },
                            $setOnInsert: { phone, projectId: new ObjectId(projectId), createdAt: new Date() }
                        },
                        upsert: true
                    }
                };
            }).filter(Boolean);

            if (bulkOps.length === 0) return resolve(0);

            const result = await db.collection('sms_contacts').bulkWrite(bulkOps as any[]);
            resolve(result.upsertedCount + result.modifiedCount);
        });
    };
    
    try {
        let contactCount = 0;
        if (contactFile.name.endsWith('.csv')) {
            const csvText = await contactFile.text();
            const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            contactCount = await processContacts(parsed.data);
        } else if (contactFile.name.endsWith('.xlsx')) {
            const fileBuffer = Buffer.from(await contactFile.arrayBuffer());
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) throw new Error('XLSX file has no sheets.');
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            contactCount = await processContacts(jsonData);
        } else {
            return { error: 'Unsupported file type. Please use .csv or .xlsx.' };
        }
        
        if (contactCount === 0) {
            return { error: 'No valid contacts found in the file.' };
        }
        
        revalidatePath('/dashboard/sms/contacts');
        return { message: `Successfully imported ${contactCount} SMS contact(s).` };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function sendSmsCampaign(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const campaignName = formData.get('campaignName') as string;
    const message = formData.get('message') as string;
    
    if (!projectId || !campaignName || !message) {
        return { error: 'All fields are required.' };
    }

    const project = await getProjectById(projectId);
    if (!project || !project.smsProviderSettings) {
        return { error: 'SMS provider is not configured for this project.' };
    }

    const { accountSid, authToken, fromNumber } = project.smsProviderSettings.twilio;
    if (!accountSid || !authToken || !fromNumber) {
        return { error: 'Twilio settings are incomplete.' };
    }
    
    const { db } = await connectToDatabase();
    const contacts = await db.collection('sms_contacts').find({ projectId: new ObjectId(projectId) }).toArray();
    
    if (contacts.length === 0) {
        return { error: 'No contacts to send to.' };
    }
    
    const client = twilio(accountSid, authToken);
    let successfulSends = 0;
    let failedSends = 0;
    
    for (const contact of contacts) {
        try {
            await client.messages.create({
                body: message,
                from: fromNumber,
                to: `+${contact.phone}` // Assuming numbers are stored without '+'
            });
            successfulSends++;
        } catch (error) {
            console.error(`Failed to send SMS to ${contact.phone}:`, error);
            failedSends++;
        }
    }
    
    const newCampaign: Omit<SmsCampaign, '_id'> = {
        projectId: new ObjectId(projectId),
        name: campaignName,
        message,
        sentAt: new Date(),
        recipientCount: contacts.length,
        successCount: successfulSends,
        failedCount: failedSends
    };
    
    await db.collection('sms_campaigns').insertOne(newCampaign as any);
    
    revalidatePath('/dashboard/sms/campaigns');
    revalidatePath('/dashboard/sms');
    
    return { message: `Campaign sent! ${successfulSends} successful, ${failedSends} failed.` };
}

export async function getSmsCampaigns(projectId: string): Promise<WithId<SmsCampaign>[]> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return [];

    try {
        const { db } = await connectToDatabase();
        const campaigns = await db.collection<SmsCampaign>('sms_campaigns')
            .find({ projectId: new ObjectId(projectId) })
            .sort({ sentAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(campaigns));
    } catch (e) {
        return [];
    }
}
