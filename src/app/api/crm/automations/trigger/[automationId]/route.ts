import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getCrmAutomationById } from '@/app/actions/crm-automations.actions';
import { addCrmContact } from '@/app/actions/crm.actions';
import type { CrmContact, CrmAutomation } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';


export async function POST(
    request: NextRequest,
    { params }: { params: { automationId: string } }
) {
    const { automationId } = params;
    if (!ObjectId.isValid(automationId)) {
        return NextResponse.json({ error: 'Invalid Automation ID format.' }, { status: 400 });
    }

    let requestBody;
    try {
        requestBody = await request.json();
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { email, ...otherData } = requestBody;

    if (!email) {
        return NextResponse.json({ error: 'Email is a required field.' }, { status: 400 });
    }

    try {
        const { db } = await connectToDatabase();
        const automation = await db.collection<CrmAutomation>('crm_automations').findOne({ _id: new ObjectId(automationId) });
        
        if (!automation) {
            return NextResponse.json({ error: 'Automation not found.' }, { status: 404 });
        }

        const triggerNode = automation.nodes.find(node => node.type === 'triggerTagAdded');
        if (!triggerNode) {
            return NextResponse.json({ error: 'This automation cannot be triggered via API.' }, { status: 400 });
        }
        
        const triggerTag = triggerNode.data.tagName;
        if (!triggerTag) {
            return NextResponse.json({ error: 'Automation trigger is not configured with a tag name.' }, { status: 400 });
        }

        const user = await db.collection('users').findOne({ _id: automation.userId });
        if (!user) {
            return NextResponse.json({ error: 'Automation owner not found.' }, { status: 500 });
        }

        let contact = await db.collection<CrmContact>('crm_contacts').findOne({ email, userId: user._id });

        if (!contact) {
            const newContact: Partial<CrmContact> = {
                userId: user._id,
                email,
                name: otherData.name || email,
                phone: otherData.phone,
                company: otherData.company,
                status: 'new_lead',
                tags: [triggerTag],
                createdAt: new Date(),
            };
            const result = await db.collection('crm_contacts').insertOne(newContact as CrmContact);
            contact = { ...newContact, _id: result.insertedId } as WithId<CrmContact>;
        } else {
            await db.collection('crm_contacts').updateOne(
                { _id: contact._id },
                { $addToSet: { tags: triggerTag } }
            );
        }

        // The automation engine itself is assumed to run on tag changes.
        // This endpoint's responsibility is just to add the tag to the right contact.
        // A separate process would monitor the 'crm_contacts' collection for changes.

        return NextResponse.json({ success: true, message: `Automation triggered for ${contact.email}.`, contactId: contact._id.toString() });

    } catch (e) {
        console.error("CRM Webhook Trigger Error:", e);
        return NextResponse.json({ error: getErrorMessage(e) }, { status: 500 });
    }
}
