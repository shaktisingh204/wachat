
import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { CrmForm, CrmContact } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { getCrmFormById } from '@/app/actions/crm-forms.actions';

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
        
        // Find or create a contact based on email
        const emailFieldId = form.fields.find(f => f.type === 'email')?.fieldId || 'email';
        const email = formData[emailFieldId];
        
        if (email) {
            const nameFieldId = form.fields.find(f => f.label.toLowerCase().includes('name'))?.fieldId || 'name';
            const name = formData[nameFieldId] || email;
            
            const contactUpdate = {
                $set: {
                    name,
                    ...formData, // Add all form data to the contact
                },
                $setOnInsert: {
                    userId: form.userId,
                    email,
                    createdAt: new Date(),
                    status: 'new_lead',
                }
            };
            
            await db.collection<CrmContact>('crm_contacts').updateOne(
                { userId: form.userId, email: email },
                contactUpdate,
                { upsert: true }
            );
        }

        // Increment submission count
        await db.collection('crm_forms').updateOne({ _id: form._id }, { $inc: { submissionCount: 1 } });
        
        // Handle webhook action if configured
        if(form.settings.webhookUrl) {
            try {
                await fetch(form.settings.webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
            } catch (webhookError) {
                console.error("Failed to send form webhook:", webhookError);
                // Log this error but don't fail the entire submission
            }
        }

        return NextResponse.json({ success: true, message: form.settings.successMessage || 'Submission successful.' });

    } catch (e: any) {
        console.error("CRM Form Submission Error:", e);
        return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
    }
}
