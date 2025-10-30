
'use server';

import { connectToDatabase } from "@/lib/mongodb";
import { getSession } from ".";
import { ObjectId, type WithId } from "mongodb";
import { revalidatePath } from "next/cache";
import type { SabChatSettings, User } from "@/lib/definitions";

export async function getOrCreateChatSession(userId: string, email: string, existingVisitorId?: string | null) {
    if (!ObjectId.isValid(userId)) {
        return { error: 'Invalid user ID.' };
    }
    
    try {
        const { db } = await connectToDatabase();
        const userObjectId = new ObjectId(userId);

        const visitorId = existingVisitorId || new ObjectId().toString();

        const session = await db.collection('sabchat_sessions').findOneAndUpdate(
            { userId: userObjectId, visitorId: visitorId },
            { 
                $setOnInsert: { 
                    userId: userObjectId,
                    visitorId: visitorId,
                    status: 'open',
                    createdAt: new Date(),
                    history: [],
                    visitorInfo: { email }
                },
                $set: {
                    updatedAt: new Date()
                }
            },
            { upsert: true, returnDocument: 'after' }
        );

        return { 
            sessionId: session?._id.toString(),
            session: JSON.parse(JSON.stringify(session)),
        };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function postChatMessage(sessionId: string, sender: 'visitor' | 'agent', content: string) {
     if (!ObjectId.isValid(sessionId)) {
        return { success: false, error: 'Invalid session ID.' };
    }
    try {
        const { db } = await connectToDatabase();
        const newMessage = {
            sender,
            content,
            timestamp: new Date()
        };
        await db.collection('sabchat_sessions').updateOne(
            { _id: new ObjectId(sessionId) },
            { 
                $push: { history: newMessage },
                $set: { updatedAt: new Date() }
            }
        );
        revalidatePath('/dashboard/sabchat/inbox');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getChatHistory(sessionId: string) {
    if (!ObjectId.isValid(sessionId)) return [];
    try {
        const { db } = await connectToDatabase();
        const session = await db.collection('sabchat_sessions').findOne({ _id: new ObjectId(sessionId) });
        return session?.history || [];
    } catch (e) {
        return [];
    }
}

export async function getFullChatSession(sessionId: string): Promise<WithId<any> | null> {
    if (!ObjectId.isValid(sessionId)) return null;
    try {
        const { db } = await connectToDatabase();
        const session = await db.collection('sabchat_sessions').findOne({ _id: new ObjectId(sessionId) });
        return JSON.parse(JSON.stringify(session));
    } catch (e) {
        return null;
    }
}

export async function getChatSessionsForUser() {
    const session = await getSession();
    if (!session?.user) return [];

    try {
        const { db } = await connectToDatabase();
        const sessions = await db.collection('sabchat_sessions')
            .find({ userId: new ObjectId(session.user._id) })
            .sort({ updatedAt: -1 })
            .limit(100)
            .toArray();
        return JSON.parse(JSON.stringify(sessions));
    } catch (e) {
        console.error("Failed to get chat sessions:", e);
        return [];
    }
}

export async function getLiveVisitors() {
    const session = await getSession();
    if (!session?.user) return [];

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    try {
        const { db } = await connectToDatabase();
        const visitors = await db.collection('sabchat_sessions')
            .find({ userId: new ObjectId(session.user._id), updatedAt: { $gte: fiveMinutesAgo } })
            .sort({ updatedAt: -1 })
            .toArray();
        return JSON.parse(JSON.stringify(visitors));
    } catch (e) {
        console.error("Failed to fetch live visitors:", e);
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

        const [totalChats, openChats, closedChats, dailyVolume] = await Promise.all([
            db.collection('sabchat_sessions').countDocuments({ userId }),
            db.collection('sabchat_sessions').countDocuments({ userId, status: 'open' }),
            db.collection('sabchat_sessions').countDocuments({ userId, status: 'closed' }),
            db.collection('sabchat_sessions').aggregate([
                { $match: { userId, createdAt: { $gte: sevenDaysAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } },
                { $project: { date: '$_id', count: 1, _id: 0 } }
            ]).toArray()
        ]);
        
        return {
            totalChats,
            openChats,
            closedChats,
            dailyChatVolume: dailyVolume,
            // Mock data for new metrics
            avgResponseTime: 45,
            satisfaction: 92,
        };
    } catch (e) {
        console.error("Failed to get chat analytics:", e);
        return null;
    }
}

export async function saveSabChatSettings(prevState: any, formData: FormData) {
    const session = await getSession();
    if (!session?.user) return { error: "Authentication required" };

    try {
        const existingSettings = JSON.parse(formData.get('settings') as string || '{}');
        
        const settings: SabChatSettings = {
            ...existingSettings,
            enabled: formData.get('enabled') === 'on',
            widgetColor: formData.get('widgetColor') as string,
            welcomeMessage: formData.get('welcomeMessage') as string,
            teamName: formData.get('teamName') as string,
            avatarUrl: formData.get('avatarUrl') as string,
            welcomeEnabled: formData.get('welcomeEnabled') === 'on',
            awayMessageEnabled: formData.get('awayMessageEnabled') === 'on',
            awayMessage: formData.get('awayMessage') as string,
            aiEnabled: formData.get('aiEnabled') === 'on',
            aiContext: formData.get('aiContext') as string,
        };

        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { sabChatSettings: settings } }
        );
        revalidatePath('/dashboard/sabchat', 'layout');
        return { message: 'Settings saved successfully.' };
    } catch (e: any) {
        return { error: 'Failed to save settings.' };
    }
}

export async function saveSabChatFaq(prevState: any, formData: FormData) {
    const session = await getSession();
    if (!session?.user) return { error: "Authentication required" };
    
    const id = formData.get('id') as string | null;
    const question = formData.get('question') as string;
    const answer = formData.get('answer') as string;

    if (!question || !answer) return { error: "Question and Answer are required." };

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ _id: new ObjectId(session.user._id) });
        const faqs = user?.sabChatSettings?.faqs || [];

        if (id) { // Editing
            const faqIndex = faqs.findIndex(f => f._id.toString() === id);
            if (faqIndex > -1) {
                faqs[faqIndex] = { ...faqs[faqIndex], question, answer };
            }
        } else { // Adding
            faqs.push({ _id: new ObjectId(), question, answer });
        }
        
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { "sabChatSettings.faqs": faqs } }
        );
        revalidatePath('/dashboard/sabchat/faq');
        return { message: `FAQ ${id ? 'updated' : 'added'} successfully.` };
    } catch (e: any) {
        return { error: 'Failed to save FAQ.' };
    }
}

export async function deleteSabChatFaq(faqId: string) {
    const session = await getSession();
    if (!session?.user) return { error: "Authentication required" };

    if (!ObjectId.isValid(faqId)) return { error: 'Invalid FAQ ID.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $pull: { "sabChatSettings.faqs": { _id: new ObjectId(faqId) } } }
        );
        revalidatePath('/dashboard/sabchat/faq');
        return { success: true };
    } catch (e: any) {
        return { error: 'Failed to delete FAQ.' };
    }
}

export async function saveSabChatQuickReply(prevState: any, formData: FormData) {
    const session = await getSession();
    if (!session?.user) return { error: "Authentication required" };

    const id = formData.get('id') as string | null;
    const shortcut = formData.get('shortcut') as string;
    const message = formData.get('message') as string;

    if (!shortcut || !message || !shortcut.startsWith('/')) {
        return { error: "Shortcut (starting with /) and message are required." };
    }

    try {
        const { db } = await connectToDatabase();
        const user = await db.collection<User>('users').findOne({ _id: new ObjectId(session.user._id) });
        const replies = user?.sabChatSettings?.quickReplies || [];

        if (id) {
            const replyIndex = replies.findIndex(r => r._id.toString() === id);
            if (replyIndex > -1) {
                replies[replyIndex] = { ...replies[replyIndex], shortcut, message };
            }
        } else {
            replies.push({ _id: new ObjectId(), shortcut, message });
        }

        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $set: { "sabChatSettings.quickReplies": replies } }
        );
        revalidatePath('/dashboard/sabchat/quick-replies');
        return { message: `Quick reply ${id ? 'updated' : 'added'} successfully.` };
    } catch (e: any) {
        return { error: 'Failed to save quick reply.' };
    }
}

export async function deleteSabChatQuickReply(replyId: string) {
    const session = await getSession();
    if (!session?.user) return { error: "Authentication required" };

    if (!ObjectId.isValid(replyId)) return { error: 'Invalid reply ID.' };

    try {
        const { db } = await connectToDatabase();
        await db.collection('users').updateOne(
            { _id: new ObjectId(session.user._id) },
            { $pull: { "sabChatSettings.quickReplies": { _id: new ObjectId(replyId) } } }
        );
        revalidatePath('/dashboard/sabchat/quick-replies');
        return { success: true };
    } catch (e: any) {
        return { error: 'Failed to delete quick reply.' };
    }
}
