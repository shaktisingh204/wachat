

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { Contact, Project, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { checkRateLimit } from '@/lib/rate-limiter';
import * as Papa from 'papaparse';


export async function handleAddNewContact(
    prevState: any, 
    formData: FormData,
    sessionUser?: any // For API key authentication
): Promise<{ message?: string; error?: string, contactId?: string }> {
    const session = sessionUser ? { user: sessionUser } : await getSession();
    if (!session?.user) {
        return { error: 'Authentication required.' };
    }

    const projectId = formData.get('projectId') as string;
    const phoneNumberId = formData.get('phoneNumberId') as string;
    const name = formData.get('name') as string;
    const countryCode = formData.get('countryCode') as string;
    const phone = formData.get('phone') as string;
    const tagIds = (formData.get('tagIds') as string)?.split(',').filter(Boolean) || [];

    if (!countryCode || !phone) {
        return { error: 'Country code and phone number are required.' };
    }

    // Sanitize and combine phone number parts
    const waId = `${countryCode.replace(/\D/g, '')}${phone.replace(/\D/g, '')}`;

    if (!projectId || !phoneNumberId || !name) {
        return { error: 'Project, Phone Number, and Name are required.' };
    }

    try {
        const { db } = await connectToDatabase();

        const project = await db.collection<WithId<Project>>('projects').findOne({ 
            _id: new ObjectId(projectId), 
            $or: [
                { userId: new ObjectId(session.user._id) },
                { 'agents.userId': new ObjectId(session.user._id) }
            ]
        });

        if (!project) {
            return { error: 'Project not found or you do not have permission.' };
        }

        const existingContact = await db.collection('contacts').findOne({ waId, projectId: new ObjectId(projectId) });

        if (existingContact) {
            return { error: 'A contact with this WhatsApp ID already exists in this project.' };
        }
        
        const newContact: Omit<Contact, '_id'> = {
            projectId: new ObjectId(projectId),
            phoneNumberId,
            name,
            waId,
            userId: new ObjectId(session.user._id),
            status: 'new',
            createdAt: new Date(),
            updatedAt: new Date(),
            tagIds: tagIds.map(id => new ObjectId(id))
        };

        const result = await db.collection('contacts').insertOne(newContact as any);
        
        revalidatePath('/dashboard/contacts');

        return { message: `Contact "${name}" added successfully.`, contactId: result.insertedId.toString() };

    } catch (e: any) {
        console.error("Failed to add contact:", e);
        return { error: getErrorMessage(e) };
    }
}

export async function handleImportContacts(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user) {
    return { error: 'Authentication required.' };
  }
  const file = formData.get('contactFile') as File;
  const projectId = formData.get('projectId') as string;
  const phoneNumberId = formData.get('phoneNumberId') as string;

  if (!file) {
    return { error: 'No file uploaded.' };
  }
  
  if (!projectId || !phoneNumberId) {
    return { error: 'Project and Phone Number ID are required.' };
  }

  try {
    const { db } = await connectToDatabase();
    const project = await db.collection('projects').findOne({ _id: new ObjectId(projectId) });
    if (!project || project.userId.toString() !== session.user._id) {
        return { error: "Permission denied." };
    }

    const fileContent = await file.text();
    const parsed = Papa.parse(fileContent, { header: true });
    const contactsToImport = parsed.data as { phone: string; name: string; [key: string]: string }[];
    
    let importedCount = 0;
    let skippedCount = 0;

    const bulkOps = contactsToImport.map(contactRow => {
        if (!contactRow.phone || !contactRow.name) {
            skippedCount++;
            return null;
        }
        const waId = contactRow.phone.replace(/\D/g, '');
        const { phone, name, ...variables } = contactRow;

        return {
            updateOne: {
                filter: { waId, projectId: new ObjectId(projectId) },
                update: {
                    $setOnInsert: {
                        projectId: new ObjectId(projectId),
                        phoneNumberId,
                        name,
                        waId,
                        userId: new ObjectId(session.user._id),
                        status: 'imported',
                        createdAt: new Date(),
                    },
                    $set: {
                        variables,
                        updatedAt: new Date()
                    }
                },
                upsert: true
            }
        };
    }).filter(Boolean);


    if (bulkOps.length > 0) {
      const result = await db.collection('contacts').bulkWrite(bulkOps as any[]);
      importedCount = result.upsertedCount + result.modifiedCount;
    }
    
    revalidatePath('/dashboard/contacts');

    return { message: `Import complete. ${importedCount} contacts imported/updated. ${skippedCount} rows skipped.` };

  } catch (error) {
    return { error: getErrorMessage(error) };
  }
}


export async function getContactsPageData(
    projectId: string, 
    page: number = 1, 
    searchQuery: string = '', 
    tagIds?: string[]
): Promise<{ contacts: WithId<Contact>[]; total: number }> {
    const session = await getSession();
    if (!session?.user) return { contacts: [], total: 0 };
    
    try {
        const { db } = await connectToDatabase();
        const projectObjectId = new ObjectId(projectId);
        
        const filter: Filter<Contact> = { projectId: projectObjectId };

        if (searchQuery) {
            const queryRegex = { $regex: searchQuery, $options: 'i' };
            filter.$or = [
                { name: queryRegex },
                { waId: queryRegex }
            ];
        }

        if (tagIds && tagIds.length > 0) {
            filter.tagIds = { $in: tagIds.map(id => new ObjectId(id)) };
        }

        const limit = CONTACTS_PER_PAGE;
        const skip = (page - 1) * limit;

        const [contacts, total] = await Promise.all([
            db.collection<WithId<Contact>>('contacts')
                .find(filter)
                .sort({ lastMessageTimestamp: -1, updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            db.collection('contacts').countDocuments(filter)
        ]);

        return {
            contacts: JSON.parse(JSON.stringify(contacts)),
            total
        };

    } catch (e: any) {
        return { contacts: [], total: 0 };
    }
}

export async function handleUpdateContactDetails(prevState: any, formData: FormData): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }
    const contactId = formData.get('contactId') as string;
    const variablesJSON = formData.get('variables') as string;
    
    if (!contactId || !ObjectId.isValid(contactId)) {
        return { success: false, error: 'Invalid contact ID.' };
    }

    try {
        const variables = JSON.parse(variablesJSON);
        const { db } = await connectToDatabase();

        await db.collection('contacts').updateOne(
            { _id: new ObjectId(contactId) },
            { $set: { variables: variables, updatedAt: new Date() } }
        );
        
        revalidatePath('/dashboard/chat');
        return { success: true };
    } catch(e) {
        return { success: false, error: 'Failed to update contact variables.' };
    }
}

export async function handleUpdateContactStatus(contactId: string, status: string, assignedAgentId?: string) {
     const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }
    
    if (!contactId || !ObjectId.isValid(contactId) || !status) {
        return { success: false, error: 'Invalid data provided.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        
        const updateDoc: any = { status };
        if(assignedAgentId) {
            updateDoc.assignedAgentId = new ObjectId(assignedAgentId);
        } else {
            updateDoc.assignedAgentId = null;
        }

        await db.collection('contacts').updateOne(
            { _id: new ObjectId(contactId) },
            { $set: updateDoc }
        );
        revalidatePath('/dashboard/chat');
        revalidatePath('/dashboard/chat/kanban');
        return { success: true };
    } catch (e) {
         return { success: false, error: getErrorMessage(e) };
    }
}

export async function updateContactTags(contactId: string, tagIds: string[]) {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }

     if (!contactId || !ObjectId.isValid(contactId)) {
        return { success: false, error: 'Invalid data provided.' };
    }

    try {
        const { db } = await connectToDatabase();
        await db.collection('contacts').updateOne(
            { _id: new ObjectId(contactId) },
            { $set: { tagIds: tagIds.map(id => new ObjectId(id)) } }
        );
         revalidatePath('/dashboard/chat');
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function deleteContact(contactId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };

    if (!contactId || !ObjectId.isValid(contactId)) return { success: false, error: 'Invalid contact ID.' };

    try {
        const { db } = await connectToDatabase();
        
        const result = await db.collection('contacts').deleteOne({
            _id: new ObjectId(contactId),
            userId: new ObjectId(session.user._id)
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Contact not found or you do not have permission to delete it.' };
        }

        revalidatePath('/dashboard/contacts');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
