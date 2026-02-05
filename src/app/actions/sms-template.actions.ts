'use server';

import { connectToDatabase } from "@/lib/mongodb";
import { DltSmsTemplate } from "@/lib/sms/types";
import { ObjectId } from "mongodb";
import { getDecodedSession } from "@/lib/auth";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function createDltTemplate(formData: FormData) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = await getDecodedSession(sessionToken || '');

    if (!session?.userId) throw new Error("Unauthorized");
    const userId = new ObjectId(session.userId);

    const name = formData.get('name') as string;
    const dltTemplateId = formData.get('dltTemplateId') as string;
    const headerId = formData.get('headerId') as string; // 6 chars
    const content = formData.get('content') as string;
    const type = formData.get('type') as 'Transactional' | 'Promotional' | 'Service';

    // Validate variable count
    const matches = content.match(/{#var#}/g);
    const variableCount = matches ? matches.length : 0;

    const { db } = await connectToDatabase();

    const template: DltSmsTemplate = {
        _id: new ObjectId(),
        userId,
        name,
        dltTemplateId,
        headerId,
        content,
        variableCount,
        type,
        status: 'APPROVED', // Assume approved if they are adding an existing DLT ID
        createdAt: new Date(),
        updatedAt: new Date()
    };

    await db.collection('dlt_templates').insertOne(template);

    revalidatePath('/dashboard/sms/templates');
    return { success: true, message: 'Template added successfully' };
}

export async function getDltTemplates() {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    if (!sessionToken) return [];

    const session = await getDecodedSession(sessionToken);
    if (!session?.userId) return [];

    const { db } = await connectToDatabase();
    const templates = await db.collection<DltSmsTemplate>('dlt_templates')
        .find({ userId: new ObjectId(session.userId) })
        .sort({ createdAt: -1 })
        .toArray();

    return templates.map(t => ({
        ...t,
        _id: t._id.toString(),
        userId: t.userId.toString()
    }));
}

export async function deleteDltTemplate(id: string) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = await getDecodedSession(sessionToken || '');
    if (!session?.userId) throw new Error("Unauthorized");

    const { db } = await connectToDatabase();
    await db.collection('dlt_templates').deleteOne({
        _id: new ObjectId(id),
        userId: new ObjectId(session.userId)
    });

    revalidatePath('/dashboard/sms/templates');
}

import { sendTemplateSms } from '@/lib/sms/services/messaging.service';

export async function sendSmsTemplate(prevState: any, formData: FormData) {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    const session = await getDecodedSession(sessionToken || '');
    if (!session?.userId) return { error: "Unauthorized" };

    const recipient = formData.get('recipient') as string;
    const dltTemplateId = formData.get('dltTemplateId') as string;
    // Extract variables. Usually they come as dynamic fields. 
    // We'll look for fields starting with 'var_' or just assume all other fields are vars? 
    // Given the previous usage in route was appending form entries, let's look for specific pattern or collect all unknown keys.
    // OR, we can expect a JSON string for variables if the UI sends it that way.
    // For now, let's implement a simple collection of "variable_0", "variable_1" etc. which is common.

    // Fallback: If the simple previous logic passed everything, we'll try to extract known fields and treat rest as variables.
    // But since this is a new implementation, we can dictate the contract.
    // We'll collect all FormData entries that look like variables. e.g. keys created by the UI form.

    const allKeys = Array.from(formData.keys());
    const variableValues: string[] = [];

    // Sort keys to maintain order? 
    // If the UI sends 'variable_0', 'variable_1' etc.
    const varKeys = allKeys.filter(k => k.startsWith('variable_')).sort();
    varKeys.forEach(k => {
        variableValues.push(formData.get(k) as string);
    });

    // If no explicit variable_ keys but 'variables' is passed (API style mapped to form)
    if (varKeys.length === 0) {
        // Just empty?
    }

    try {
        const result = await sendTemplateSms({
            userId: session.userId,
            recipient,
            dltTemplateId,
            headerId: formData.get('headerId') as string,
            variableValues
        });

        return { message: result.message };
    } catch (e: any) {
        return { error: e.message || "Failed to send SMS" };
    }
}
