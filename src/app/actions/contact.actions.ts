

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById, getSession } from '@/app/actions';
import type { Contact } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';

export async function handleAddNewContact(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const name = formData.get('name') as string;
    const waId = (formData.get('waId') as string).replace(/\D/g, ''); 

    if (!projectId || !phoneNumberId || !name || !waId) {
        return { error: 'All fields are required.' };
    }

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: "Access denied." };

    try {
        const { db } = await connectToDatabase();
        const existingContact = await db.collection('contacts').findOne({ projectId: new ObjectId(projectId), waId });

        if (existingContact) {
            return { error: 'A contact with this WhatsApp ID already exists for this project.' };
        }
        
        const newContact: Omit<Contact, '_id'> = {
            projectId: new ObjectId(projectId),
            waId,
            phoneNumberId,
            name,
            createdAt: new Date(),
            status: 'new',
            tagIds: [],
        };

        await db.collection('contacts').insertOne(newContact as any);
        
        revalidatePath('/dashboard/contacts');
        
        return { message: 'Contact added successfully.' };
    } catch (e: any) {
        console.error('Failed to add new contact:', e);
        return { error: e.message || 'An unexpected error occurred.' };
    }
}

export async function handleImportContacts(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const contactFile = formData.get('contactFile') as File;

    if (!projectId || !phoneNumberId || !contactFile || contactFile.size === 0) {
        return { error: 'Project, phone number, and a file are required.' };
    }

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: 'Access denied.' };
    
    const { db } = await connectToDatabase();

    const processContacts = (contacts: any[]): Promise<number> => {
        return new Promise<number>(async (resolve, reject) => {
            if (contacts.length === 0) return resolve(0);
            
            const phoneKey = Object.keys(contacts[0])[0];
            const nameKey = Object.keys(contacts[0])[1];
            if (!phoneKey || !nameKey) return reject(new Error('File must have at least two columns: phone and name.'));
            
            const bulkOps = contacts.map(row => {
                const waId = String(row[phoneKey] || '').replace(/\D/g, '');
                const name = String(row[nameKey] || '').trim();

                if (!waId || !name) return null;

                return {
                    updateOne: {
                        filter: { waId, projectId: new ObjectId(projectId) },
                        update: {
                            $set: { name, phoneNumberId },
                            $setOnInsert: { waId, projectId: new ObjectId(projectId), createdAt: new Date(), status: 'new', tagIds: [] }
                        },
                        upsert: true
                    }
                }
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
            if (!sheetName) throw new Error('The XLSX file contains no sheets.');
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            contactCount = await processContacts(jsonData);
        } else {
             return { error: 'Unsupported file type. Please upload a .csv or .xlsx file.' };
        }
        
        if (contactCount === 0) {
            return { error: 'No valid contacts found to import.' };
        }
        
        revalidatePath('/dashboard/contacts');
        return { message: `Successfully imported ${contactCount} contact(s).` };
    } catch (e: any) {
        console.error('Failed to import contacts:', e);
        return { error: e.message || 'An unexpected error occurred during import.' };
    }
}

export async function getContactsPageData(
    projectId: string, 
    phoneNumberId: string, 
    page: number, 
    query: string,
    tags?: string[],
): Promise<{
    project: WithId<Project> | null,
    contacts: WithId<Contact>[],
    total: number,
    selectedPhoneNumberId: string
}> {
    const projectData = await getProjectById(projectId);
    if (!projectData) return { project: null, contacts: [], total: 0, selectedPhoneNumberId: '' };

    let selectedPhoneId = phoneNumberId;
    if (!selectedPhoneId && projectData.phoneNumbers?.length > 0) {
        selectedPhoneId = projectData.phoneNumbers[0].id;
    }
    
    if (!selectedPhoneId) return { project: projectData, contacts: [], total: 0, selectedPhoneNumberId: '' };

    const { db } = await connectToDatabase();
    const filter: Filter<Contact> = { projectId: new ObjectId(projectId), phoneNumberId: selectedPhoneId };
    
    if (query) {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const queryRegex = { $regex: escapedQuery, $options: 'i' };
        filter.$or = [
            { name: queryRegex },
            { waId: queryRegex },
        ];
    }

    if (tags && tags.length > 0) {
        filter.tagIds = { $in: tags };
    }
    
    const skip = (page - 1) * 20;

    const [contacts, total] = await Promise.all([
        db.collection('contacts').find(filter).sort({ lastMessageTimestamp: -1 }).skip(skip).limit(20).toArray(),
        db.collection('contacts').countDocuments(filter)
    ]);
    
    return {
        project: JSON.parse(JSON.stringify(projectData)),
        contacts: JSON.parse(JSON.stringify(contacts)),
        total,
        selectedPhoneNumberId: selectedPhoneId
    };
}
