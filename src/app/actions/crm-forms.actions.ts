
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId, Filter } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { CrmForm, CrmContact, CrmDeal, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { addCrmLeadAndDeal } from './crm-deals.actions';

export async function getCrmForms(
    page: number = 1,
    limit: number = 20,
    query?: string
): Promise<{ forms: WithId<CrmForm>[], total: number }> {
    const session = await getSession();
    if (!session?.user) return { forms: [], total: 0 };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(session.user._id);
        
        const filter: Filter<CrmForm> = { userId: userObjectId };
        if (query) {
            filter.name = { $regex: query, $options: 'i' };
        }

        const skip = (page - 1) * limit;

        const [forms, total] = await Promise.all([
            db.collection<CrmForm>('crm_forms').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
            db.collection('crm_forms').countDocuments(filter)
        ]);

        return {
            forms: JSON.parse(JSON.stringify(forms)),
            total
        };
    } catch (e: any) {
        console.error("Failed to fetch CRM forms:", e);
        return { forms: [], total: 0 };
    }
}


export async function saveCrmForm(data: {
    formId?: string;
    name: string;
    settings: any;
}): Promise<{ message?: string; error?: string; formId?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: 'Access denied' };
    
    if (!data.name) return { error: 'Form Name is required.' };
    
    const isNew = !data.formId || data.formId.startsWith('temp_');
    
    const formData: Omit<CrmForm, '_id' | 'createdAt'> = {
        name: data.name,
        userId: new ObjectId(session.user._id),
        fields: data.settings.fields || [],
        settings: data.settings,
        submissionCount: 0,
        updatedAt: new Date(),
    };

    try {
        const { db } = await connectToDatabase();
        if (isNew) {
            const result = await db.collection('crm_forms').insertOne({ ...formData, createdAt: new Date() } as any);
            revalidatePath('/dashboard/crm/sales-crm/forms');
            return { message: 'Form created successfully.', formId: result.insertedId.toString() };
        } else {
            await db.collection('crm_forms').updateOne(
                { _id: new ObjectId(data.formId), userId: new ObjectId(session.user._id) },
                { $set: formData }
            );
            revalidatePath('/dashboard/crm/sales-crm/forms');
            return { message: 'Form updated successfully.', formId: data.formId };
        }
    } catch (e: any) {
        return { error: 'Failed to save form.' };
    }
}

export async function getCrmFormById(formId: string): Promise<WithId<CrmForm> | null> {
    if (!ObjectId.isValid(formId)) return null;

    try {
        const { db } = await connectToDatabase();
        const form = await db.collection<CrmForm>('crm_forms').findOne({ _id: new ObjectId(formId) });
        // Publicly accessible for embedding, no session check needed here.
        return form ? JSON.parse(JSON.stringify(form)) : null;
    } catch (e) {
        return null;
    }
}


export async function handleFormSubmission(formId: string, formData: Record<string, any>): Promise<{ success: boolean; message: string; error?: string }> {
    if (!ObjectId.isValid(formId)) {
        return { success: false, error: 'Invalid Form ID.', message: '' };
    }
    
    try {
        const { db } = await connectToDatabase();
        
        const form = await db.collection<WithId<CrmForm>>('crm_forms').findOne({ _id: new ObjectId(formId) });
        if (!form) {
            return { success: false, error: 'Form not found.', message: '' };
        }
        
        const user = await db.collection<WithId<User>>('users').findOne({ _id: form.userId });
        if (!user) {
            return { success: false, error: 'Form owner not found.', message: '' };
        }

        // Log the submission
        await db.collection('crm_form_submissions').insertOne({
            formId: form._id,
            userId: form.userId,
            data: formData,
            submittedAt: new Date(),
        });
        
        // --- Map form data to lead data ---
        const emailFieldId = form.fields.find(f => f.type === 'email')?.fieldId || 'email';
        const nameFieldId = form.fields.find(f => f.label.toLowerCase().includes('name'))?.fieldId || 'name';
        const phoneFieldId = form.fields.find(f => f.type === 'tel')?.fieldId || 'phone';
        const companyFieldId = form.fields.find(f => f.label.toLowerCase().includes('company'))?.fieldId || 'company';
        const messageFieldId = form.fields.find(f => f.type === 'textarea')?.fieldId || 'message';

        const leadData = {
            email: formData[emailFieldId] || '',
            contactName: formData[nameFieldId] || formData[emailFieldId],
            phone: formData[phoneFieldId] || '',
            organisation: formData[companyFieldId] || '',
            designation: '', // Not typically in a simple form
            
            name: `Lead from ${form.name}`,
            description: formData[messageFieldId] || 'Form Submission',
            leadSource: `Form: ${form.name}`,
        };

        const defaultPipeline = (user.crmPipelines || [])[0];
        if (defaultPipeline) {
            leadData.pipelineId = defaultPipeline.id;
            const defaultStage = defaultPipeline.stages[0];
            if (defaultStage) {
                leadData.stage = defaultStage.name;
            }
        }
        
        let accountId;
        if (leadData.organisation) {
            let account = await db.collection('crm_accounts').findOne({ name: leadData.organisation, userId: form.userId });
            if (!account) {
                const newAccount = { userId: form.userId, name: leadData.organisation, createdAt: new Date(), status: 'active' };
                const result = await db.collection('crm_accounts').insertOne(newAccount as any);
                accountId = result.insertedId.toString();
            } else {
                 accountId = account._id.toString();
            }
            leadData.accountId = accountId;
        }

        // We can't directly call a server action that uses `useActionState` internally.
        // We'll replicate the core logic of `addCrmLeadAndDeal` here.
        const contactEmail = leadData.email;
        if (!contactEmail) return { success: false, error: "Email is required.", message: '' };
        
        let contact: WithId<CrmContact>;
        const existingContact = await db.collection<CrmContact>('crm_contacts').findOne({ email: contactEmail, userId: user._id });

        if (existingContact) {
            contact = existingContact;
        } else {
            const newContactData: Partial<CrmContact> = {
                userId: user._id,
                name: leadData.contactName,
                email: contactEmail,
                phone: leadData.phone,
                company: leadData.organisation,
                status: 'new_lead',
                leadSource: leadData.leadSource,
                createdAt: new Date(),
            };
            const result = await db.collection('crm_contacts').insertOne(newContactData as CrmContact);
            contact = { ...newContactData, _id: result.insertedId } as WithId<CrmContact>;
        }

        const newDeal: Partial<CrmDeal> = {
            userId: user._id,
            name: leadData.name,
            stage: leadData.stage,
            description: leadData.description,
            accountId: accountId ? new ObjectId(accountId) : undefined,
            contactIds: [contact._id],
            createdAt: new Date(),
            value: 0,
            currency: 'INR',
            pipelineId: leadData.pipelineId,
        };

        await db.collection('crm_deals').insertOne(newDeal as any);

        await db.collection('crm_forms').updateOne({ _id: form._id }, { $inc: { submissionCount: 1 } });
        
        revalidatePath('/dashboard/crm/sales-crm/all-leads');
        revalidatePath('/dashboard/crm/deals');

        return { success: true, message: form.settings.successMessage || 'Submission successful.' };
    } catch (e) {
        console.error("CRM Form Submission Error:", e);
        return { success: false, error: getErrorMessage(e), message: '' };
    }
}
