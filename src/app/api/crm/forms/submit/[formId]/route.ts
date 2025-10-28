
'use server';

import { NextRequest, NextResponse } from 'next/server';
import { ObjectId, WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { CrmForm, CrmContact, CrmDeal, User } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { getCrmFormById } from '@/app/actions/crm-forms.actions';
import { addCrmLeadAndDeal } from '@/app/actions/crm-deals.actions';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function getMockSession(userId: ObjectId) {
    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ _id: userId }, { projection: { password: 0 } });
        if (!user) return null;
        
        const plan = user.planId ? await db.collection('plans').findOne({ _id: user.planId }) : await db.collection('plans').findOne({ isDefault: true });

        return { user: { ...user, plan } };
    } catch (e) {
        console.error("Failed to generate mock session:", e);
        return null;
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: { formId: string } }
) {
    const { formId } = params;
    
    let formData;
    try {
        formData = await request.json();
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400, headers: corsHeaders });
    }

    if (!ObjectId.isValid(formId)) {
        return NextResponse.json({ error: 'Invalid Form ID.' }, { status: 400, headers: corsHeaders });
    }

    try {
        const { db } = await connectToDatabase();
        
        const form = await getCrmFormById(formId);
        if (!form) {
            return NextResponse.json({ error: 'Form not found.' }, { status: 404, headers: corsHeaders });
        }
        
        await db.collection('crm_form_submissions').insertOne({
            formId: form._id,
            userId: form.userId,
            data: formData,
            submittedAt: new Date(),
        });
        
        const user = await db.collection<User>('users').findOne({ _id: new ObjectId(form.userId) });
        if (!user) {
            return NextResponse.json({ error: 'Form owner not found.' }, { status: 500, headers: corsHeaders });
        }
        
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
        
        leadAndDealData.append('name', `Lead from ${form.name}`); 
        leadAndDealData.append('description', formData[messageFieldId] || 'Form Submission');
        leadAndDealData.append('leadSource', `Form: ${form.name}`);
        
        const defaultPipeline = (user.crmPipelines || [])[0];
        if (defaultPipeline) {
            leadAndDealData.append('pipelineId', defaultPipeline.id);
            const defaultStage = defaultPipeline.stages[0];
            if (defaultStage) {
                leadAndDealData.append('stage', defaultStage.name);
            }
        }
        
        const companyName = formData[companyFieldId];
        let accountId;
        if (companyName) {
            let account = await db.collection('crm_accounts').findOne({ name: companyName, userId: form.userId });
            if (!account) {
                const newAccount = { userId: form.userId, name: companyName, createdAt: new Date(), status: 'active' };
                const result = await db.collection('crm_accounts').insertOne(newAccount as any);
                accountId = result.insertedId.toString();
            } else {
                 accountId = account._id.toString();
            }
        }

        if (accountId) {
            leadAndDealData.append('accountId', accountId);
        }

        // Temporarily modify the server action to accept the mocked session
        const originalGetSession = require('@/app/actions').getSession;
        (require('@/app/actions') as any).getSession = () => getMockSession(new ObjectId(form.userId));

        const result = await addCrmLeadAndDeal(null, leadAndDealData);

        // Restore original function
        (require('@/app/actions') as any).getSession = originalGetSession;

        if (result.error) {
            console.error("Error creating lead from form submission:", result.error);
            // Optionally, you could decide not to throw here and still count submission as success
        }

        await db.collection('crm_forms').updateOne({ _id: form._id }, { $inc: { submissionCount: 1 } });
        
        revalidatePath('/dashboard/crm/sales-crm/all-leads');
        revalidatePath('/dashboard/crm/deals');

        return NextResponse.json({ success: true, message: form.settings.successMessage || 'Submission successful.' }, { headers: corsHeaders });

    } catch (e: any) {
        console.error("CRM Form Submission Error:", e);
        return NextResponse.json({ error: getErrorMessage(e) }, { status: 500, headers: corsHeaders });
    }
}

// Handle preflight requests for CORS
export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders
    });
}
