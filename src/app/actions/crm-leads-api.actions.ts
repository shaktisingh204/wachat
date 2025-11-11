
'use server';

import { revalidatePath } from 'next/cache';
import { ObjectId, Filter, WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { CrmLead } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { z } from 'zod';

const leadSchema = z.object({
  title: z.string().min(1, 'Lead Title is required.'),
  contactName: z.string().min(1, 'Contact Name is required.'),
  email: z.string().email('Invalid email address.').optional().or(z.literal('')),
  phone: z.string().optional().nullable(),
  company: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  value: z.coerce.number().optional().default(0),
  currency: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  pipelineId: z.string().optional().nullable(),
  stage: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  nextFollowUp: z.date().optional().nullable(),
});

export async function getLeadsForApi(
    userId: string,
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ leads: WithId<CrmLead>[], total: number, error?: string }> {
    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(userId);
        
        const filter: Filter<CrmLead> = { userId: userObjectId };
        if (query) {
            const queryRegex = { $regex: query, $options: 'i' };
            filter.$or = [
                { title: queryRegex },
                { contactName: queryRegex },
                { email: queryRegex },
                { company: queryRegex }
            ];
        }

        const skip = (page - 1) * limit;

        const [leads, total] = await Promise.all([
            db.collection<CrmLead>('crm_leads').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('crm_leads').countDocuments(filter)
        ]);
        
        return {
            leads: JSON.parse(JSON.stringify(leads)),
            total
        };
    } catch (e: any) {
        return { leads: [], total: 0, error: getErrorMessage(e) };
    }
}

export async function createLeadForApi(
    userId: string,
    data: any
): Promise<{ success: boolean; lead?: WithId<CrmLead>; error?: string }> {
    const validatedFields = leadSchema.safeParse(data);
    if (!validatedFields.success) {
        const flattenedErrors = validatedFields.error.flatten().fieldErrors;
        const errorString = Object.entries(flattenedErrors)
            .map(([key, value]) => `${key}: ${value.join(', ')}`)
            .join('; ');
        return { success: false, error: `Invalid data provided. Errors: ${errorString}` };
    }

    try {
        const { db } = await connectToDatabase();
        const newLead: Omit<CrmLead, '_id'> = {
            userId: new ObjectId(userId),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...validatedFields.data,
            value: validatedFields.data.value || 0,
            currency: validatedFields.data.currency || 'INR',
        };

        const result = await db.collection('crm_leads').insertOne(newLead as CrmLead);
        const createdLead = await db.collection<CrmLead>('crm_leads').findOne({ _id: result.insertedId });
        
        revalidatePath('/dashboard/crm/sales-crm/all-leads');
        return { success: true, lead: JSON.parse(JSON.stringify(createdLead)) };
    } catch(e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getLeadByIdForApi(
    leadId: string,
    userId: string
): Promise<{ lead?: WithId<CrmLead>; error?: string }> {
    if (!ObjectId.isValid(leadId)) return { error: 'Invalid Lead ID.' };
    
    try {
        const { db } = await connectToDatabase();
        const lead = await db.collection<CrmLead>('crm_leads').findOne({
            _id: new ObjectId(leadId),
            userId: new ObjectId(userId)
        });
        if (!lead) return { error: 'Lead not found or access denied.' };
        return { lead: JSON.parse(JSON.stringify(lead)) };
    } catch(e:any) {
        return { error: getErrorMessage(e) };
    }
}

export async function updateLeadForApi(
    leadId: string,
    userId: string,
    data: any
): Promise<{ success: boolean; lead?: WithId<CrmLead>; error?: string }> {
    if (!ObjectId.isValid(leadId)) return { success: false, error: 'Invalid Lead ID.' };
    
    // Use partial schema for updates
    const validatedFields = leadSchema.partial().safeParse(data);
    if (!validatedFields.success) {
        return { success: false, error: 'Invalid data provided.' };
    }

    try {
        const { db } = await connectToDatabase();
        const updateData = { ...validatedFields.data, updatedAt: new Date() };

        const result = await db.collection('crm_leads').findOneAndUpdate(
            { _id: new ObjectId(leadId), userId: new ObjectId(userId) },
            { $set: updateData },
            { returnDocument: 'after' }
        );

        if (!result) {
            return { success: false, error: 'Lead not found or access denied.' };
        }
        
        revalidatePath(`/dashboard/crm/sales-crm/all-leads`);
        return { success: true, lead: JSON.parse(JSON.stringify(result)) };
    } catch(e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function deleteLeadForApi(
    leadId: string,
    userId: string
): Promise<{ success: boolean; error?: string }> {
    if (!ObjectId.isValid(leadId)) return { success: false, error: 'Invalid Lead ID.' };

    try {
        const { db } = await connectToDatabase();
        const result = await db.collection('crm_leads').deleteOne({
            _id: new ObjectId(leadId),
            userId: new ObjectId(userId)
        });

        if (result.deletedCount === 0) {
            return { success: false, error: 'Lead not found or access denied.' };
        }

        revalidatePath('/dashboard/crm/sales-crm/all-leads');
        return { success: true };
    } catch(e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}
