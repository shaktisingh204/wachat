

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { EmailContact, EmailCampaign, CrmEmailTemplate } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { getTransporter } from '@/lib/email-service';

export async function addEmailContact(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const newContact: Partial<EmailContact> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            tags: [],
            createdAt: new Date(),
        };

        if (!newContact.email) {
            return { error: 'Email is required.' };
        }

        const { db } = await connectToDatabase();
        await db.collection('email_contacts').insertOne(newContact as EmailContact);
        
        revalidatePath('/dashboard/email/contacts');
        return { message: 'Contact added successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function importEmailContacts(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const contactFile = formData.get('contactFile') as File;
    if (!contactFile || contactFile.size === 0) {
        return { error: 'A file is required.' };
    }
    
    const { db } = await connectToDatabase();

    const processContacts = (contacts: any[]): Promise<number> => {
        return new Promise<number>(async (resolve, reject) => {
            if (contacts.length === 0) return resolve(0);
            
            const bulkOps = contacts.map(row => {
                const email = String(row.email || '').trim().toLowerCase();
                if (!email) return null;

                return {
                    updateOne: {
                        filter: { email, userId: new ObjectId(session.user._id) },
                        update: {
                            $set: {
                                name: row.name || email,
                            },
                            $setOnInsert: { email, userId: new ObjectId(session.user._id), createdAt: new Date(), tags: [] }
                        },
                        upsert: true
                    }
                }
            }).filter(Boolean);

            if (bulkOps.length === 0) return resolve(0);

            const result = await db.collection('email_contacts').bulkWrite(bulkOps as any[]);
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
            if (!sheetName) throw new Error('The XLSX file contains no sheets.');
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            contactCount = await processContacts(jsonData);
        } else {
             return { error: 'Unsupported file type. Please upload a .csv or .xlsx file.' };
        }
        
        if (contactCount === 0) {
            return { error: 'No valid contacts with emails found to import.' };
        }
        
        revalidatePath('/dashboard/email/contacts');
        return { message: `Successfully imported ${contactCount} contact(s).` };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function getEmailContacts(
    page: number = 1,
    limit: number = 20,
    query?: string,
): Promise<{ contacts: WithId<EmailContact>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { contacts: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: Filter<EmailContact> = { userId: userObjectId };
        if (query) {
            const queryRegex = { $regex: query, $options: 'i' };
            filter.$or = [
                { name: queryRegex },
                { email: queryRegex },
            ];
        }

        const skip = (page - 1) * limit;

        const [contacts, total] = await Promise.all([
            db.collection<EmailContact>('email_contacts').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('email_contacts').countDocuments(filter)
        ]);

        return {
            contacts: JSON.parse(JSON.stringify(contacts)),
            total
        };
    } catch (e: any) {
        return { contacts: [], total: 0 };
    }
}

export async function getEmailTemplates(): Promise<WithId<CrmEmailTemplate>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const templates = await db.collection<CrmEmailTemplate>('email_templates')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ updatedAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(templates));
    } catch (e) {
        console.error("Failed to fetch email templates:", e);
        return [];
    }
}

export async function saveEmailTemplate(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
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
            await db.collection('email_templates').updateOne(
                { _id: new ObjectId(templateId), userId: new ObjectId(session.user._id) },
                { $set: templateData }
            );
        } else {
            templateData.createdAt = new Date();
            await db.collection('email_templates').insertOne(templateData as CrmEmailTemplate);
        }
        
        revalidatePath('/dashboard/email/templates');
        return { message: 'Email template saved successfully.' };

    } catch (e) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteEmailTemplate(templateId: string): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(templateId)) return { success: false, error: 'Invalid Template ID.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Access denied.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('email_templates').deleteOne({ 
            _id: new ObjectId(templateId), 
            userId: new ObjectId(session.user._id) 
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Template not found or you do not have permission to delete it.' };
        }
        
        revalidatePath('/dashboard/email/templates');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getEmailCampaigns(): Promise<WithId<EmailCampaign>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const campaigns = await db.collection<EmailCampaign>('email_campaigns')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ createdAt: -1 })
            .limit(50)
            .toArray();
        return JSON.parse(JSON.stringify(campaigns));
    } catch(e) {
        return [];
    }
}


export async function handleSendBulkEmail(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied." };

    const subject = formData.get('subject') as string;
    const body = formData.get('body') as string;
    const fromName = formData.get('fromName') as string;
    const fromEmail = formData.get('fromEmail') as string;
    const contactFile = formData.get('contactFile') as File;
    const scheduledAt = formData.get('scheduledAt') as string;
    
    if (!subject || !body || !contactFile || contactFile.size === 0 || !fromName || !fromEmail) {
        return { error: "From name, from email, subject, body, and a contact file are required." };
    }

    try {
        const { db } = await connectToDatabase();
        const campaignName = `Campaign - ${new Date().toLocaleString()}`;

        const newCampaign: Omit<EmailCampaign, '_id'> = {
            userId: new ObjectId(session.user._id),
            name: campaignName,
            subject, body, fromName, fromEmail,
            status: scheduledAt ? 'scheduled' : 'sending',
            createdAt: new Date(),
            ...(scheduledAt && { scheduledAt: new Date(scheduledAt) })
        };
        const campaignResult = await db.collection('email_campaigns').insertOne(newCampaign as any);
        const campaignId = campaignResult.insertedId;

        // In a real app, this would be a background job. For now, we process it directly.
        if (!scheduledAt) {
            const transporter = await getTransporter();
            const contacts: any[] = [];
            const csvText = await contactFile.text();
            Papa.parse(csvText, {
              header: true,
              skipEmptyLines: true,
              complete: async (results) => {
                for (const contact of results.data) {
                  const contactEmail = (contact as any).email;
                  if (!contactEmail) continue;

                  const interpolatedSubject = subject.replace(/{{\s*(\w+)\s*}}/g, (match, key) => (contact as any)[key] || match);
                  const interpolatedBody = body.replace(/{{\s*(\w+)\s*}}/g, (match, key) => (contact as any)[key] || match);

                  try {
                    await transporter.sendMail({
                        from: `"${fromName}" <${fromEmail}>`,
                        to: contactEmail,
                        subject: interpolatedSubject,
                        html: interpolatedBody,
                    });
                  } catch (e) {
                      console.error(`Failed to send email to ${contactEmail}:`, getErrorMessage(e));
                  }
                }
                 await db.collection('email_campaigns').updateOne({ _id: campaignId }, { $set: { status: 'sent', sentAt: new Date() } });
                 revalidatePath('/dashboard/email/campaigns');
              },
            });
        }

        revalidatePath('/dashboard/email/campaigns');
        return { message: scheduledAt ? 'Campaign scheduled successfully!' : 'Campaign is sending now!' };

    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}
