
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { CrmForm, CrmContact, CrmDeal, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { getCrmFormById } from '@/app/actions/crm-forms.actions';
import { addCrmLeadAndDeal } from '@/app/actions/crm-deals.actions';
import { revalidatePath } from 'next/cache';


export async function POST(
    request: NextRequest,
    { params }: { params: { formId: string } }
) {
    const { formId } = params;
    
    let formData;
    try {
        formData = await request.json();
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    if (!ObjectId.isValid(formId)) {
        return NextResponse.json({ error: 'Invalid Form ID.' }, { status: 400 });
    }

    try {
        const { db } = await connectToDatabase();
        
        const form = await getCrmFormById(formId);
        if (!form) {
            return NextResponse.json({ error: 'Form not found.' }, { status: 404 });
        }
        
        // Log the submission
        await db.collection('crm_form_submissions').insertOne({
            formId: form._id,
            userId: form.userId,
            data: formData,
            submittedAt: new Date(),
        });
        
        const user = await db.collection<User>('users').findOne({ _id: form.userId });
        if (!user) {
            return NextResponse.json({ error: 'Form owner not found.' }, { status: 500 });
        }
        
        // --- Map form data to lead and deal fields ---
        const emailFieldId = form.fields.find(f => f.type === 'email')?.fieldId || 'email';
        const nameFieldId = form.fields.find(f => f.label.toLowerCase().includes('name'))?.fieldId || 'name';
        const phoneFieldId = form.fields.find(f => f.type === 'tel')?.fieldId || 'phone';
        const companyFieldId = form.fields.find(f => f.label.toLowerCase().includes('company'))?.fieldId || 'company';
        const messageFieldId = form.fields.find(f => f.type === 'textarea')?.fieldId || 'message';

        const leadAndDealData = new FormData();
        leadAndDealData.append('email', formData[emailFieldId] || '');
        leadAndDealData.append('contactName', formData[nameFieldId] || formData[emailFieldId]);
        leadAndDealData.append('phone', formData[phoneFieldId] || '');
        leadAndDealData.append('organisation', formData[companyFieldId] || '');
        
        // Use the form name or a default as the deal name
        leadAndDealData.append('name', `Lead from ${form.name}`); 
        leadAndDealData.append('description', formData[messageFieldId] || 'Form Submission');
        leadAndDealData.append('leadSource', `Form: ${form.name}`);
        
        // Use default pipeline and stage from the user's CRM settings
        const defaultPipeline = (user.crmPipelines || [])[0];
        if (defaultPipeline) {
            leadAndDealData.append('pipelineId', defaultPipeline.id);
            const defaultStage = defaultPipeline.stages[0];
            if (defaultStage) {
                leadAndDealData.append('stage', defaultStage.name);
            }
        }
        
        // Find or create account based on company name
        const companyName = formData[companyFieldId];
        if (companyName) {
            let account = await db.collection('crm_accounts').findOne({ name: companyName, userId: form.userId });
            if (!account) {
                const newAccount = { userId: form.userId, name: companyName, createdAt: new Date(), status: 'active' };
                const result = await db.collection('crm_accounts').insertOne(newAccount as any);
                leadAndDealData.append('accountId', result.insertedId.toString());
            } else {
                 leadAndDealData.append('accountId', account._id.toString());
            }
        }

        // --- Call the server action to create the lead and deal ---
        // We have to mock the session for the server action since this is an API route
        const result = await addCrmLeadAndDeal(null, leadAndDealData);

        if (result.error) {
            console.error("Error creating lead from form submission:", result.error);
            // Don't fail the user submission, just log the error server-side
        }

        // Increment submission count
        await db.collection('crm_forms').updateOne({ _id: form._id }, { $inc: { submissionCount: 1 } });
        
        // Revalidate paths to show the new lead
        revalidatePath('/dashboard/crm/sales-crm/all-leads');
        revalidatePath('/dashboard/crm/deals');

        return NextResponse.json({ success: true, message: form.settings.successMessage || 'Submission successful.' });

    } catch (e: any) {
        console.error("CRM Form Submission Error:", e);
        return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
    }
}
