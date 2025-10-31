
'use server';

import { connectToDatabase } from '@/lib/mongodb';
import { getSession } from '@/app/actions';
import { ObjectId, type WithId } from 'mongodb';
import type { SabChatSettings, SabChatSession, SabChatMessage } from '@/lib/definitions';
import { revalidatePath } from 'next/cache';
import { getErrorMessage } from '@/lib/utils';
import { headers } from 'next/headers';

export async function saveSabChatSettings(prevState: any, formData: FormData) {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required' };
    
    // Existing settings not on this form, passed via hidden input
    const existingSettings = JSON.parse(formData.get('settings') as string || '{}');

    const settings: Partial<SabChatSettings> = {
        ...existingSettings,
        // AI-related fields from this form
        aiEnabled: formData.get('aiEnabled') === 'on',
        aiContext: formData.get('aiContext') as string,
        // Auto-reply fields that might be on a different form but use the same action
        welcomeEnabled: formData.get('welcomeEnabled') === 'on',
        welcomeMessage: formData.get('welcomeMessage') as string,
        awayMessageEnabled: formData.get('awayMessageEnabled') === 'on',
        awayMessage: formData.get('awayMessage') as string,
        // General fields
        enabled: formData.get('enabled') === 'on',
        widgetColor: formData.get('widgetColor') as string,
        teamName: formData.get('teamName') as string,
        avatarUrl: formData.get('avatarUrl') as string,
    };
    
    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { sabChatSettings: settings } }
        );
        revalidatePath('/dashboard/sabchat/settings');
        revalidatePath('/dashboard/sabchat/ai-replies');
        revalidatePath('/dashboard/sabchat/widget');
        revalidatePath('/dashboard/sabchat/auto-reply');
        return { message: 'Settings saved successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}


export async function saveSabChatFaq(prevState: any, formData: FormData) {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required' };

    const id = formData.get('id') as string | null;
    const question = formData.get('question') as string;
    const answer = formData.get('answer') as string;

    if (!question || !answer) return { error: 'Question and answer are required.' };
    
    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(session.user._id) });
        const faqs = user?.sabChatSettings?.faqs || [];

        if (id) {
            const index = faqs.findIndex((f: any) => f._id.toString() === id);
            if (index > -1) {
                faqs[index].question = question;
                faqs[index].answer = answer;
            }
        } else {
            faqs.push({ _id: new ObjectId(), question, answer });
        }

        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { 'sabChatSettings.faqs': faqs } }
        );
        revalidatePath('/dashboard/sabchat/faq');
        return { message: 'FAQ saved successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteSabChatFaq(faqId: string) {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $pull: { 'sabChatSettings.faqs': { _id: new ObjectId(faqId) } } }
        );
        revalidatePath('/dashboard/sabchat/faq');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function saveSabChatQuickReply(prevState: any, formData: FormData) {
    const session = await getSession();
    if (!session?.user) return { error: 'Authentication required' };

    const id = formData.get('id') as string | null;
    const shortcut = formData.get('shortcut') as string;
    const message = formData.get('message') as string;

    if (!shortcut || !message) return { error: 'Shortcut and message are required.' };
    if (!shortcut.startsWith('/')) return { error: 'Shortcut must start with a forward slash (/).' };
    
    try {
        const { db } = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(session.user._id) });
        const replies = user?.sabChatSettings?.quickReplies || [];

        if (id) {
            const index = replies.findIndex((r: any) => r._id.toString() === id);
            if (index > -1) {
                replies[index].shortcut = shortcut;
                replies[index].message = message;
            }
        } else {
            replies.push({ _id: new ObjectId(), shortcut, message });
        }

        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { 'sabChatSettings.quickReplies': replies } }
        );
        revalidatePath('/dashboard/sabchat/quick-replies');
        return { message: 'Quick reply saved successfully.' };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function deleteSabChatQuickReply(replyId: string) {
    const session = await getSession();
    if (!session?.user) return { success: false, error: 'Authentication required' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $pull: { 'sabChatSettings.quickReplies': { _id: new ObjectId(replyId) } } }
        );
        revalidatePath('/dashboard/sabchat/quick-replies');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}


export async function getChatSessionsForUser() {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const sessions = await db.collection('sabchat_sessions').find({
            userId: new ObjectId(session.user._id)
        }).sort({ updatedAt: -1 }).toArray();
        return JSON.parse(JSON.stringify(sessions));
    } catch (e) {
        return [];
    }
}

export async function getLiveVisitors() {
    const session = await getSession();
    if (!session?.user) return [];
    try {
        const { db } = await connectToDatabase();
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const visitors = await db.collection('sabchat_sessions').find({
            userId: new ObjectId(session.user._id),
            updatedAt: { $gte: tenMinutesAgo }
        }).sort({ updatedAt: -1 }).toArray();
        return JSON.parse(JSON.stringify(visitors));
    } catch (e) {
        return [];
    }
}

export async function getFullChatSession(sessionId: string): Promise<WithId<SabChatSession> | null> {
    const session = await getSession();
    if (!session?.user) return null;

    if (!sessionId || !ObjectId.isValid(sessionId)) {
        return null;
    }
    
    try {
        const { db } = await connectToDatabase();
        const chatSession = await db.collection<SabChatSession>('sabchat_sessions').findOne({
            _id: new ObjectId(sessionId),
            userId: new ObjectId(session.user._id)
        });
        
        return chatSession ? JSON.parse(JSON.stringify(chatSession)) : null;

    } catch (e) {
        return null;
    }
}

export async function getOrCreateChatSession(userId: string, email: string, visitorId?: string | null): Promise<{ sessionId?: string; session?: WithId<SabChatSession>, error?: string }> {
    try {
        const { db } = await connectToDatabase();
        const now = new Date();
        const headersList = headers();
        
        let validVisitorId: ObjectId;

        if (visitorId && ObjectId.isValid(visitorId)) {
            validVisitorId = new ObjectId(visitorId);
        } else {
            validVisitorId = new ObjectId();
        }


        const result = await db.collection<SabChatSession>('sabchat_sessions').findOneAndUpdate(
            { userId: new ObjectId(userId), visitorId: validVisitorId },
            { 
                $set: { 
                    updatedAt: now,
                    'visitorInfo.email': email,
                    'visitorInfo.ip': headersList.get('x-forwarded-for') || 'unknown',
                    'visitorInfo.userAgent': headersList.get('user-agent') || 'unknown',
                    'visitorInfo.page': headersList.get('referer') || 'unknown'
                },
                $setOnInsert: {
                    userId: new ObjectId(userId),
                    visitorId: validVisitorId,
                    status: 'open',
                    createdAt: now,
                    history: [],
                }
            },
            { upsert: true, returnDocument: 'after' }
        );
        
        const session = result;

        if (!session) {
            return { error: "Could not create or find a session." };
        }
        
        return { sessionId: session._id.toString(), session: JSON.parse(JSON.stringify(session)) };
    } catch (e: any) {
        return { error: getErrorMessage(e) };
    }
}

export async function postChatMessage(sessionId: string, sender: 'visitor' | 'agent', content: string): Promise<{ success: boolean; error?: string }> {
    if (!sessionId || !ObjectId.isValid(sessionId)) {
        return { success: false, error: 'Invalid session ID.' };
    }

    try {
        const { db } = await connectToDatabase();
        
        const newMessage: SabChatMessage = {
            _id: new ObjectId(),
            sender,
            content,
            type: 'text',
            timestamp: new Date()
        };

        const result = await db.collection('sabchat_sessions').updateOne(
            { _id: new ObjectId(sessionId) },
            { 
                $push: { history: newMessage },
                $set: { updatedAt: new Date() }
            }
        );

        if (result.modifiedCount === 0) {
            return { success: false, error: 'Session not found.' };
        }

        revalidatePath('/dashboard/sabchat/inbox');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: getErrorMessage(e) };
    }
}

export async function getChatHistory(sessionId: string) {
    if (!sessionId || !ObjectId.isValid(sessionId)) {
        return [];
    }
    try {
        const { db } = await connectToDatabase();
        const session = await db.collection<SabChatSession>('sabchat_sessions').findOne(
            { _id: new ObjectId(sessionId) },
            { projection: { history: 1 } }
        );
        return session?.history || [];
    } catch (e) {
        return [];
    }
}

export async function getSabChatAnalytics() {
    const session = await getSession();
    if (!session?.user) return null;
    try {
        const { db } = await connectToDatabase();
        const userId = new ObjectId(session.user._id);

        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        const dailyCounts = await db.collection('sabchat_sessions').aggregate([
            { $match: { userId: userId, createdAt: { $gte: sevenDaysAgo } } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                count: { $sum: 1 }
            }},
            { $sort: { _id: 1 } },
            { $project: { _id: 0, date: "$_id", count: "$count" }}
        ]).toArray();


        const stats = await db.collection('sabchat_sessions').aggregate([
            { $match: { userId: userId } },
            { $group: {
                _id: null,
                totalChats: { $sum: 1 },
                openChats: { $sum: { $cond: [ { $eq: ['$status', 'open'] }, 1, 0] } }
            }}
        ]).next();

        return {
            totalChats: stats?.totalChats || 0,
            openChats: stats?.openChats || 0,
            closedChats: (stats?.totalChats || 0) - (stats?.openChats || 0),
            avgResponseTime: 32, // Mock
            satisfaction: 94, // Mock
            dailyChatVolume: dailyCounts
        }

    } catch (e) {
        console.error("Failed to get sabchat analytics", e);
        return null;
    }
}

    