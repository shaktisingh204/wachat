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
