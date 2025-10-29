
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


export async function getOrCreateChatSession(userId: string, email: string, visitorId?: string | null): Promise<{ sessionId: string, isNew: boolean, error?: string, session?: WithId<SabChatSession> }> {
    if (!ObjectId.isValid(userId)) return { sessionId: '', isNew: false, error: 'Invalid user ID' };

    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(userId);
        const headersList = headers();
        const ipAddress = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? 'N/A';
        const userAgent = headersList.get('user-agent') ?? 'N/A';
        const page = headersList.get('referer') ?? 'N/A';


        if (visitorId) {
            const existingSession = await db.collection<SabChatSession>('sabchat_sessions').findOneAndUpdate(
                { userId: userObjectId, visitorId },
                { $set: { updatedAt: new Date(), 'visitorInfo.ip': ipAddress, 'visitorInfo.userAgent': userAgent, 'visitorInfo.page': page } },
                { returnDocument: 'after' }
            );
            if (existingSession) {
                return { sessionId: existingSession._id.toString(), isNew: false, session: existingSession };
            }
        }
        
        const newVisitorId = visitorId || `visitor_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        const newSessionData: Omit<SabChatSession, '_id'> = {
            userId: userObjectId,
            visitorId: newVisitorId,
            status: 'open',
            createdAt: new Date(),
            updatedAt: new Date(),
            history: [],
            visitorInfo: {
                email,
                ip: ipAddress,
                userAgent,
                page,
            }
        };

        const result = await db.collection('sabchat_sessions').insertOne(newSessionData as any);
        
        revalidatePath(`/dashboard/sabchat/inbox`);
        return { sessionId: result.insertedId.toString(), isNew: true, session: { ...newSessionData, _id: result.insertedId } };
    } catch (e) {
        return { sessionId: '', isNew: false, error: getErrorMessage(e) };
    }
}

export async function getChatHistory(sessionId: string): Promise<SabChatMessage[]> {
    if (!ObjectId.isValid(sessionId)) return [];
    
    // This action can be called by an agent or a visitor, so we don't check for a user session.
    // We rely on the obscurity of the session ID.
    try {
        const { db } = await connectToDatabase();
        const session = await db.collection<SabChatSession>('sabchat_sessions').findOne({ _id: new ObjectId(sessionId) });
        return session?.history || [];
    } catch (e) {
        console.error("Failed to get chat history:", getErrorMessage(e));
        return [];
    }
}

export async function postChatMessage(sessionId: string, sender: 'visitor' | 'agent', content: string): Promise<{ success: boolean, error?: string }> {
    if (!ObjectId.isValid(sessionId)) return { success: false, error: 'Invalid session ID' };
    
    let session = await getSession(); // Agent session
    let agentId;

    if (sender === 'agent' && !session?.user) {
        return { success: false, error: 'Agent not authenticated' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const chatSession = await db.collection('sabchat_sessions').findOne({ _id: new ObjectId(sessionId) });

        if (!chatSession) {
            return { success: false, error: 'Session not found' };
        }
        
        if (sender === 'agent' && session?.user?._id.toString() !== chatSession.userId.toString()) {
            return { success: false, error: "Access denied to this chat session." };
        }
        
        if(sender === 'visitor') {
             const headersList = headers();
            const ipAddress = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? 'N/A';
            const userAgent = headersList.get('user-agent') ?? 'N/A';
            const page = headersList.get('referer') ?? 'N/A';
            
            await db.collection('sabchat_sessions').updateOne(
                { _id: new ObjectId(sessionId) },
                { $set: { 'visitorInfo.ip': ipAddress, 'visitorInfo.userAgent': userAgent, 'visitorInfo.page': page } }
            );
        }

        const newMessage: SabChatMessage = {
            _id: new ObjectId(),
            sender,
            type: 'text',
            content,
            timestamp: new Date(),
            ...(sender === 'agent' && { agentId: session?.user?._id.toString() }),
        };

        const result = await db.collection('sabchat_sessions').updateOne(
            { _id: new ObjectId(sessionId) },
            { 
                $push: { history: newMessage },
                $set: { updatedAt: new Date(), status: 'open' }
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
            .project({ history: { $slice: -1 } }) // Get only the last message for the snippet
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

export async function getLiveVisitors(): Promise<WithId<SabChatSession>[]> {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        const visitors = await db.collection<SabChatSession>('sabchat_sessions')
            .find({ 
                userId: new ObjectId(session.user._id),
                updatedAt: { $gte: fiveMinutesAgo }
            })
            .project({ history: 0 }) // Exclude history for performance
            .sort({ updatedAt: -1 })
            .toArray();
            
        return JSON.parse(JSON.stringify(visitors));
    } catch (e) {
        console.error("Failed to get live visitors:", getErrorMessage(e));
        return [];
    }
}

export async function getSabChatAnalytics() {
    const session = await getSession();
    if (!session?.user) {
        return {
            totalChats: 0,
            openChats: 0,
            closedChats: 0,
            avgResponseTime: 0,
            satisfaction: 0,
            dailyChatVolume: [],
        }
    };

    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const totalChats = await db.collection('sabchat_sessions').countDocuments({ userId });
        const openChats = await db.collection('sabchat_sessions').countDocuments({ userId, status: 'open' });
        
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const dailyVolumeData = await db.collection('sabchat_sessions').aggregate([
            { $match: { userId, createdAt: { $gte: sevenDaysAgo } } },
            { 
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]).toArray();
        
        const dailyChatVolume = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateString = d.toISOString().split('T')[0];
            const dayData = dailyVolumeData.find(item => item._id === dateString);
            return {
                date: d.toLocaleString('default', { weekday: 'short' }),
                count: dayData?.count || 0
            };
        }).reverse();


        return {
            totalChats,
            openChats,
            closedChats: totalChats - openChats,
            avgResponseTime: 45, // Mock data
            satisfaction: 92, // Mock data
            dailyChatVolume,
        };

    } catch (e) {
        console.error("Failed to get sabChat analytics:", getErrorMessage(e));
         return {
            totalChats: 0,
            openChats: 0,
            closedChats: 0,
            avgResponseTime: 0,
            satisfaction: 0,
            dailyChatVolume: [],
        };
    }
}
