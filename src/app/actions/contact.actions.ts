

'use server';

import { revalidatePath } from 'next/cache';
import Papa from 'papaparse';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import { getProjectById } from '@/app/actions/user.actions';
import { findOrCreateContact } from '@/app/actions/whatsapp.actions';
import type { Contact, Project, User, Tag } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { z } from 'zod';


export async function getContactsPageData(
  projectId: string,
  page: number = 1,
  limit: number = 20,
  query?: string,
  tagIds?: string[]
): Promise<{
  contacts: WithId<Contact>[];
  total: number;
}> {
  try {
    const { db } = await connectToDatabase();
    const projectObjectId = new ObjectId(projectId);
    const skip = (page - 1) * limit;

    const filter: Filter<Contact> = { projectId: projectObjectId };

    if (query) {
      const queryRegex = { $regex: query, $options: 'i' };
      filter.$or = [
        { name: queryRegex },
        { waId: queryRegex },
      ];
    }

    if (tagIds && tagIds.length > 0) {
        filter.tagIds = { $in: tagIds };
    }

    const [contacts, total] = await Promise.all([
      db
        .collection<Contact>('contacts')
        .find(filter)
        .sort({ lastMessageTimestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection('contacts').countDocuments(filter),
    ]);

    return {
      contacts: JSON.parse(JSON.stringify(contacts)),
      total,
    };
  } catch (error) {
    console.error('Failed to fetch contacts page data:', error);
    return { contacts: [], total: 0 };
  }
}

export async function handleAddNewContact(
  prevState: any,
  formData: FormData,
  userFromApiKey?: WithId<User>
): Promise<{ message?: string; error?: string; contactId?: string }> {
  let session;
  if (!userFromApiKey) {
    session = await getSession();
    if (!session?.user) {
      return { error: 'Authentication required.' };
    }
  }
  const userId = userFromApiKey?._id.toString() || session?.user._id;

  const validatedFields = z
    .object({
      projectId: z.string().refine((val) => ObjectId.isValid(val)),
      phoneNumberId: z.string(),
      name: z.string().min(1, 'Name is required.'),
      waId: z.string().min(1, 'WhatsApp ID is required.'),
    })
    .safeParse(Object.fromEntries(formData.entries()));

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors[0] || 'Invalid data provided.',
    };
  }
  
  const { projectId, phoneNumberId, name, waId } = validatedFields.data;

  try {
    const { contact, error } = await findOrCreateContact(
      projectId,
      phoneNumberId,
      waId,
      name
    );

    if (error) {
      return { error };
    }

    revalidatePath('/dashboard/contacts');
    return { message: `Contact "${name}" added successfully.`, contactId: contact?._id.toString() };
  } catch (e: any) {
    return { error: getErrorMessage(e) };
  }
}

export async function handleImportContacts(
  prevState: any,
  formData: FormData
): Promise<{ message?: string; error?: string }> {
  const session = await getSession();
  if (!session?.user) {
    return { error: 'Authentication required.' };
  }

  const file = formData.get('contactFile') as File;
  const projectId = formData.get('projectId') as string;
  const phoneNumberId = formData.get('phoneNumberId') as string;

  if (!file || file.size === 0) {
    return { error: 'Please upload a valid file.' };
  }
  if (!projectId || !phoneNumberId) {
      return { error: 'Project and Phone Number must be selected.' };
  }

  try {
    const fileContent = await file.text();
    const parsed = Papa.parse(fileContent, { header: true });
    
    if (parsed.errors.length) {
        return { error: `CSV parsing error: ${parsed.errors[0].message}` };
    }

    const contactsToUpsert = parsed.data as { phone: string, name: string }[];

    const { db } = await connectToDatabase();
    const bulkOps = contactsToUpsert.map(({ phone, name }) => {
        const waId = phone.replace(/\D/g, ''); // Basic sanitization
        if (!waId || !name) return null;
        
        return {
            updateOne: {
                filter: { waId, projectId: new ObjectId(projectId) },
                update: {
                    $set: {
                        name,
                        waId,
                        phoneNumberId,
                        projectId: new ObjectId(projectId),
                        userId: new ObjectId(session!.user._id),
                        status: 'imported',
                        updatedAt: new Date(),
                    },
                    $setOnInsert: {
                        createdAt: new Date(),
                    }
                },
                upsert: true
            }
        };
    }).filter(Boolean);
    
    if (bulkOps.length > 0) {
        await db.collection('contacts').bulkWrite(bulkOps as any);
    }
    
    revalidatePath('/dashboard/contacts');
    return { message: `Successfully imported ${bulkOps.length} contacts.` };

  } catch (e: any) {
    return { error: getErrorMessage(e) };
  }
}

export async function updateContactTags(contactId: string, tagIds: string[]): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('contacts').updateOne(
            { _id: new ObjectId(contactId), userId: new ObjectId(session.user._id) },
            { $set: { tagIds } }
        );
        revalidatePath('/dashboard/chat');
        return { success: true };
    } catch(e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteContact(contactId: string): Promise<{ success: boolean; error?: string }> {
    const session = await getSession();
    if (!session?.user) {
        return { success: false, error: 'Authentication required.' };
    }
    
    if (!contactId || !ObjectId.isValid(contactId)) {
        return { success: false, error: 'Invalid Contact ID provided.' };
    }

    try {
        const { db } = await connectToDatabase();
        
        const contactToDelete = await db.collection('contacts').findOne({
            _id: new ObjectId(contactId),
        });

        if (!contactToDelete) {
             return { success: false, error: 'Contact not found.' };
        }
        
        // This is a simplified permission check. In a real app with agents,
        // you would check if the user is an owner or an agent of the project.
        const project = await getProjectById(contactToDelete.projectId.toString(), session.user._id);
        if (!project) {
             return { success: false, error: 'You do not have permission to delete this contact.' };
        }

        await db.collection('contacts').deleteOne({ _id: new ObjectId(contactId) });
        
        revalidatePath('/dashboard/contacts');

        return { success: true };

    } catch (e: any) {
        console.error('Failed to delete contact:', e);
        return { success: false, error: e.message || 'An unexpected error occurred while deleting the contact.' };
    }
}