

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById, getSession } from '@/app/actions/index.ts';
import { getErrorMessage } from '@/lib/utils';
import type { Contact } from '@/lib/definitions';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// This function is now the single source of truth for fetching paginated contacts.
export async function getContactsPageData(
    projectId: string,
    page: number = 1,
    query?: string,
    tagIds?: string[]
): Promise<{ contacts: WithId<Contact>[], total: number, project: WithId<Project> | null }> {
    const project = await getProjectById(projectId);
    if (!project) return { contacts: [], total: 0, project: null };

    try {
        const { db } = await connectToDatabase();
        const contactFilter: any = { projectId: new ObjectId(projectId) };

        if (query) {
            const queryRegex = { $regex: query, $options: 'i' };
            contactFilter.$or = [
                { name: queryRegex },
                { waId: queryRegex },
            ];
        }
        
        if (tagIds && tagIds.length > 0) {
            contactFilter.tagIds = { $in: tagIds };
        }

        const skip = (page - 1) * 20;

        const [contacts, total] = await Promise.all([
            db.collection<Contact>('contacts').find(contactFilter).sort({ lastMessageTimestamp: -1 }).skip(skip).limit(20).toArray(),
            db.collection('contacts').countDocuments(contactFilter)
        ]);
        
        return {
            contacts: JSON.parse(JSON.stringify(contacts)),
            total,
            project: JSON.parse(JSON.stringify(project))
        };
    } catch (e) {
        console.error("Failed to fetch contacts page data:", e);
        return { contacts: [], total: 0, project: null };
    }
}

export async function handleAddNewContact(prevState: any, formData: FormData, user?: any): Promise<{ message?: string; error?: string, contactId?: string }> {
    const session = user ? { user } : await getSession();
    if (!session?.user) {
        return { error: 'Authentication required.' };
    }

    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const name = formData.get('name') as string;
    const waId = (formData.get('waId') as string).replace(/\D/g, '');

    if (!projectId || !phoneNumberId || !name || !waId) {
        return { error: 'Project ID, Phone Number ID, Name, and WhatsApp ID are required.' };
    }
    
    const hasAccess = await getProjectById(projectId, session.user._id);
    if (!hasAccess) return { error: "Access denied." };

    const newContact: Omit<Contact, '_id'> = {
        projectId: new ObjectId(projectId),
        phoneNumberId,
        name,
        waId,
        createdAt: new Date(),
        status: 'new'
    };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('contacts').insertOne(newContact as any);
        revalidatePath('/dashboard/contacts');
        return { message: 'Contact added successfully.', contactId: result.insertedId.toString() };
    } catch (e: any) {
        if (e.code === 11000) {
            return { error: 'A contact with this WhatsApp ID already exists in this project.' };
        }
        return { error: getErrorMessage(e) || 'An unexpected error occurred.' };
    }
}

export async function handleImportContacts(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied.' };

    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const contactFile = formData.get('contactFile') as File;
    
    if (!projectId || !phoneNumberId || !contactFile || contactFile.size === 0) {
        return { error: 'Project ID, Phone Number, and a file are required.' };
    }
    
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };
    
    const { db } = await connectToDatabase();
    const projectObjectId = new ObjectId(projectId);

    const processContacts = (contacts: any[]): Promise<number> => {
        return new Promise<number>(async (resolve, reject) => {
            if (contacts.length === 0) return resolve(0);
            
            const phoneKey = Object.keys(contacts[0])[0];
            const nameKey = Object.keys(contacts[0])[1];

            const bulkOps = contacts.map(row => {
                const phone = String(row[phoneKey] || '').replace(/\D/g, '');
                const name = String(row[nameKey] || '').trim();
                if (!phone || !name) return null;

                const contactDoc: Omit<Contact, '_id'> = {
                    projectId: projectObjectId,
                    phoneNumberId,
                    waId: phone,
                    name,
                    createdAt: new Date(),
                    status: 'imported',
                };
                
                return {
                    updateOne: {
                        filter: { waId: phone, projectId: projectObjectId },
                        update: {
                            $setOnInsert: contactDoc,
                            $set: { name: name } // Update name if contact exists
                        },
                        upsert: true
                    }
                };
            }).filter(Boolean);

            if (bulkOps.length === 0) return resolve(0);

            const result = await db.collection('contacts').bulkWrite(bulkOps as any[]);
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
        
        revalidatePath('/dashboard/contacts');
        return { message: `Successfully imported ${contactCount} contact(s).` };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateContactTags(contactId: string, tagIds: string[]): Promise<{ success: boolean, error?: string }> {
    if (!ObjectId.isValid(contactId)) return { success: false, error: 'Invalid contact ID.' };

    const session = await getSession();
    if (!session?.user) return { success: false, error: "Authentication required." };
    
    try {
        const { db } = await connectToDatabase();
        
        await db.collection('contacts').updateOne(
            { _id: new ObjectId(contactId) },
            { $set: { tagIds: tagIds } }
        );
        revalidatePath('/dashboard/chat');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: 'Failed to update tags.' };
    }
}
