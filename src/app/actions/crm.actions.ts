
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getProjectById } from '@/app/actions';
import type { CrmContact } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';

export async function getCrmContacts(
    projectId: string,
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ contacts: WithId<CrmContact>[], total: number }> {
    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { contacts: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);
        
        const filter: Filter<CrmContact> = { projectId: projectObjectId };
        if (query) {
            const queryRegex = { $regex: query, $options: 'i' };
            filter.$or = [
                { name: queryRegex },
                { email: queryRegex },
                { company: queryRegex }
            ];
        }

        const skip = (page - 1) * limit;

        const [contacts, total] = await Promise.all([
            db.collection<CrmContact>('crm_contacts').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('crm_contacts').countDocuments(filter)
        ]);

        return {
            contacts: JSON.parse(JSON.stringify(contacts)),
            total
        };
    } catch (e: any) {
        return { contacts: [], total: 0 };
    }
}

export async function getCrmContactById(contactId: string): Promise<WithId<CrmContact> | null> {
    if (!ObjectId.isValid(contactId)) return null;

    try {
        const { db } = await connectToDatabase();
        const contact = await db.collection<CrmContact>('crm_contacts').findOne({ _id: new ObjectId(contactId) });
        if (!contact) return null;
        
        const hasAccess = await getProjectById(contact.projectId.toString());
        if (!hasAccess) return null;

        return JSON.parse(JSON.stringify(contact));
    } catch(e) {
        return null;
    }
}

export async function addCrmContact(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const projectId = formData.get('projectId') as string;
    const project = await getProjectById(projectId);
    if (!project) return { error: "Access denied" };

    try {
        const newContact: Omit<CrmContact, '_id'> = {
            projectId: new ObjectId(projectId),
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            company: formData.get('company') as string,
            jobTitle: formData.get('jobTitle') as string,
            status: 'new_lead',
            leadScore: 0,
            notes: [],
            createdAt: new Date(),
        };

        const { db } = await connectToDatabase();
        await db.collection('crm_contacts').insertOne(newContact as any);
        
        revalidatePath('/dashboard/crm/contacts');
        return { message: 'Contact added successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function importCrmContacts(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const projectId = formData.get('projectId') as string;
    const contactFile = formData.get('contactFile') as File;

    if (!projectId || !contactFile || contactFile.size === 0) {
        return { error: 'Project and a file are required.' };
    }

    const hasAccess = await getProjectById(projectId);
    if (!hasAccess) return { error: 'Access denied.' };
    
    const { db } = await connectToDatabase();

    const processContacts = (contacts: any[]): Promise<number> => {
        return new Promise<number>(async (resolve, reject) => {
            if (contacts.length === 0) return resolve(0);
            
            const bulkOps = contacts.map(row => {
                const email = String(row.email || '').trim().toLowerCase();
                if (!email) return null;

                return {
                    updateOne: {
                        filter: { email, projectId: new ObjectId(projectId) },
                        update: {
                            $set: {
                                name: row.name || email,
                                phone: row.phone,
                                company: row.company,
                                jobTitle: row.jobTitle,
                                status: row.status || 'imported',
                                leadScore: Number(row.leadScore) || 0,
                            },
                            $setOnInsert: { email, projectId: new ObjectId(projectId), createdAt: new Date() }
                        },
                        upsert: true
                    }
                }
            }).filter(Boolean);

            if (bulkOps.length === 0) return resolve(0);

            const result = await db.collection('crm_contacts').bulkWrite(bulkOps as any[]);
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
        
        revalidatePath('/dashboard/crm/contacts');
        return { message: `Successfully imported ${contactCount} contact(s).` };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function addCrmNote(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const contactId = formData.get('contactId') as string;
    const content = formData.get('noteContent') as string;

    if (!contactId || !content) {
        return { error: 'Note content cannot be empty.' };
    }
    
    const contact = await getCrmContactById(contactId);
    if (!contact) return { error: "Contact not found" };

    // In a real app, you'd get the author from the session.
    const note = {
        content,
        author: "Admin User",
        createdAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        await db.collection('crm_contacts').updateOne(
            { _id: new ObjectId(contactId) },
            { $push: { notes: { $each: [note], $position: 0 } } }
        );
        revalidatePath(`/dashboard/crm/contacts/${contactId}`);
        return { message: 'Note added successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}
