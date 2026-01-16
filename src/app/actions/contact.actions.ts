
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/user.actions';
import type { Contact, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { checkRateLimit } from '@/lib/rate-limiter';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';


export async function handleAddNewContact(
    prevState: any, 
    formData: FormData,
    userFromApiKey?: WithId<User>
): Promise<{ message?: string; error?: string, contactId?: string }> {

    let session;
    if (!userFromApiKey) {
        session = await getSession();
        if (!session?.user) {
            return { error: 'Authentication required.' };
        }
    }
    const user = userFromApiKey || session!.user;
    
    const { projectId, phoneNumberId, name, waId, tagIds: tagIdsString } = Object.fromEntries(formData.entries());

    if (!projectId || !phoneNumberId || !name || !waId) {
        return { error: 'Missing required fields.' };
    }

    try {
        const { db } = await connectToDatabase();
        
        const existingContact = await db.collection('contacts').findOne({
            projectId: new ObjectId(projectId as string),
            waId: waId as string,
        });

        if (existingContact) {
            return { error: 'A contact with this WhatsApp ID already exists in this project.' };
        }
        
        const tagIds = tagIdsString && typeof tagIdsString === 'string' && tagIdsString.length > 0
            ? tagIdsString.split(',').map(id => new ObjectId(id))
            : [];

        const newContact: Partial<Contact> = {
            name: name as string,
            waId: waId as string,
            projectId: new ObjectId(projectId as string),
            userId: new ObjectId(user._id),
            phoneNumberId: phoneNumberId as string,
            createdAt: new Date(),
            status: 'open',
            tagIds,
        };

        const result = await db.collection('contacts').insertOne(newContact as any);

        revalidatePath('/dashboard/contacts');

        return { message: 'Contact added successfully.', contactId: result.insertedId.toString() };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteContact(contactId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }

    if (!ObjectId.isValid(contactId)) {
        return { success: false, error: 'Invalid Contact ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        const contactObjectId = new ObjectId(contactId);

        // Optional: Check if the user has permission to delete this contact
        const contact = await db.collection('contacts').findOne({
            _id: contactObjectId,
            userId: new ObjectId(session.user._id)
        });

        if (!contact) {
            return { success: false, error: 'Contact not found or you do not have permission to delete it.' };
        }

        await db.collection('contacts').deleteOne({ _id: contactObjectId });
        
        revalidatePath('/dashboard/contacts');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function handleImportContacts(prevState: any, formData: FormData) {
     const session = await getSession();
    if (!session?.user) {
        return { error: 'Authentication required.' };
    }

    const file = formData.get('contactFile') as File;
    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    
    if (!file || file.size === 0) {
        return { error: 'Please upload a valid CSV or XLSX file.' };
    }

    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);
        const userObjectId = new ObjectId(session.user._id);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        let data: any[] = [];

        if (file.name.endsWith('.csv')) {
            const csvData = Papa.parse(buffer.toString(), { header: true });
            data = csvData.data;
        } else if (file.name.endsWith('.xlsx')) {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            data = XLSX.utils.sheet_to_json(worksheet);
        } else {
            return { error: 'Unsupported file type. Please use CSV or XLSX.' };
        }

        if (data.length === 0) {
            return { error: 'The uploaded file is empty or could not be read.' };
        }
        
        const phoneKey = Object.keys(data[0])[0];
        const nameKey = Object.keys(data[0])[1];
        
        if (!phoneKey) {
            return { error: "Could not find a 'phone' column (or equivalent) in your file." };
        }

        const bulkOps = data.map(row => {
            const phone = String(row[phoneKey]).replace(/\D/g, '');
            const name = nameKey ? String(row[nameKey]) : phone;

            if (!phone) return null;

            return {
                updateOne: {
                    filter: { waId: phone, projectId: projectObjectId },
                    update: {
                        $setOnInsert: {
                            name: name,
                            waId: phone,
                            projectId: projectObjectId,
                            userId: userObjectId,
                            phoneNumberId: phoneNumberId,
                            createdAt: new Date(),
                            status: 'imported',
                        }
                    },
                    upsert: true
                }
            };
        }).filter(Boolean);
        
        if (bulkOps.length > 0) {
            const result = await db.collection('contacts').bulkWrite(bulkOps as any);
            const count = result.upsertedCount + result.modifiedCount;
            revalidatePath('/dashboard/contacts');
            return { message: `${count} contact(s) imported successfully.` };
        }

        return { error: "No valid contacts found in the file." };

    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function handleUpdateContactStatus(contactId: string, status: string, assignedAgentId?: string) {
     const session = await getSession();
    if (!session?.user) {
        return { error: 'Authentication required.' };
    }

    try {
        const { db } = await connectToDatabase();
        const updateDoc: any = { $set: { status } };
        if (assignedAgentId) {
            updateDoc.$set.assignedAgentId = assignedAgentId;
        } else {
            updateDoc.$unset = { assignedAgentId: "" };
        }

        const result = await db.collection('contacts').updateOne(
            { _id: new ObjectId(contactId) },
            updateDoc
        );

        if (result.matchedCount === 0) {
            return { error: 'Contact not found.' };
        }
        revalidatePath('/dashboard/chat/kanban');
        return { success: true };
    } catch(e) {
        return { error: getErrorMessage(e) };
    }
}

export async function handleUpdateContactDetails(prevState: any, formData: FormData) {
     const session = await getSession();
    if (!session?.user) {
        return { error: 'Authentication required.' };
    }
    
    const contactId = formData.get('contactId') as string;
    const variablesJson = formData.get('variables') as string;

    if (!contactId || !variablesJson) {
        return { error: 'Missing contact ID or variables data.'};
    }
    
    try {
        const { db } = await connectToDatabase();
        const variables = JSON.parse(variablesJson);
        
        await db.collection('contacts').updateOne(
            { _id: new ObjectId(contactId) },
            { $set: { variables: variables } }
        );
        revalidatePath('/dashboard/chat');
        return { success: true, message: 'Contact variables updated.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateContactTags(contactId: string, tagIds: string[]): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }

    if (!ObjectId.isValid(contactId)) {
        return { success: false, error: 'Invalid Contact ID.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const tagObjectIds = tagIds.map(id => new ObjectId(id));
        
        await db.collection('contacts').updateOne(
            { _id: new ObjectId(contactId) },
            { $set: { tagIds: tagObjectIds } }
        );
        revalidatePath('/dashboard/chat');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

