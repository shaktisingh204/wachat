

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { EmailContact } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

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
