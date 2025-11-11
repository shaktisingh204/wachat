

'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions/index.ts';
import type { CrmLead, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { z } from 'zod';

const leadSchema = z.object({
  title: z.string().min(1, 'Lead Title is required.'),
  contactName: z.string().min(1, 'Contact Name is required.'),
  email: z.string().email('Invalid email address.').optional().or(z.literal('')),
  phone: z.string().optional(),
  company: z.string().optional(),
  website: z.string().optional(),
  country: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  value: z.coerce.number().optional().default(0),
  currency: z.string().optional().default('INR'),
  assignedTo: z.string().optional(),
  pipelineId: z.string().optional(),
  stage: z.string().optional(),
  description: z.string().optional(),
  nextFollowUp: z.date().optional(),
});


export async function getCrmLeads(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ leads: WithId<CrmLead>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { leads: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
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
        console.error("Failed to fetch CRM leads:", e);
        return { leads: [], total: 0 };
    }
}


export async function addCrmLead(prevState: any, formData: FormData, apiUser?: WithId<User>): Promise<{ message?: string, error?: string, leadId?: string }> {
    const session = apiUser ? { user: apiUser } : await getSession();
    if (!session?.user) return { error: "Access denied" };

    const rawData = {
        title: formData.get('title'),
        contactName: formData.get('contactName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        company: formData.get('company'),
        website: formData.get('website'),
        country: formData.get('country'),
        status: formData.get('status'),
        source: formData.get('source'),
        value: formData.get('value'),
        currency: formData.get('currency'),
        stage: formData.get('stage'),
        description: formData.get('description'),
        nextFollowUp: formData.get('nextFollowUp') ? new Date(formData.get('nextFollowUp') as string) : undefined,
    };
    
    const validatedFields = leadSchema.safeParse(rawData);
    
    if (!validatedFields.success) {
        // Flatten the error object to make it easier to read
        const flattenedErrors = validatedFields.error.flatten().fieldErrors;
        const errorString = Object.entries(flattenedErrors)
            .map(([key, value]) => `${key}: ${value.join(', ')}`)
            .join('; ');
        return { error: `Invalid data provided. Errors: ${errorString}` };
    }
    
    try {
        const { db } = await connectToDatabase();
        const newLead: Omit<CrmLead, '_id'> = {
            userId: new ObjectId(session.user._id),
            createdAt: new Date(),
            updatedAt: new Date(),
            ...validatedFields.data,
            value: validatedFields.data.value || 0,
            currency: validatedFields.data.currency || 'INR',
        };

        const result = await db.collection('crm_leads').insertOne(newLead as CrmLead);
        
        revalidatePath('/dashboard/crm/sales-crm/all-leads');
        return { message: 'Lead added successfully.', leadId: result.insertedId.toString() };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}
