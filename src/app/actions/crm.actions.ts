

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmContact, CrmPermissions, User, CrmAccount } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Readable } from 'stream';

export async function getCrmContacts(
    page: number = 1,
    limit: number = 20,
    query?: string,
    accountId?: string,
): Promise<{ contacts: WithId<CrmContact>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { contacts: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: Filter<CrmContact> = { userId: userObjectId };
        if (query) {
            const queryRegex = { $regex: query, $options: 'i' };
            filter.$or = [
                { name: queryRegex },
                { email: queryRegex },
                { company: queryRegex }
            ];
        }
        if (accountId && ObjectId.isValid(accountId)) {
            filter.accountId = new ObjectId(accountId);
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

    const session = await getSession();
    if (!session?.user) return null;

    try {
        const { db } = await connectToDatabase();
        const contact = await db.collection<CrmContact>('crm_contacts').findOne({ 
            _id: new ObjectId(contactId),
            userId: new ObjectId(session.user._id)
        });
        
        return contact ? JSON.parse(JSON.stringify(contact)) : null;

    } catch(e) {
        return null;
    }
}

export async function addCrmClient(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const newAccount: Partial<CrmAccount> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('businessName') as string,
            industry: formData.get('clientIndustry') as string,
            phone: formData.get('phone') as string,
            // email: formData.get('email') as string, // CrmAccount doesn't have email yet
            createdAt: new Date(),
        };

        if (!newAccount.name) {
            return { error: 'Business Name is required.' };
        }
        
        // This is a simplified action. You would expand your CrmAccount and CrmContact
        // definitions in `lib/definitions.ts` to store all the new fields,
        // then save them to the database here.
        // For now, it saves to the crm_accounts collection.

        const { db } = await connectToDatabase();
        await db.collection('crm_accounts').insertOne(newAccount as CrmAccount);
        
        revalidatePath('/dashboard/crm/sales/clients');
        return { message: 'Client added successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function addCrmContact(prevState: any, formData: FormData): Promise<{ message?: string, error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    try {
        const accountId = formData.get('accountId') as string;
        const leadScore = formData.get('leadScore') as string;

        const newContact: Partial<CrmContact> = {
            userId: new ObjectId(session.user._id),
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            phone: formData.get('phone') as string,
            company: formData.get('company') as string,
            jobTitle: formData.get('jobTitle') as string,
            status: (formData.get('status') as CrmContact['status']) || 'new_lead',
            notes: [],
            createdAt: new Date(),
        };
        
        if (accountId && ObjectId.isValid(accountId)) {
            newContact.accountId = new ObjectId(accountId);
        }
        if (leadScore) {
            newContact.leadScore = parseInt(leadScore, 10);
        }


        const { db } = await connectToDatabase();
        await db.collection('crm_contacts').insertOne(newContact as CrmContact);
        
        revalidatePath('/dashboard/crm/contacts');
        revalidatePath('/dashboard/crm/accounts');
        return { message: 'Contact added successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function importCrmContacts(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
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
                                phone: row.phone,
                                company: row.company,
                                jobTitle: row.jobTitle,
                                status: row.status || 'imported',
                                leadScore: Number(row.leadScore) || 0,
                            },
                            $setOnInsert: { email, userId: new ObjectId(session.user._id), createdAt: new Date() }
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
    const recordId = formData.get('recordId') as string;
    const recordType = formData.get('recordType') as 'contact' | 'account' | 'deal';
    const content = formData.get('noteContent') as string;

    if (!recordId || !content || !recordType) {
        return { error: 'Note content and record details cannot be empty.' };
    }

    const session = await getSession();
    if (!session?.user?.name) {
        return { error: 'Authentication error.' };
    }
    
    // In a real app, you would validate that the current user has access to this record.
    // For now, we'll trust the client, but this is a security risk.

    const note = {
        content,
        author: session.user.name,
        createdAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        let collectionName = '';
        if (recordType === 'contact') collectionName = 'crm_contacts';
        else if (recordType === 'account') collectionName = 'crm_accounts';
        else if (recordType === 'deal') collectionName = 'crm_deals';
        else return { error: 'Invalid record type' };
        
        await db.collection(collectionName).updateOne(
            { _id: new ObjectId(recordId), userId: new ObjectId(session.user._id) },
            { $push: { notes: { $each: [note], $position: 0 } } }
        );

        revalidatePath(`/dashboard/crm/${recordType}s/${recordId}`);
        return { message: 'Note added successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveCrmProviders(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };

    const whatsappProjectId = formData.get('whatsappProjectId') as string;

    try {
        const { db } = await connectToDatabase();
        
        const updateData: { 'crm.whatsappProjectId'?: ObjectId } = {};
        if (whatsappProjectId && ObjectId.isValid(whatsappProjectId)) {
            updateData['crm.whatsappProjectId'] = new ObjectId(whatsappProjectId);
        }

        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: updateData }
        );
        
        revalidatePath('/dashboard/crm/settings');
        return { message: 'Provider settings saved successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveCrmPermissions(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };
    
    const modules = ['contacts', 'accounts', 'deals', 'tasks'];
    const permissions = ['view', 'create', 'edit', 'delete'];

    const newPermissions: CrmPermissions = { agent: {} };

    for(const module of modules) {
        newPermissions.agent[module as keyof CrmPermissions['agent']] = {
            view: formData.get(`${module}_view`) === 'on',
            create: formData.get(`${module}_create`) === 'on',
            edit: formData.get(`${module}_edit`) === 'on',
            delete: formData.get(`${module}_delete`) === 'on',
        }
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { 'crm.permissions': newPermissions } }
        );

        revalidatePath('/dashboard/crm/settings');
        return { message: "CRM permissions saved successfully." };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function saveCrmIndustry(industry: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: "You must be logged in to perform this action." };
    }

    if (!industry) {
        return { success: false, error: "An industry must be selected." };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection<User>('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { crmIndustry: industry } }
        );
        
        revalidatePath('/dashboard/crm');
        
        return { success: true };
    } catch (e: any) {
        return { success: false, error: "Failed to save industry selection." };
    }
}
