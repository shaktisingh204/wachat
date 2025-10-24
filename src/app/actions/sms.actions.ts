

'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '.';
import type { SmsProviderSettings, User, SmsCampaign, SmsContact, DltAccount, SmsHeader, DltSmsTemplate, SmsMessage } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import twilio from 'twilio';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export async function saveSmsSettings(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    try {
        const settings: SmsProviderSettings = {
            twilio: {
                accountSid: formData.get('accountSid') as string,
                authToken: formData.get('authToken') as string,
                fromNumber: formData.get('fromNumber') as string,
            },
            dlt: session.user.smsProviderSettings?.dlt || [],
            headers: session.user.smsProviderSettings?.headers || [],
            dltTemplates: session.user.smsProviderSettings?.dltTemplates || []
        };
        
        if (!settings.twilio.accountSid || !settings.twilio.authToken || !settings.twilio.fromNumber) {
            return { error: 'All Twilio fields are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { smsProviderSettings: settings } }
        );

        revalidatePath('/dashboard/sms/settings');
        return { message: 'Twilio settings saved successfully!' };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function getSmsContacts(): Promise<WithId<SmsContact>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const contacts = await db.collection<SmsContact>('sms_contacts')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ createdAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(contacts));
    } catch (e) {
        console.error("Failed to get SMS contacts:", e);
        return [];
    }
}

export async function addSmsContact(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };
    
    try {
        const newContact = {
            userId: new ObjectId(session.user._id),
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
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };
    
    const contactFile = formData.get('contactFile') as File;
    if (!contactFile || contactFile.size === 0) {
        return { error: 'A file is required.' };
    }
    
    const { db } = await connectToDatabase();
    const userId = new ObjectId(session.user._id);

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
                        filter: { phone, userId },
                        update: {
                            $set: { name },
                            $setOnInsert: { phone, userId, createdAt: new Date() }
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

export async function sendSingleSms(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication failed.' };
    
    const recipient = formData.get('recipient') as string;
    const message = formData.get('message') as string;

    if (!recipient || !message) {
        return { error: 'Recipient and message are required.' };
    }
    
    const settings = session.user.smsProviderSettings;
    if (!settings) {
        return { error: 'SMS provider is not configured for this account.' };
    }

    const { accountSid, authToken, fromNumber } = settings.twilio;
    if (!accountSid || !authToken || !fromNumber) {
        return { error: 'Twilio settings are incomplete.' };
    }

    const client = twilio(accountSid, authToken);
    const { db } = await connectToDatabase();
    
    const messageToLog: Omit<SmsMessage, '_id'> = {
        userId: new ObjectId(session.user._id),
        from: fromNumber,
        to: recipient,
        body: message,
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    
    try {
        const twilioResponse = await client.messages.create({
            body: message,
            from: fromNumber,
            to: `+${recipient.replace(/\D/g, '')}`
        });

        messageToLog.smsSid = twilioResponse.sid;
        messageToLog.status = twilioResponse.status;
        messageToLog.errorCode = twilioResponse.errorCode;
        messageToLog.errorMessage = twilioResponse.errorMessage;
        
        await db.collection('sms_messages').insertOne(messageToLog as SmsMessage);
        
        revalidatePath('/dashboard/sms/campaigns');
        revalidatePath('/dashboard/sms/message-history');
        
        return { message: `Message successfully sent to ${recipient}. SID: ${twilioResponse.sid}` };

    } catch (error: any) {
        messageToLog.status = 'failed';
        messageToLog.errorCode = error.code;
        messageToLog.errorMessage = error.message;
        await db.collection('sms_messages').insertOne(messageToLog as SmsMessage);
        
        revalidatePath('/dashboard/sms/campaigns');
        revalidatePath('/dashboard/sms/message-history');

        return { error: getErrorMessage(error) };
    }
}

export async function sendSmsCampaign(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication failed.' };

    const campaignName = formData.get('campaignName') as string;
    const message = formData.get('message') as string;
    const contactFile = formData.get('contactFile') as File;
    const scheduledAt = formData.get('scheduledAt') as string;

    if (!campaignName || !message || (!contactFile || contactFile.size === 0)) {
        return { error: 'All fields and a contact file are required.' };
    }

    const settings = session.user.smsProviderSettings;
    if (!settings) {
        return { error: 'SMS provider is not configured for this account.' };
    }
    
    const { db } = await connectToDatabase();
    let contacts: any[] = [];
    try {
        if (contactFile.name.endsWith('.csv')) {
            const csvText = await contactFile.text();
            contacts = Papa.parse(csvText, { header: true, skipEmptyLines: true }).data;
        } else {
            const fileBuffer = Buffer.from(await contactFile.arrayBuffer());
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) throw new Error('XLSX file has no sheets.');
            const worksheet = workbook.Sheets[sheetName];
            contacts = XLSX.utils.sheet_to_json(worksheet);
        }
    } catch (e) {
        return { error: 'Failed to parse contact file.' };
    }

    if (contacts.length === 0) return { error: 'No contacts found in the file.' };

    const newCampaign: Omit<SmsCampaign, '_id'> = {
        userId: new ObjectId(session.user._id),
        name: campaignName,
        message,
        sentAt: new Date(),
        recipientCount: contacts.length,
        successCount: 0,
        failedCount: 0,
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt), status: 'scheduled' })
    };

    const campaignResult = await db.collection('sms_campaigns').insertOne(newCampaign as any);
    
    if (scheduledAt) {
        revalidatePath('/dashboard/sms/campaigns');
        return { message: `Campaign "${campaignName}" with ${contacts.length} contacts has been scheduled.` };
    }
    
    const { accountSid, authToken, fromNumber } = settings.twilio;
    if (!accountSid || !authToken || !fromNumber) {
        return { error: 'Twilio settings are incomplete.' };
    }
    
    const client = twilio(accountSid, authToken);
    let successfulSends = 0;
    let failedSends = 0;
    const messagesToLog: Omit<SmsMessage, '_id'>[] = [];
    
    const phoneKey = Object.keys(contacts[0])[0]; 
    
    for (const contact of contacts) {
        const phone = String(contact[phoneKey] || '').replace(/\D/g, '');
        if (!phone) {
            failedSends++;
            continue;
        }

        try {
            const twilioResponse = await client.messages.create({
                body: message,
                from: fromNumber,
                to: `+${phone}`
            });
            successfulSends++;
             messagesToLog.push({
                userId: new ObjectId(session.user._id), campaignId: campaignResult.insertedId, from: fromNumber, to: phone, body: message,
                smsSid: twilioResponse.sid, status: twilioResponse.status, createdAt: new Date(), updatedAt: new Date()
            });
        } catch (error) {
            failedSends++;
            messagesToLog.push({
                userId: new ObjectId(session.user._id), campaignId: campaignResult.insertedId, from: fromNumber, to: phone, body: message,
                status: 'failed', errorCode: (error as any).code, errorMessage: (error as any).message, createdAt: new Date(), updatedAt: new Date()
            });
        }
    }
    
    if (messagesToLog.length > 0) {
        await db.collection('sms_messages').insertMany(messagesToLog as SmsMessage[]);
    }
    await db.collection('sms_campaigns').updateOne({ _id: campaignResult.insertedId }, { $set: { successCount: successfulSends, failedCount: failedSends, status: 'sent' } });
    
    revalidatePath('/dashboard/sms/campaigns');
    revalidatePath('/dashboard/sms/message-history');
    
    return { message: `Campaign sent! ${successfulSends} successful, ${failedSends} failed.` };
}

export async function sendSmsTemplate(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication failed.' };

    const recipient = formData.get('recipient') as string;
    const templateId = formData.get('dltTemplateId') as string;
    const headerId = formData.get('headerId') as string;

    if (!recipient || !templateId || !headerId) {
        return { error: 'Recipient, template, and header are required.' };
    }
    
    const settings = session.user.smsProviderSettings;
    if (!settings) {
        return { error: 'SMS provider is not configured for this account.' };
    }

    const { accountSid, authToken, fromNumber } = settings.twilio;
    if (!accountSid || !authToken || !fromNumber) {
        return { error: 'Twilio settings are incomplete.' };
    }
    
    const template = settings.dltTemplates?.find(t => t.dltTemplateId === templateId);
    if (!template) {
        return { error: 'Selected DLT template not found in user settings.' };
    }
    
    let messageBody = template.content;
    const variables = template.variables || [];
    for(const variable of variables) {
        const varValue = formData.get(variable) as string;
        if (!varValue) {
            return { error: `Value for variable "${variable}" is missing.` };
        }
        messageBody = messageBody.replace('{#var#}', varValue);
    }
    
    const client = twilio(accountSid, authToken);
    const { db } = await connectToDatabase();
    
    const messageToLog: Omit<SmsMessage, '_id'> = {
        userId: new ObjectId(session.user._id),
        from: headerId,
        to: recipient,
        body: messageBody,
        dltTemplateId: templateId,
        senderId: headerId,
        status: 'queued',
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    
    try {
        const twilioResponse = await client.messages.create({
            body: messageBody,
            from: headerId,
            to: `+${recipient.replace(/\D/g, '')}`
        });

        messageToLog.smsSid = twilioResponse.sid;
        messageToLog.status = twilioResponse.status;
        
        await db.collection('sms_messages').insertOne(messageToLog as SmsMessage);
        return { message: `Template message successfully sent to ${recipient}.` };

    } catch (error: any) {
        messageToLog.status = 'failed';
        messageToLog.errorCode = error.code;
        messageToLog.errorMessage = error.message;
        await db.collection('sms_messages').insertOne(messageToLog as SmsMessage);
        return { error: getErrorMessage(error) };
    }
}

export async function getSmsCampaigns(): Promise<WithId<SmsCampaign>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const campaigns = await db.collection<SmsCampaign>('sms_campaigns')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ sentAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(campaigns));
    } catch (e) {
        return [];
    }
}

export async function getSmsHistory(
    page: number,
    limit: number,
    query?: string,
    status?: string
): Promise<{ messages: WithId<SmsMessage>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { messages: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const filter: Filter<SmsMessage> = { userId: new ObjectId(session.user._id) };
        if (query) {
            const queryRegex = { $regex: query, $options: 'i' };
            filter.$or = [
                { to: queryRegex },
                { body: queryRegex }
            ]
        }
        if(status) {
            filter.status = status;
        }

        const skip = (page - 1) * limit;
        const [messages, total] = await Promise.all([
            db.collection<SmsMessage>('sms_messages').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('sms_messages').countDocuments(filter)
        ]);

        return { messages: JSON.parse(JSON.stringify(messages)), total };

    } catch(e) {
        console.error("Failed to fetch SMS history:", e);
        return { messages: [], total: 0 };
    }
}


export async function saveDltAccount(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    try {
        const newAccount: DltAccount = {
            _id: new ObjectId(),
            provider: formData.get('provider') as string,
            principalEntityId: formData.get('principalEntityId') as string,
            apiKey: formData.get('apiKey') as string,
            entityName: formData.get('entityName') as string,
            status: 'Active',
        };

        if (!newAccount.provider || !newAccount.principalEntityId || !newAccount.apiKey || !newAccount.entityName) {
            return { error: 'All DLT account fields are required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $push: { 'smsProviderSettings.dlt': newAccount } }
        );

        revalidatePath('/dashboard/sms/dlt');
        return { message: 'DLT account connected successfully!' };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}


export async function deleteDltAccount(dltAccountId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    if (!dltAccountId) return { success: false, error: 'DLT Account ID is required.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $pull: { 'smsProviderSettings.dlt': { _id: new ObjectId(dltAccountId) } } }
        );

        if (result.modifiedCount === 0) {
            return { success: false, error: 'DLT Account not found or could not be removed.' };
        }

        revalidatePath('/dashboard/sms/dlt');
        return { success: true };

    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getSmsHeaders(): Promise<WithId<SmsHeader>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    return session.user.smsProviderSettings?.headers || [];
}

export async function saveSmsHeader(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    try {
        const newHeader: Omit<SmsHeader, '_id'> = {
            name: (formData.get('name') as string).toUpperCase(),
            type: formData.get('type') as SmsHeader['type'],
            status: 'PENDING',
            createdAt: new Date(),
        };

        if (!newHeader.name || !newHeader.type) {
            return { error: 'Header name and type are required.' };
        }
        if (newHeader.name.length > 6) {
             return { error: 'Header name must be 6 characters or less.' };
        }

        const { db } = await connectToDatabase();
        
        newHeader.status = 'APPROVED'; // Forcing APPROVED for demo purposes.

        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $push: { 'smsProviderSettings.headers': { ...newHeader, _id: new ObjectId() } as any } }
        );

        revalidatePath('/dashboard/sms/header-management');
        return { message: `Header "${newHeader.name}" submitted successfully.` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteSmsHeader(headerId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    if (!headerId) return { success: false, error: 'Header ID is required.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $pull: { 'smsProviderSettings.headers': { _id: new ObjectId(headerId) } } }
        );
        revalidatePath('/dashboard/sms/header-management');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getDltTemplates(): Promise<WithId<DltSmsTemplate>[]> {
    const session = await getSession();
    if (!session?.user) return [];
    return session.user.smsProviderSettings?.dltTemplates || [];
}

export async function saveDltTemplate(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const variables = (formData.get('variables') as string).split(',').map(v => v.trim()).filter(Boolean);

    try {
        const newTemplate: Omit<DltSmsTemplate, '_id'> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            dltTemplateId: formData.get('dltTemplateId') as string,
            content: formData.get('content') as string,
            type: formData.get('type') as DltSmsTemplate['type'],
            variables: variables,
            status: 'APPROVED',
            createdAt: new Date(),
        };

        if (!newTemplate.name || !newTemplate.dltTemplateId || !newTemplate.content || !newTemplate.type) {
            return { error: 'All fields are required.' };
        }

        const { db } = await connectToDatabase();
        
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $push: { 'smsProviderSettings.dltTemplates': { ...newTemplate, _id: new ObjectId() } as any } }
        );

        revalidatePath('/dashboard/sms/template-management');
        return { message: `Template "${newTemplate.name}" added successfully.` };
    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteDltTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };
    
    if (!templateId) return { success: false, error: 'Template ID is required.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $pull: { 'smsProviderSettings.dltTemplates': { _id: new ObjectId(templateId) } } }
        );
        revalidatePath('/dashboard/sms/template-management');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

    