
'use server';

import { revalidatePath } from 'next/cache';
import { type Db, ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import type { SabChatSettings, SabChatSession, SabChatMessage } from '@/lib/definitions';
import { getErrorMessage } from '@/lib/utils';
import { headers } from 'next/headers';

export async function saveSabChatSettings(prevState: any, formData: FormData): Promise<{ message?: string; error?: string }> {
    const session = await getSession();
    if (!session?.user) return { error: "Access denied" };
    
    const settingsString = formData.get('settings') as string;
    if (!settingsString) return { error: 'No settings provided.' };

    try {
        const settings: SabChatSettings = JSON.parse(settingsString);

        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { sabChatSettings: settings } }
        );
        
        revalidatePath('/dashboard/sabchat/widget');
        return { message: 'sabChat settings saved successfully.' };
    } catch(e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function getOrCreateChatSession(userId: string, email: string, visitorId?: string | null): Promise<{ sessionId: string, isNew: boolean, error?: string }> {
    if (!ObjectId.isValid(userId)) return { sessionId: '', isNew: false, error: 'Invalid user ID' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(userId);

        if (visitorId) {
            const existingSession = await db.collection<SabChatSession>('sabchat_sessions').findOne({ userId: userObjectId, visitorId });
            if (existingSession) {
                return { sessionId: existingSession._id.toString(), isNew: false };
            }
        }
        
        const newVisitorId = visitorId || `visitor_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        const result = await db.collection('sabchat_sessions').insertOne({
            userId: userObjectId,
            visitorId: newVisitorId,
            status: 'open',
            createdAt: new Date(),
            updatedAt: new Date(),
            history: [],
            visitorInfo: {
                email,
                ip: headers().get('x-forwarded-for') ?? 'N/A',
                userAgent: headers().get('user-agent') ?? 'N/A',
            }
        });
        
        revalidatePath(`/dashboard/sabchat/inbox`);
        return { sessionId: result.insertedId.toString(), isNew: true };
    } catch (e) {
        return { sessionId: '', isNew: false, error: getErrorMessage(e) };
    }
}

export async function getChatHistory(sessionId: string, userId: string): Promise<SabChatMessage[]> {
    if (!ObjectId.isValid(sessionId) || !ObjectId.isValid(userId)) return [];
    
    try {
        const { db } = await connectToDatabase();
        const session = await db.collection<SabChatSession>('sabchat_sessions').findOne({ _id: new ObjectId(sessionId), userId: new ObjectId(userId) });
        return session?.history || [];
    } catch (e) {
        console.error("Failed to get chat history:", getErrorMessage(e));
        return [];
    }
}

export async function postChatMessage(sessionId: string, sender: 'visitor' | 'agent', content: string): Promise<{ success: boolean, error?: string }> {
    if (!ObjectId.isValid(sessionId)) return { success: false, error: 'Invalid session ID' };
    
    const session = await getSession();
    if (sender === 'agent' && !session?.user) {
        return { success: false, error: 'Agent not authenticated' };
    }

    try {
        const { db } = await connectToDatabase();
        const newMesage: SabChatMessage = {
            _id: new ObjectId(),
            sender,
            type: 'text',
            content,
            timestamp: new Date(),
            ...(sender === 'agent' && { agentId: session?.user?._id }),
        };

        const result = await db.collection('sabchat_sessions').updateOne(
            { _id: new ObjectId(sessionId) },
            { 
                $push: { history: newMesage },
                $set: { updatedAt: new Date() }
            }
        );

        if (result.matchedCount === 0) {
            return { success: false, error: 'Session not found' };
        }
        revalidatePath('/dashboard/sabchat/inbox');
        return { success: true };
    } catch (e) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getChatSessionsForUser(): Promise<WithId<SabChatSession>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const sessions = await db.collection<SabChatSession>('sabchat_sessions')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ updatedAt: -1 })
            .project({ history: 0 }) // Exclude history for list view performance
            .toArray();
        return JSON.parse(JSON.stringify(sessions));
    } catch (e) {
        console.error("Failed to get chat sessions:", getErrorMessage(e));
        return [];
    }
}

export async function getFullChatSession(sessionId: string): Promise<WithId<SabChatSession> | null> {
    const session = await getSession();
    if (!session?.user || !ObjectId.isValid(sessionId)) return null;

    try {
        const { db } = await connectToDatabase();
        const chatSession = await db.collection<SabChatSession>('sabchat_sessions').findOne({
            _id: new ObjectId(sessionId),
            userId: new ObjectId(session.user._id),
        });
        return chatSession ? JSON.parse(JSON.stringify(chatSession)) : null;
    } catch(e) {
        return null;
    }
}
